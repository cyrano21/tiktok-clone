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
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).parent
VIDEO_CACHE = Path(os.environ.get("VIDEO_CACHE_DIR", str(ROOT / "video_cache")))
VIDEO_CACHE_TTL = int(os.environ.get("VIDEO_CACHE_TTL_SECONDS", "86400"))
SCRAPER_INTERNAL_SECRET = os.environ.get("SCRAPER_INTERNAL_SECRET", "").strip()
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


def _load_comments():
    """Loads available research exports. JSON > CSV > XLSX."""
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


def _unique_videos(comments: list[dict]) -> list[dict]:
    seen: dict[str, dict] = {}
    for c in comments:
        vid = str(c.get("video_id") or "").strip()
        if not vid or not _VIDEO_ID_RE.fullmatch(vid):
            continue
        title = str(c.get("video_title") or "")
        if vid not in seen:
            seen[vid] = {
                "id": vid,
                "title": title,
                "views": _safe_int(c.get("video_views")),
                "likes": _safe_int(c.get("video_likes")),
                "duration": _safe_int(c.get("video_duration")),
                "commentCount": 0,
                "url": str(c.get("url") or c.get("video_url") or "").strip(),
                "thumbnailUrl": str(c.get("video_thumbnail") or c.get("cover_url") or "").strip(),
                "hashtags": _extract_hashtags(title),
                "creatorUsername": str(c.get("creator_username") or c.get("author_username") or "").strip(),
                "creatorDisplayName": str(c.get("creator_nickname") or c.get("author_nickname") or "").strip(),
                "creatorAvatarUrl": str(c.get("creator_avatar") or c.get("author_avatar") or "").strip(),
                "createdAt": c.get("video_created_at") or c.get("video_create_time") or "",
                "comments": [],
            }
        video = seen[vid]
        video["commentCount"] += 1
        for hashtag in _extract_hashtags(str(c.get("text") or "")):
            if hashtag not in video["hashtags"]:
                video["hashtags"].append(hashtag)
        video["comments"].append(_comment_public(c))
    return sorted(seen.values(), key=lambda item: item["views"], reverse=True)


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
    server = ThreadingHTTPServer(("0.0.0.0", port), ScraperAPI)
    print(f"[SCRAPER API] Listening internally on :{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
