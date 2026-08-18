"""Internal read-only API for ORKY's external TikTok research data.

This service is deliberately NOT a social backend. It exposes external references
behind a server-to-server secret so ORKY can inspect/import them without confusing
scraped identities with canonical ORKY users/videos.

Public browser traffic must go through the Next.js same-origin proxy.
"""

import csv
import hmac
import json
import os
import re
import subprocess
import sys
import threading
import time
import unicodedata
import urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qsl

ROOT = Path(__file__).parent
# Volume persistant (voir Dockerfile.scraper) : le catalogue régénéré y est
# écrit pour survivre aux redémarrages du conteneur.
DATA_DIR = Path(os.environ.get("SCRAPER_DATA_DIR", str(ROOT / "data")))
VIDEO_CACHE = Path(os.environ.get("VIDEO_CACHE_DIR", str(ROOT / "video_cache")))
VIDEO_CACHE_TTL = int(os.environ.get("VIDEO_CACHE_TTL_SECONDS", "86400"))
SCRAPER_INTERNAL_SECRET = os.environ.get("SCRAPER_INTERNAL_SECRET", "").strip()
# Association vidéo → produit Orchidy (voir docs/trend-sourcing-contract.md).
# Auto-match désactivé par défaut : SCRAPER_AUTO_MATCH=1 l'active. Les
# approbations utilisateur sont persistées dans DATA_DIR/matches.json.
ORCHIDY_API_BASE_URL = os.environ.get("ORCHIDY_API_BASE_URL", "https://orchidy.fr").strip().rstrip("/")
ORCHIDY_CATALOG_TTL = int(os.environ.get("ORCHIDY_CATALOG_TTL_SECONDS", "3600") or 3600)
AUTO_MATCH_ENABLED = os.environ.get("SCRAPER_AUTO_MATCH", "0") == "1"
# Seuil volontairement modéré : le pill « Produit suggéré » exige une
# approbation humaine avant de devenir achetable. Un seuil trop haut ne
# produirait jamais de suggestion sur les titres TikTok bruités.
AUTO_MATCH_MIN_SCORE = float(os.environ.get("SCRAPER_AUTO_MATCH_MIN_SCORE", "0.30") or 0.30)
AUTO_MATCH_MAX = int(os.environ.get("SCRAPER_AUTO_MATCH_MAX", "3") or 3)
ORCHIDY_CATALOG_MAX_PRODUCTS = int(os.environ.get("ORCHIDY_CATALOG_MAX_PRODUCTS", "500") or 500)
ORCHIDY_CATALOG_MAX_PAGES = int(os.environ.get("ORCHIDY_CATALOG_MAX_PAGES", "10") or 10)
MATCHES_FILE = DATA_DIR / "matches.json"
_CATALOG_CACHE: dict = {"at": 0.0, "products": []}
_APPROVED_MATCHES: dict[str, list[dict]] = {}
# Régénération quotidienne du catalogue (coûteuse : runs Apify). Désactivée
# par défaut ; SCRAPER_AUTO_REFRESH=1 + SCRAPER_AUTO_REFRESH_HOUR (UTC) active.
AUTO_REFRESH_ENABLED = os.environ.get("SCRAPER_AUTO_REFRESH", "0") == "1"
AUTO_REFRESH_HOUR = int(os.environ.get("SCRAPER_AUTO_REFRESH_HOUR", "3") or 3)
REFRESH_COMMENTS = int(os.environ.get("SCRAPER_REFRESH_COMMENTS", "6") or 6)
REFRESH_WORKERS = max(1, min(8, int(os.environ.get("SCRAPER_REFRESH_WORKERS", "4") or 4)))
REFRESH_PER = int(os.environ.get("SCRAPER_REFRESH_PER", "10") or 10)

# État du refresh en cours (protégé par un verrou global).
_REFRESH_LOCK = threading.Lock()
_REFRESH_STATE: dict = {"running": False, "last_run": "", "last_status": "", "message": ""}


