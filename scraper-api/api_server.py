"""API REST légère qui expose les données du scraper TikTok en JSON.

Lancement : python api_server.py --port 8502
Endpoints :
  GET /api/videos              → liste des vidéos uniques (hashtags, stats, miniature)
  GET /api/videos/<id>/comments → commentaires de la vidéo
  GET /api/comments            → tous les commentaires (aplatis)
  GET /api/stats               → compteurs rapides
  GET /api/stream/<id>         → streaming vidéo (cache local, yt-dlp une seule fois)
  GET /api/reload              → recharge les données depuis comments.json

Lit comments.json, comments.csv ou comments.xlsx dans le dossier courant.
Cache vidéo : ./video_cache/<id>.mp4 (TTL 24h)
"""

import csv
import json
import os
import re
import subprocess
import sys
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).parent
# Production mounts /app/data as a persistent volume; local development keeps ./video_cache.
VIDEO_CACHE = Path(os.environ.get("VIDEO_CACHE_DIR", str(ROOT / "video_cache")))
VIDEO_CACHE_TTL = 86400  # 24 heures
_CACHE_LOCKS: dict[str, threading.Lock] = {}
_CACHE_LOCKS_GUARD = threading.Lock()
_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")

# ── Chargement des données ──────────────────────────────────────────────

def _load_comments():
    """Charge les commentaires depuis le fichier dispo (json > csv > xlsx)."""
    json_path = ROOT / "comments.json"
    if json_path.exists():
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
        except Exception:
            pass

    csv_path = ROOT / "comments.csv"
    if csv_path.exists():
        try:
            rows = []
            with open(csv_path, encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    for k in ("likes", "reply_count", "spam_score", "video_views", "video_likes", "video_duration", "level"):
                        if k in row:
                            try: row[k] = int(float(row.get(k, 0)))
                            except (ValueError, TypeError): row[k] = 0
                    rows.append(row)
            return rows
        except Exception:
            pass

    xlsx_path = ROOT / "comments.xlsx"
    if xlsx_path.exists():
        try:
            import pandas as pd
            df = pd.read_excel(xlsx_path)
            return df.to_dict("records")
        except Exception:
            pass

    return []


def _extract_hashtags(text: str) -> list[str]:
    """Extrait les hashtags uniques d'un texte."""
    if not text:
        return []
    matches = re.findall(r'#([\w\u00C0-\u017F]+)', text, re.IGNORECASE)
    return list(dict.fromkeys(m.lower() for m in matches))


def _unique_videos(comments: list[dict]) -> list[dict]:
    """Déduplique les vidéos par video_id, conserve les métadonnées + hashtags."""
    seen = {}
    for c in comments:
        vid = str(c.get("video_id") or "").strip()
        if not vid or vid in seen:
            continue
        thumb = str(c.get("video_thumbnail") or c.get("cover_url") or "").strip()
        if not thumb:
            thumb = f"https://picsum.photos/seed/tk{vid}/400/600"
        title = str(c.get("video_title") or "")
        seen[vid] = {
            "id": vid,
            "title": title,
            "views": int(c.get("video_views") or 0),
            "likes": int(c.get("video_likes") or 0),
            "duration": int(c.get("video_duration") or 0),
            "commentCount": 0,
            "url": f"https://www.tiktok.com/@tiktok/video/{vid}",
            "thumbnailUrl": thumb,
            "hashtags": _extract_hashtags(title),
            "comments": [],
        }
    # Comptage + collecte des hashtags cumulés
    for c in comments:
        vid = str(c.get("video_id") or "").strip()
        if vid in seen:
            seen[vid]["commentCount"] += 1
            # Ajouter les hashtags des commentaires aussi
            extra = _extract_hashtags(str(c.get("text") or ""))
            for h in extra:
                if h not in seen[vid]["hashtags"]:
                    seen[vid]["hashtags"].append(h)
            seen[vid]["comments"].append({
                "id": str(c.get("cid") or c.get("id") or ""),
                "text": str(c.get("text") or ""),
                "username": str(c.get("username") or "anonymous"),
                "nickname": str(c.get("nickname") or c.get("username") or "anonymous"),
                "likes": int(c.get("likes") or 0),
                "replyCount": int(c.get("reply_count") or 0),
                "createdAt": c.get("create_time") or "",
                "replies": c.get("replies") or [],
            })
    return sorted(seen.values(), key=lambda v: v["views"], reverse=True)


def _comments_for_video(comments: list[dict], video_id: str) -> list[dict]:
    """Filtre les commentaires pour une vidéo donnée (exclut les métadonnées)."""
    result = []
    for c in comments:
        vid = str(c.get("video_id") or "").strip()
        if vid == video_id:
            result.append({
                "id": str(c.get("cid") or c.get("id") or ""),
                "text": str(c.get("text") or ""),
                "username": str(c.get("username") or "anonymous"),
                "nickname": str(c.get("nickname") or c.get("username") or "anonymous"),
                "likes": int(c.get("likes") or 0),
                "replyCount": int(c.get("reply_count") or 0),
                "createdAt": c.get("create_time") or "",
                "replies": c.get("replies") or [],
            })
    return result


def _summary(comments: list[dict]) -> dict:
    videos = _unique_videos(comments)
    users = len({c.get("username", "") for c in comments if c.get("username")})
    spam = sum(1 for c in comments if c.get("category") == "spam")
    return {
        "totalComments": len(comments),
        "totalVideos": len(videos),
        "uniqueUsers": users,
        "spamCount": spam,
        "lastScraped": max((c.get("create_time", "") for c in comments), default=""),
    }


# ── Cache vidéo local ────────────────────────────────────────────────────

def _cached_video_path(video_id: str) -> Path:
    if not _VIDEO_ID_RE.fullmatch(video_id):
        raise ValueError("invalid video id")
    VIDEO_CACHE.mkdir(parents=True, exist_ok=True)
    return VIDEO_CACHE / f"{video_id}.mp4"


def _cache_lock(video_id: str) -> threading.Lock:
    with _CACHE_LOCKS_GUARD:
        return _CACHE_LOCKS.setdefault(video_id, threading.Lock())


def _get_cached_video(video_id: str) -> Path | None:
    """Retourne le chemin si la vidéo est en cache et valide, sinon None."""
    path = _cached_video_path(video_id)
    if not path.exists():
        return None
    # Vérifier TTL
    age = time.time() - path.stat().st_mtime
    if age > VIDEO_CACHE_TTL:
        path.unlink(missing_ok=True)
        return None
    # Vérifier taille minimale (éviter les fichiers corrompus)
    if path.stat().st_size < 1000:
        path.unlink(missing_ok=True)
        return None
    return path


def _download_to_cache(video_id: str, tiktok_url: str) -> Path | None:
    """Télécharge atomiquement la vidéo via yt-dlp dans le cache."""
    outpath = _cached_video_path(video_id)
    temporary = outpath.with_suffix(".part")
    try:
        subprocess.run(
            ["yt-dlp", "-o", str(temporary), "--format", "mp4/best[height<=720]",
             "--no-warnings", "--no-playlist", "--no-progress",
             "--max-filesize", "50M", tiktok_url],
            capture_output=True, text=True, timeout=60
        )
        if temporary.exists() and temporary.stat().st_size > 1000:
            os.replace(temporary, outpath)
            return outpath
    except Exception:
        pass
    # Nettoyer fichier partiel
    temporary.unlink(missing_ok=True)
    outpath.unlink(missing_ok=True)
    return None


# ── Serveur HTTP ────────────────────────────────────────────────────────

class ScraperAPI(BaseHTTPRequestHandler):
    comments: list[dict] = []
    videos: list[dict] = []
    stats: dict = {}
    _url_index: dict[str, str] = {}

    @classmethod
    def reload(cls):
        cls.comments = _load_comments()
        cls.videos = _unique_videos(cls.comments)
        cls.stats = _summary(cls.comments)
        cls._url_index = {}
        for c in cls.comments:
            vid = str(c.get("video_id") or "").strip()
            if vid and vid not in cls._url_index:
                cls._url_index[vid] = c.get("url") or f"https://www.tiktok.com/@tiktok/video/{vid}"

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(self, path: Path, content_type: str):
        """Sert un fichier statique (utilisé pour le cache vidéo)."""
        try:
            size = path.stat().st_size
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(size))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            with open(path, "rb") as f:
                while True:
                    chunk = f.read(65536)  # 64 Ko
                    if not chunk:
                        break
                    try:
                        self.wfile.write(chunk)
                    except (BrokenPipeError, ConnectionResetError):
                        break
        except Exception:
            try:
                self._json({"error": "Serve failed"}, 500)
            except Exception:
                pass

    def _stream_video(self, video_id: str):
        """Stream/cache la vidéo TikTok. Cache local prioritaire, sinon yt-dlp une fois."""
        tiktok_url = self._url_index.get(video_id)
        if not tiktok_url:
            tiktok_url = f"https://www.tiktok.com/@tiktok/video/{video_id}"

        # 1) Servir depuis le cache si disponible
        cached = _get_cached_video(video_id)
        if cached:
            self._serve_file(cached, "video/mp4")
            return

        # 2) Télécharger dans le cache puis servir
        downloaded = _download_to_cache(video_id, tiktok_url)
        if downloaded:
            self._serve_file(downloaded, "video/mp4")
            return

        # 3) Fallback : stream direct yt-dlp stdout (pas de cache)
        try:
            proc = subprocess.Popen(
                ["yt-dlp", "-o", "-", "--format", "mp4/best[height<=720]",
                 "--no-warnings", "--no-playlist", tiktok_url],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL
            )
            self.send_response(200)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=3600")
            self.end_headers()
            while True:
                chunk = proc.stdout.read(8192)
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break
            proc.stdout.close()
            proc.wait(timeout=5)
        except Exception:
            try:
                self._json({"error": "Stream failed"}, 502)
            except Exception:
                pass

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/")

        # /api/stream/<video_id>
        if path.startswith("/api/stream/"):
            video_id = path.split("/api/stream/", 1)[1]
            self._stream_video(video_id)
            return

        # /api/videos/<id>/comments
        if path.startswith("/api/videos/") and path.endswith("/comments"):
            parts = path.split("/")
            video_id = parts[3] if len(parts) >= 4 else ""
            comments = _comments_for_video(self.comments, video_id)
            self._json({"videoId": video_id, "comments": comments, "count": len(comments)})
            return

        # /api/videos/<id> — détail d'une vidéo
        if path.startswith("/api/videos/") and len(path.split("/")) == 4:
            video_id = path.split("/")[3]
            for v in self.videos:
                if v["id"] == video_id:
                    comments = _comments_for_video(self.comments, video_id)
                    v["comments"] = comments
                    self._json(v)
                    return
            self._json({"error": "Video not found"}, 404)
            return

        if path == "/api/videos":
            self._json({"videos": self.videos, "count": len(self.videos)})
        elif path == "/api/comments":
            limit = 200
            self._json({"comments": self.comments[:limit], "count": len(self.comments)})
        elif path == "/api/stats":
            self._json(self.stats)
        elif path == "/api/reload":
            self.reload()
            self._json({"ok": True, "message": "Données rechargées"})
        elif path == "/" or path == "":
            self._json({
                "service": "TikTok Scraper Bridge API",
                "endpoints": [
                    "/api/videos", "/api/videos/<id>", "/api/videos/<id>/comments",
                    "/api/comments", "/api/stats", "/api/reload", "/api/stream/<id>"
                ],
                "dataAvailable": len(self.comments) > 0,
            })
        else:
            self._json({"error": "Not found"}, 404)

    def log_message(self, format, *args):
        pass


def main():
    port = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[1] == "--port" else 8502

    ScraperAPI.reload()
    print(f"[SCRAPER API] {ScraperAPI.stats['totalComments']} commentaires, "
          f"{ScraperAPI.stats['totalVideos']} videos - http://localhost:{port}")

    server = HTTPServer(("127.0.0.1", port), ScraperAPI)
    print(f"[SCRAPER API] Listening on http://127.0.0.1:{port}/api/videos")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[SCRAPER API] Arrêt.")
        server.shutdown()


if __name__ == "__main__":
    main()