def _run_catalog_refresh(comments_per_video: int = REFRESH_COMMENTS) -> None:
    """Lance enrich_catalog.py (sous-processus) puis recharge les données.

    Exécuté dans un thread de fond : le endpoint admin répond immédiatement
    et le résultat est visible via /api/admin/refresh-status. Écrit le
    catalogue dans DATA_DIR (volume persistant) pour survivre au restart.
    """
    with _REFRESH_LOCK:
        if _REFRESH_STATE["running"]:
            return
        _REFRESH_STATE.update(running=True, last_run="", last_status="running", message="Démarrage…")
    started = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    def _worker():
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            out_path = DATA_DIR / "comments.json"
            cmd = [
                sys.executable, str(ROOT / "enrich_catalog.py"),
                "--per", str(REFRESH_PER),
                "--comments", str(max(0, int(comments_per_video))),
                "--workers", str(REFRESH_WORKERS),
                "--out", str(out_path),
            ]
            proc = subprocess.run(
                cmd, cwd=str(ROOT), capture_output=True, text=True, timeout=7200
            )
            ok = proc.returncode == 0
            tail = (proc.stdout or "").strip().splitlines()[-8:]
            message = "\n".join(tail) if tail else ((proc.stderr or "").strip()[-500:])
            if ok and out_path.exists():
                ScraperAPI.reload()
            with _REFRESH_LOCK:
                _REFRESH_STATE.update(
                    running=False,
                    last_run=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    last_status="ok" if ok else "failed",
                    message=message[:1000],
                )
        except Exception as exc:  # noqa: BLE001
            with _REFRESH_LOCK:
                _REFRESH_STATE.update(
                    running=False,
                    last_run=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    last_status="failed",
                    message=f"Exception: {exc}",
                )

    thread = threading.Thread(target=_worker, daemon=True, name="catalog-refresh")
    thread.start()


def _scheduler_loop() -> None:
    """Thread démon : déclenche la régénération une fois par jour à l'heure UTC configurée."""
    if not AUTO_REFRESH_ENABLED:
        return
    last_day = ""
    while True:
        today = time.strftime("%Y-%m-%d", time.gmtime())
        hour = int(time.strftime("%H", time.gmtime()))
        if today != last_day and hour == AUTO_REFRESH_HOUR:
            last_day = today
            print(f"[SCRAPER API] Scheduled daily catalog refresh at {today} {hour}:00Z")
            _run_catalog_refresh()
        time.sleep(1800)

MAX_CONCURRENT_DOWNLOADS = max(1, min(8, int(os.environ.get("SCRAPER_MAX_DOWNLOADS", "4"))))
_CACHE_LOCKS: dict[str, threading.Lock] = {}
_CACHE_LOCKS_GUARD = threading.Lock()
_DOWNLOAD_SEMAPHORE = threading.BoundedSemaphore(MAX_CONCURRENT_DOWNLOADS)
_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


def _safe_int(value, default=0):
    try:
        return int(float(value or 0))
    except (ValueError, TypeError):
        return default


def _safe_float(value, default=0.0):
    try:
        number = float(value)
        return number if 0 <= number <= 1 else default
    except (TypeError, ValueError):
        return default


def _load_approved_matches() -> dict:
    """Approbations persistées : {video_id: [record, …]} depuis matches.json."""
    try:
        if MATCHES_FILE.exists():
            data = json.loads(MATCHES_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {}


def _save_approved_matches() -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        MATCHES_FILE.write_text(
            json.dumps(_APPROVED_MATCHES, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
    except Exception:
        pass


def _load_orchidy_catalog() -> list[dict]:
    """Catalogue publié Orchidy (cache TTL). Retourne [] si indisponible."""
    now = time.time()
    if _CATALOG_CACHE["products"] and now - _CATALOG_CACHE["at"] < ORCHIDY_CATALOG_TTL:
        return _CATALOG_CACHE["products"]
    products: list[dict] = []
    try:
        # Le catalogue est paginé (50/page) ; on le parcourt jusqu'à épuisement
        # ou plafond, pour donner au matching lexical un vrai socle de produits.
        page = 1
        while len(products) < ORCHIDY_CATALOG_MAX_PRODUCTS and page <= ORCHIDY_CATALOG_MAX_PAGES:
            url = (
                f"{ORCHIDY_API_BASE_URL}/api/integrations/orky/products"
                f"?market=FR&sort=relevance&limit=50&page={page}"
            )
            # User-Agent navigateur : le WAF d'orchidy.fr répond 403 aux agents
            # de scripts (python-urllib) — observé en réel.
            request = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                "Accept": "application/json",
            })
            with urllib.request.urlopen(request, timeout=10) as resp:
                payload = json.loads(resp.read().decode("utf-8", "replace"))
            if not isinstance(payload, dict):
                break
            items = payload.get("products") or []
            if not items:
                break
            for product in items:
                if not isinstance(product, dict):
                    continue
                item_id = str(
                    product.get("slug")
                    or (product.get("seo") or {}).get("slug")
                    or product.get("id")
                    or product.get("_id")
                    or ""
                ).strip()
                title = str(product.get("title") or product.get("name") or "").strip()
                if not item_id or not title:
                    continue
                images = [str(u) for u in (product.get("images") or []) if str(u).startswith("https://")]
                image = str(product.get("image") or product.get("thumbnailUrl") or product.get("coverUrl") or "").strip()
                if image.startswith("https://") and image not in images:
                    images.insert(0, image)
                products.append({
                    "id": item_id,
                    "title": title,
                    "images": images,
                    "price": product.get("price") or product.get("priceClient") or product.get("salePrice") or 0,
                    "currency": str(product.get("currency") or "EUR").upper(),
                })
            pagination = payload.get("pagination") or {}
            if not pagination.get("hasMore"):
                break
            page += 1
    except Exception:
        products = []
    _CATALOG_CACHE.update(at=now, products=products)
    return products


def _normalize_text(value: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFD", str(value or "").lower())
        if unicodedata.category(char) != "Mn"
    )


def _tokens(value: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", _normalize_text(value))


def _lexical_score(query: str, candidate_title: str) -> float:
    """Score ∈ [0,1] : moyenne précision/rappel des jetons partagés."""
    query_tokens = set(_tokens(query))
    candidate_tokens = _tokens(candidate_title)
    if not query_tokens or not candidate_tokens:
        return 0.0
    hits = sum(1 for token in candidate_tokens if token in query_tokens)
    precision = hits / len(candidate_tokens)
    recall = hits / len(query_tokens)
    return min(1.0, 0.5 * precision + 0.5 * recall)


def _auto_match_video(video: dict) -> list[dict]:
    """Suggestions produit (jamais approuvées) pour une vidéo externe."""
    if not AUTO_MATCH_ENABLED:
        return []
    query = f"{video.get('title') or ''} {' '.join(video.get('hashtags') or [])}"
    scored = []
    for product in _load_orchidy_catalog():
        score = _lexical_score(query, product["title"])
        if score >= AUTO_MATCH_MIN_SCORE:
            scored.append({
                "orchidyCatalogItemId": product["id"],
                "variantKey": "",
                "confidence": round(score, 3),
                "source": "catalog_lexical_match",
                "status": "suggested",
            })
    scored.sort(key=lambda match: match["confidence"], reverse=True)
    return scored[:AUTO_MATCH_MAX]


def _attach_product_matches(video: dict) -> None:
    """Approbes (matches.json) puis suggestions auto — jamais de doublons."""
    approved = [dict(match) for match in _APPROVED_MATCHES.get(str(video.get("id") or ""), [])]
    approved_ids = {match["orchidyCatalogItemId"] for match in approved}
    suggested = [
        match for match in _auto_match_video(video)
        if match["orchidyCatalogItemId"] not in approved_ids
    ]
    if approved or suggested:
        video["productMatches"] = approved + suggested


def _load_comments():
    """Loads available research exports. JSON > CSV > XLSX."""
    # Le catalogue régénéré (volume persistant) prime sur l'export embarqué.
    data_json = DATA_DIR / "comments.json"
    json_path = data_json if data_json.exists() else ROOT / "comments.json"
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
            with open(csv_path, encoding="utf-8-sig") as handle:
                reader = csv.DictReader(handle)
                for row in reader:
                    for key in (
                        "likes", "reply_count", "spam_score", "video_views",
                        "video_likes", "video_duration", "level",
                    ):
                        if key in row:
                            row[key] = _safe_int(row.get(key))
                    rows.append(row)
            return rows
        except Exception:
            pass

    xlsx_path = ROOT / "comments.xlsx"
    if xlsx_path.exists():
        try:
            import pandas as pd
            return pd.read_excel(xlsx_path).to_dict("records")
        except Exception:
            pass
    return []


def _extract_hashtags(text: str) -> list[str]:
    if not text:
        return []
    matches = re.findall(r"#([\w\u00C0-\u017F]+)", text, re.IGNORECASE)
    return list(dict.fromkeys(match.lower() for match in matches))


def _comment_public(c: dict) -> dict:
    return {
        "id": str(c.get("cid") or c.get("id") or ""),
        "text": str(c.get("text") or ""),
        "username": str(c.get("username") or ""),
        "nickname": str(c.get("nickname") or c.get("username") or ""),
        "avatarUrl": str(c.get("avatar_url") or c.get("avatarUrl") or c.get("avatar") or ""),
        "likes": _safe_int(c.get("likes")),
        "replyCount": _safe_int(c.get("reply_count")),
        "createdAt": c.get("create_time") or "",
        "replies": c.get("replies") if isinstance(c.get("replies"), list) else [],
    }


def _video_source_url(record: dict, video_id: str) -> str:
    """Return the real TikTok source, even when an export omitted its URL."""
    exported = str(
        record.get("url")
        or record.get("video_url")
        or record.get("source_url")
        or ""
    ).strip()
    if exported.startswith(("https://www.tiktok.com/", "https://vm.tiktok.com/")):
        return exported
    return f"https://www.tiktok.com/@tiktok/video/{video_id}"


def _sound_public(c: dict) -> dict | None:
    title = str(c.get("video_music_title") or "").strip()
    if not title:
        return None
    return {
        "id": str(c.get("video_music_id") or ""),
        "title": title,
        "artist": str(c.get("video_music_artist") or "").strip(),
        "coverUrl": str(c.get("video_music_cover") or "").strip(),
    }


def _merge_optional_metrics(video: dict, c: dict) -> None:
    """Complète shares/saves/sound d'une vidéo quand une ligne de l'export en
    fournit, sans jamais inventer de 0 (le front utilise l'absence de champ
    comme signal « non observé »)."""
    for field, key in (("shares", "video_shares"), ("saves", "video_saves")):
        value = _safe_int(c.get(key) or c.get("video_share_count" if field == "shares" else "video_save_count"))
        if value and not video.get(field):
            video[field] = value
    if video.get("sound") is None:
        video["sound"] = _sound_public(c)


def _unique_videos(comments: list[dict]) -> list[dict]:
    seen: dict[str, dict] = {}
    for c in comments:
        vid = str(c.get("video_id") or "").strip()
        if not vid or not _VIDEO_ID_RE.fullmatch(vid):
            continue
        title = str(c.get("video_title") or "")
        if vid not in seen:
            video = {
                "id": vid,
                "title": title,
                "views": _safe_int(c.get("video_views")),
                "likes": _safe_int(c.get("video_likes")),
                "duration": _safe_int(c.get("video_duration")),
                "commentCount": 0,
                "url": _video_source_url(c, vid),
                "thumbnailUrl": str(c.get("video_thumbnail") or c.get("cover_url") or "").strip(),
                "hashtags": _extract_hashtags(title),
                "creatorUsername": str(c.get("creator_username") or c.get("author_username") or "").strip(),
                "creatorDisplayName": str(c.get("creator_nickname") or c.get("author_nickname") or "").strip(),
                "creatorAvatarUrl": str(c.get("creator_avatar") or c.get("author_avatar") or "").strip(),
                "createdAt": c.get("video_created_at") or c.get("video_create_time") or "",
                "comments": [],
            }
            # Métriques optionnelles : uniquement lorsque l'export en fournit
            # une valeur (jamais 0 inventé) pour que le front puisse distinguer
            # « compteur observé » de « non fourni » (metricAvailability).
            _merge_optional_metrics(video, c)
            seen[vid] = video
        else:
            video = seen[vid]
            _merge_optional_metrics(video, c)
        video["commentCount"] += 1
        for hashtag in _extract_hashtags(str(c.get("text") or "")):
            if hashtag not in video["hashtags"]:
                video["hashtags"].append(hashtag)
        # Mots-clés de catégorie Discover (alimentent le filtre du front),
        # marqués dans l'export par enrich_catalog.py.
        for kw in (c.get("_category_keywords") or []):
            kw = str(kw).strip().lower()
            if kw and kw not in video["hashtags"]:
                video["hashtags"].append(kw)
        video["comments"].append(_comment_public(c))
    videos = sorted(seen.values(), key=lambda item: item["views"], reverse=True)
    if AUTO_MATCH_ENABLED:
        for video in videos:
            _attach_product_matches(video)
    return videos


def _comments_for_video(comments: list[dict], video_id: str) -> list[dict]:
    return [
        _comment_public(c)
        for c in comments
        if str(c.get("video_id") or "").strip() == video_id
    ]


def _summary(comments: list[dict]) -> dict:
    videos = _unique_videos(comments)
    users = len({str(c.get("username") or "") for c in comments if c.get("username")})
    spam = sum(1 for c in comments if c.get("category") == "spam")
    return {
        "totalComments": len(comments),
        "totalVideos": len(videos),
        "uniqueUsers": users,
        "spamCount": spam,
        "lastScraped": max((str(c.get("create_time") or "") for c in comments), default=""),
    }


def _cached_video_path(video_id: str) -> Path:
    if not _VIDEO_ID_RE.fullmatch(video_id):
        raise ValueError("invalid video id")
    VIDEO_CACHE.mkdir(parents=True, exist_ok=True)
    return VIDEO_CACHE / f"{video_id}.mp4"


def _cache_lock(video_id: str) -> threading.Lock:
    with _CACHE_LOCKS_GUARD:
        return _CACHE_LOCKS.setdefault(video_id, threading.Lock())


def _get_cached_video(video_id: str) -> Path | None:
    path = _cached_video_path(video_id)
    if not path.exists():
        return None
    age = time.time() - path.stat().st_mtime
    if age > VIDEO_CACHE_TTL or path.stat().st_size < 1000:
        path.unlink(missing_ok=True)
        return None
    return path


def _download_to_cache(video_id: str, tiktok_url: str) -> Path | None:
    if not tiktok_url.startswith(("https://www.tiktok.com/", "https://vm.tiktok.com/")):
        return None
    outpath = _cached_video_path(video_id)
    temporary = outpath.with_suffix(".part")
    acquired = _DOWNLOAD_SEMAPHORE.acquire(timeout=10)
    if not acquired:
        return None
    try:
        completed = subprocess.run(
            [
                "yt-dlp", "-o", str(temporary),
                "--format", "mp4/best[height<=720]",
                "--no-warnings", "--no-playlist", "--no-progress",
                "--max-filesize", "50M", tiktok_url,
            ],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
        if completed.returncode == 0 and temporary.exists() and temporary.stat().st_size > 1000:
            os.replace(temporary, outpath)
            return outpath
    except Exception:
        pass
    finally:
        _DOWNLOAD_SEMAPHORE.release()
    temporary.unlink(missing_ok=True)
    return None


class ScraperAPI(BaseHTTPRequestHandler):
    comments: list[dict] = []
    videos: list[dict] = []
    stats: dict = {}
    _url_index: dict[str, str] = {}

    @classmethod
    def reload(cls):
        _APPROVED_MATCHES.clear()
        _APPROVED_MATCHES.update(_load_approved_matches())
        cls.comments = _load_comments()
        cls.videos = _unique_videos(cls.comments)
        cls.stats = _summary(cls.comments)
        cls._url_index = {
            str(video["id"]): str(video.get("url") or "")
            for video in cls.videos
            if video.get("url")
        }

    def _authorized(self) -> bool:
        if not SCRAPER_INTERNAL_SECRET:
            return self.client_address[0] in {"127.0.0.1", "::1"}
        supplied = self.headers.get("X-Scraper-Internal-Secret", "")
        return hmac.compare_digest(supplied.encode("utf-8"), SCRAPER_INTERNAL_SECRET.encode("utf-8"))

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(self, path: Path, content_type: str):
        try:
            size = path.stat().st_size
            start = 0
            end = size - 1
            range_header = self.headers.get("Range", "")
            partial = False
            if range_header.startswith("bytes="):
                match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
                if not match:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.end_headers()
                    return
                left, right = match.groups()
                if left:
                    start = int(left)
                    end = int(right) if right else size - 1
                elif right:
                    suffix = min(size, int(right))
                    start = size - suffix
                if start < 0 or end < start or start >= size:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.end_headers()
                    return
                end = min(end, size - 1)
                partial = True

            length = end - start + 1
            self.send_response(206 if partial else 200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(length))
            self.send_header("Accept-Ranges", "bytes")
            if partial:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Cache-Control", "private, max-age=3600")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            with open(path, "rb") as handle:
                handle.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = handle.read(min(65536, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
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
        if not _VIDEO_ID_RE.fullmatch(video_id):
            self._json({"error": "Invalid video id"}, 400)
            return
        cached = _get_cached_video(video_id)
        if cached:
            self._serve_file(cached, "video/mp4")
            return

        source_url = self._url_index.get(video_id, "")
        if not source_url:
            self._json({"error": "External media source unavailable"}, 404)
            return

        lock = _cache_lock(video_id)
        with lock:
            cached = _get_cached_video(video_id)
            if not cached:
                cached = _download_to_cache(video_id, source_url)
        if cached:
            self._serve_file(cached, "video/mp4")
            return
        self._json({"error": "External stream unavailable"}, 502)

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/")

        # Health is intentionally the only unauthenticated endpoint. Docker/Coolify
        # can monitor process liveness without learning research data.
        if path == "/api/health":
            self._json({"ok": True})
            return

        if not self._authorized():
            self._json({"error": "Unauthorized"}, 401)
            return

        if path == "/api/admin/refresh-status":
            with _REFRESH_LOCK:
                state = dict(_REFRESH_STATE)
            state["autoRefreshEnabled"] = AUTO_REFRESH_ENABLED
            state["autoRefreshHourUtc"] = AUTO_REFRESH_HOUR
            self._json(state)
            return
        if path.startswith("/api/stream/"):
            self._stream_video(path.split("/api/stream/", 1)[1])
            return

        if path.startswith("/api/videos/") and path.endswith("/comments"):
            parts = path.split("/")
            video_id = parts[3] if len(parts) >= 5 else ""
            if not _VIDEO_ID_RE.fullmatch(video_id):
                self._json({"error": "Invalid video id"}, 400)
                return
            comments = _comments_for_video(self.comments, video_id)
            self._json({"videoId": video_id, "comments": comments, "count": len(comments)})
            return

        if path.startswith("/api/videos/") and len(path.split("/")) == 4:
            video_id = path.split("/")[3]
            if not _VIDEO_ID_RE.fullmatch(video_id):
                self._json({"error": "Invalid video id"}, 400)
                return
            for video in self.videos:
                if video["id"] == video_id:
                    self._json({**video, "comments": _comments_for_video(self.comments, video_id)})
                    return
            self._json({"error": "Video not found"}, 404)
            return

        if path == "/api/videos":
            self._json({"videos": self.videos, "count": len(self.videos)})
        elif path == "/api/comments":
            self._json({"comments": self.comments[:200], "count": len(self.comments)})
        elif path == "/api/stats":
            self._json(self.stats)
        elif path == "/api/reload":
            # Operational endpoint remains internal-secret protected and is not
            # exposed by the browser proxy.
            self.reload()
            self._json({"ok": True, "message": "Data reloaded"})
        elif path in {"", "/"}:
            self._json({"service": "ORKY external research bridge", "dataAvailable": len(self.comments) > 0})
        else:
            self._json({"error": "Not found"}, 404)

    def _product_match_payload(self, body_len: int) -> dict:
        payload = {}
        if body_len:
            try:
                payload = json.loads(self.rfile.read(body_len).decode("utf-8") or "{}")
            except (ValueError, UnicodeDecodeError):
                payload = {}
        if not isinstance(payload, dict):
            payload = {}
        return payload

    def _handle_product_matches_write(self, video_id: str, body_len: int) -> bool:
        """POST /api/videos/<id>/product-matches — approuve un produit Orchidy."""
        if not _VIDEO_ID_RE.fullmatch(video_id):
            self._json({"error": "Invalid video id"}, 400)
            return True
        payload = self._product_match_payload(body_len)
        item_id = str(payload.get("orchidyCatalogItemId") or "").strip()
        if not item_id:
            self._json({"error": "orchidyCatalogItemId required"}, 400)
            return True
        matches = _APPROVED_MATCHES.setdefault(video_id, [])
        matches[:] = [match for match in matches if match.get("orchidyCatalogItemId") != item_id]
        matches.append({
            "orchidyCatalogItemId": item_id,
            "variantKey": str(payload.get("variantKey") or "").strip(),
            "confidence": _safe_float(payload.get("confidence"), 1.0),
            "source": str(payload.get("source") or "manual").strip() or "manual",
            "status": "approved",
        })
        _save_approved_matches()
        for video in ScraperAPI.videos:
            if str(video.get("id")) == video_id:
                _attach_product_matches(video)
        self._json({"ok": True, "videoId": video_id, "productMatches": _APPROVED_MATCHES[video_id]})
        return True

    def _handle_product_matches_delete(self, video_id: str, body_len: int) -> bool:
        """DELETE /api/videos/<id>/product-matches — retire une approbation."""
        if not _VIDEO_ID_RE.fullmatch(video_id):
            self._json({"error": "Invalid video id"}, 400)
            return True
        query = urlparse(self.path).query
        item_id = str(dict(parse_qsl(query)).get("item") or "").strip()
        if not item_id:
            item_id = str(self._product_match_payload(body_len).get("orchidyCatalogItemId") or "").strip()
        if not item_id:
            self._json({"error": "item required"}, 400)
            return True
        matches = _APPROVED_MATCHES.get(video_id, [])
        before = len(matches)
        matches[:] = [match for match in matches if match.get("orchidyCatalogItemId") != item_id]
        if len(matches) != before:
            # Une vidéo sans approbation ne doit pas rester une clé vide.
            if not matches:
                _APPROVED_MATCHES.pop(video_id, None)
            _save_approved_matches()
        for video in ScraperAPI.videos:
            if str(video.get("id")) == video_id:
                _attach_product_matches(video)
        self._json({"ok": True, "videoId": video_id, "removed": len(matches) != before})
        return True

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        if not self._authorized():
            self._json({"error": "Unauthorized"}, 401)
            return

        parts = path.split("/")
        if len(parts) == 5 and parts[:3] == ["", "api", "videos"] and parts[4] == "product-matches":
            body_len = int(self.headers.get("Content-Length") or 0)
            self._handle_product_matches_write(parts[3], body_len)
            return

        if path == "/api/admin/refresh":
            # Régénère le catalogue (vraies vidéos + commentaires via Apify).
            # Coûteux : réservé au secret interne, jamais exposé au navigateur.
            body_len = int(self.headers.get("Content-Length") or 0)
            payload = {}
            if body_len:
                try:
                    payload = json.loads(self.rfile.read(body_len).decode("utf-8") or "{}")
                except (ValueError, UnicodeDecodeError):
                    payload = {}
            comments = int(payload.get("comments", REFRESH_COMMENTS) or 0)
            with _REFRESH_LOCK:
                already_running = _REFRESH_STATE.get("running")
            if already_running:
                self._json({"ok": False, "error": "Refresh already running"}, 409)
                return
            _run_catalog_refresh(comments_per_video=comments)
            self._json({"ok": True, "status": "started", "message": "Régénération lancée en arrière-plan."})
            return

        self._json({"error": "Not found"}, 404)

    def do_DELETE(self):
        path = urlparse(self.path).path.rstrip("/")
        if not self._authorized():
            self._json({"error": "Unauthorized"}, 401)
            return

        parts = path.split("/")
        if len(parts) == 5 and parts[:3] == ["", "api", "videos"] and parts[4] == "product-matches":
            body_len = int(self.headers.get("Content-Length") or 0)
            self._handle_product_matches_delete(parts[3], body_len)
            return

        self._json({"error": "Not found"}, 404)

    def log_message(self, format, *args):
        pass


def main():
    port = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[1] == "--port" else 8502
    if not SCRAPER_INTERNAL_SECRET:
        print("[SCRAPER API] WARNING: SCRAPER_INTERNAL_SECRET missing; only loopback requests are accepted")
    ScraperAPI.reload()
    print(
        f"[SCRAPER API] {ScraperAPI.stats.get('totalComments', 0)} comments, "
        f"{ScraperAPI.stats.get('totalVideos', 0)} videos"
    )
    # 0.0.0.0 is required for Docker service-to-service traffic. Authorization is
    # enforced at the application layer and the compose service has no public port.
    if AUTO_REFRESH_ENABLED:
        threading.Thread(target=_scheduler_loop, daemon=True, name="catalog-scheduler").start()
        print(f"[SCRAPER API] Daily auto-refresh ENABLED at {AUTO_REFRESH_HOUR}:00Z")
    else:
        print("[SCRAPER API] Daily auto-refresh disabled (set SCRAPER_AUTO_REFRESH=1 to enable)")
    server = ThreadingHTTPServer(("0.0.0.0", port), ScraperAPI)
    print(f"[SCRAPER API] Listening internally on :{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
