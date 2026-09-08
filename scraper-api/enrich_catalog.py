"""Enrichit le catalogue vidéo ORKY avec de vraies références TikTok.

Priorités de collecte :
1. Apify pour les tendances par hashtag quand un token est configuré.
2. yt-dlp pour les profils officiels.
3. Scrapling pour redécouvrir les URLs publiques d'un profil ou récupérer les
   métadonnées OpenGraph lorsqu'un changement de DOM casse l'énumération yt-dlp.

Scrapling reste un fallback de recherche publique : il ne remplace ni l'API
TikTok, ni yt-dlp pour le média, ni les règles ORKY qui séparent strictement les
références externes des vidéos natives.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).parent
APIFY_TOKEN = os.environ.get("APIFY_TOKEN") or ""
APIFY_ACTOR = "clockworks~tiktok-scraper"
APIFY_API = "https://api.apify.com/v2"

CATEGORIES = {
    "Trending": {
        "hashtags": ["foryou", "viral", "trending"],
        "profiles": ["tiktok", "buzzfeed", "nowthis", "goodnews"],
    },
    "Music": {
        "hashtags": ["music", "newsong", "viralmusic"],
        "profiles": ["spotify", "universalmusicgroup", "warnermusic", "columbiarecords"],
    },
    "Comedy": {
        "hashtags": ["comedy", "funny", "skit", "prank"],
        "profiles": ["netflix", "primevideo", "hbo", "comedycentral"],
    },
    "Sports": {
        "hashtags": ["sports", "football", "basketball", "workout"],
        "profiles": ["espn", "nba", "nfl", "fifaworldcup", "nike"],
    },
    "Food": {
        "hashtags": ["recipe", "cooking", "food", "baking"],
        "profiles": ["tasty", "foodnetwork", "thedailymeal", "buzzfeedtasty"],
    },
    "Beauty": {
        "hashtags": ["beauty", "makeup", "skincare", "hairtok"],
        "profiles": ["sephora", "maybelline", "nyxcosmetics", "lorealparis"],
    },
}

CATEGORY_KEYWORDS = {
    "Trending": ["fyp", "foryou", "trending", "viral", "foryoupage"],
    "Music": ["music", "song", "sound", "remix", "cover"],
    "Comedy": ["comedy", "funny", "humor", "humour", "prank", "joke", "skit"],
    "Sports": ["sport", "football", "soccer", "basketball", "nba", "nfl", "fitness", "workout"],
    "Food": ["food", "recipe", "cooking", "cook", "tasty", "baking", "bake", "eat"],
    "Beauty": ["beauty", "makeup", "skincare", "hair", "glam", "cosmetics"],
}


def _load_token() -> str:
    token = APIFY_TOKEN
    if token:
        return token
    env_path = ROOT / ".env"
    if not env_path.exists():
        return ""
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("APIFY_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def _apify_request(path: str, method: str = "GET", payload=None):
    token = _load_token()
    sep = "&" if "?" in path else "?"
    url = f"{APIFY_API}{path}{sep}token={token}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data else {},
    )
    return json.loads(urllib.request.urlopen(req, timeout=120).read())


def apify_search_hashtag(tag: str, count: int) -> list[dict]:
    start = _apify_request(
        f"/acts/{APIFY_ACTOR}/runs",
        method="POST",
        payload={"hashtags": [tag], "resultsPerPage": count},
    )
    run_id = start.get("data", {}).get("id")
    if not run_id:
        return []

    status = "RUNNING"
    for _ in range(40):
        time.sleep(10)
        status = _apify_request(f"/actor-runs/{run_id}").get("data", {}).get("status", "RUNNING")
        if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            break
    if status != "SUCCEEDED":
        return []

    items = _apify_request(f"/actor-runs/{run_id}/dataset/items?clean=true")
    output: list[dict] = []
    for item in items if isinstance(items, list) else []:
        vid = str(item.get("id") or "").strip()
        if not vid:
            continue
        author = item.get("authorMeta") or {}
        video = item.get("videoMeta") or {}
        music = item.get("musicMeta") or {}
        output.append({
            "id": vid,
            "title": str(item.get("text") or ""),
            "thumbnail": str(video.get("coverUrl") or video.get("originalCoverUrl") or ""),
            "views": int(item.get("playCount") or 0),
            "likes": int(item.get("diggCount") or 0),
            "shares": int(item.get("shareCount") or 0),
            "saves": int(item.get("collectCount") or 0),
            "duration": int(video.get("duration") or 0),
            "author": str(author.get("name") or ""),
            "author_name": str(author.get("nickName") or author.get("name") or ""),
            "create_time": str(item.get("createTimeISO") or ""),
            "url": str(item.get("webVideoUrl") or ""),
            "hashtags": [h.get("name") for h in (item.get("hashtags") or []) if h.get("name")],
            "music": {
                "id": str(music.get("musicId") or ""),
                "title": str(music.get("musicName") or ""),
                "artist": str(music.get("musicAuthor") or ""),
                "cover": str(music.get("coverMedium") or music.get("coverLarge") or music.get("coverThumb") or ""),
            },
        })
    return output


def fetch_video_comments(video: dict, count: int) -> list[dict]:
    sys.path.insert(0, str(ROOT))
    from apify_source import ACTOR_COMMENTS, get_token, normalize_comments, run_actor

    if not get_token():
        return []
    url = video.get("url") or f"https://www.tiktok.com/video/{video['id']}"
    try:
        items = run_actor(
            ACTOR_COMMENTS,
            url,
            count,
            get_token(),
            logger=lambda *a, **k: None,
            poll_interval=5,
            timeout_seconds=150,
        )
        comments = normalize_comments(items, url)
    except Exception:
        return []

    rows = []
    for i, comment in enumerate(comments[:count]):
        rows.append({
            "cid": f"c-{video['id']}-{i}",
            "text": comment.get("text") or "",
            "username": comment.get("username") or "",
            "nickname": comment.get("nickname") or comment.get("username") or "",
            "likes": comment.get("likes") or 0,
            "reply_count": comment.get("reply_count") or 0,
            "create_time": comment.get("create_time") or 0,
            "replies": comment.get("replies") or [],
            "video_id": video["id"],
            "video_title": video.get("title") or "",
            "video_views": video.get("views") or 0,
            "video_likes": video.get("likes") or 0,
            "video_shares": video.get("shares") or 0,
            "video_saves": video.get("saves") or 0,
            "video_duration": video.get("duration") or 0,
            "video_thumbnail": video.get("thumbnail") or "",
            "video_music_id": (video.get("music") or {}).get("id") or "",
            "video_music_title": (video.get("music") or {}).get("title") or "",
            "video_music_artist": (video.get("music") or {}).get("artist") or "",
            "video_music_cover": (video.get("music") or {}).get("cover") or "",
            "video_url": url,
            "video_author_username": video.get("author") or "",
            "video_author_nickname": video.get("author_name") or video.get("author") or "",
            "author_username": video.get("author") or "",
            "author_nickname": video.get("author_name") or video.get("author") or "",
            "video_created_at": video.get("create_time") or "",
            "_category": video.get("_category") or "",
            "_category_keywords": video.get("_keywords") or [],
            "hashtags": video.get("hashtags") or [],
        })
    return rows


def _scrapling_profile_entries(username: str, limit: int) -> list[dict]:
    try:
        from scrapling_source import discover_profile_video_urls, video_id_from_url

        urls = discover_profile_video_urls(username, limit)
        return [
            {"id": video_id_from_url(url), "url": url, "title": ""}
            for url in urls
            if video_id_from_url(url)
        ]
    except Exception as exc:
        print(f"  ! @{username}: Scrapling discovery failed ({str(exc)[:80]})")
        return []


def _scrapling_metadata(url: str) -> dict:
    try:
        from scrapling_source import fetch_public_video_metadata

        return fetch_public_video_metadata(url)
    except Exception:
        return {}


def extract_profile_videos(username: str, limit: int) -> list[dict]:
    """Enumerate a profile with yt-dlp, then fall back to Scrapling discovery."""
    from yt_dlp import YoutubeDL

    profile_url = f"https://www.tiktok.com/@{username}"
    entries: list[dict] = []
    try:
        with YoutubeDL({
            "quiet": True,
            "no_warnings": True,
            "extract_flat": "in_playlist",
            "skip_download": True,
            "playlistend": limit,
            "socket_timeout": 20,
        }) as ydl:
            info = ydl.extract_info(profile_url, download=False)
        entries = (info or {}).get("entries") or []
    except Exception as exc:
        print(f"  ! @{username}: yt-dlp list failed ({str(exc)[:80]}); trying Scrapling")

    if not entries:
        entries = _scrapling_profile_entries(username, limit)
    if not entries:
        return []

    output: list[dict] = []
    for entry in entries[:limit]:
        vid = str(entry.get("id") or "").strip()
        if not vid:
            continue
        url = entry.get("url") or f"https://www.tiktok.com/@{username}/video/{vid}"
        meta = {"id": vid, "url": url}
        try:
            with YoutubeDL({
                "skip_download": True,
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "socket_timeout": 20,
            }) as ydl2:
                full = ydl2.extract_info(url, download=False)
            meta.update({
                "title": str(full.get("title") or ""),
                "thumbnail": str(full.get("thumbnail") or ""),
                "views": int(full.get("view_count") or 0),
                "likes": int(full.get("like_count") or 0),
                "shares": 0,
                "saves": 0,
                "duration": int(full.get("duration") or 0),
                "author": str(full.get("uploader_id") or full.get("uploader") or username),
                "author_name": str(full.get("uploader") or username),
                "create_time": str(full.get("timestamp") or ""),
                "hashtags": [],
                "music": {},
            })
        except Exception:
            public = _scrapling_metadata(url)
            meta.update({
                "title": public.get("title") or str(entry.get("title") or ""),
                "thumbnail": public.get("thumbnail") or "",
                "views": 0,
                "likes": 0,
                "shares": 0,
                "saves": 0,
                "duration": 0,
                "author": public.get("author") or username,
                "author_name": public.get("author_name") or public.get("author") or username,
                "create_time": "",
                "hashtags": [],
                "music": {},
            })
        output.append(meta)
    return output


def _arg_int(name: str, default: int) -> int:
    if name in sys.argv:
        try:
            return int(sys.argv[sys.argv.index(name) + 1])
        except (ValueError, IndexError):
            pass
    return default


def main() -> int:
    per = _arg_int("--per", 10)
    comments_per_video = _arg_int("--comments", 0)
    workers = _arg_int("--workers", 4)
    out_path = ROOT / "comments.json"
    if "--out" in sys.argv:
        out_path = ROOT / sys.argv[sys.argv.index("--out") + 1]

    use_apify = "--apify" in sys.argv or bool(_load_token())
    if "--profiles" in sys.argv:
        use_apify = False

    all_videos: list[dict] = []
    for category, cfg in CATEGORIES.items():
        keywords = CATEGORY_KEYWORDS[category]
        category_videos: list[dict] = []
        seen_ids: set[str] = set()
        print(f"== {category}")

        if use_apify:
            for tag in cfg["hashtags"]:
                if len(category_videos) >= per:
                    break
                try:
                    videos = apify_search_hashtag(tag, per)
                except urllib.error.HTTPError as exc:
                    print(f"  ! #{tag}: HTTP {exc.code}")
                    videos = []
                except Exception as exc:
                    print(f"  ! #{tag}: {str(exc)[:80]}")
                    videos = []
                print(f"  #{tag}: {len(videos)} videos")
                for video in videos:
                    if video["id"] in seen_ids:
                        continue
                    seen_ids.add(video["id"])
                    video["_category"] = category
                    video["_keywords"] = keywords
                    category_videos.append(video)
        else:
            for username in cfg["profiles"]:
                if len(category_videos) >= per:
                    break
                videos = extract_profile_videos(username, per)
                if not videos:
                    continue
                print(f"  @{username}: {len(videos)} videos")
                for video in videos:
                    if video["id"] in seen_ids:
                        continue
                    seen_ids.add(video["id"])
                    video["_category"] = category
                    video["_keywords"] = keywords
                    category_videos.append(video)

        category_videos = category_videos[:per]
        all_videos.extend(category_videos)
        print(f"  => {len(category_videos)} videos kept for {category}")

    if not all_videos:
        print("[ERROR] No videos fetched at all")
        return 1

    rows: list[dict] = []
    for video in all_videos:
        title = video.get("title") or ""
        vid = video["id"]
        keywords = video.get("_keywords") or []
        hashtags = video.get("hashtags") or []
        merged = list(dict.fromkeys([str(h).lower() for h in hashtags] + keywords))
        video["hashtags"] = merged
        rows.append({
            "cid": f"feed-{vid}",
            "text": title or f"Video by @{video.get('author') or 'tiktok'}",
            "username": video.get("author") or "tiktok",
            "nickname": video.get("author_name") or video.get("author") or "tiktok",
            "likes": video.get("likes") or 0,
            "reply_count": 0,
            "create_time": video.get("create_time") or 0,
            "video_id": vid,
            "video_title": title,
            "video_views": video.get("views") or 0,
            "video_likes": video.get("likes") or 0,
            "video_shares": video.get("shares") or 0,
            "video_saves": video.get("saves") or 0,
            "video_duration": video.get("duration") or 0,
            "video_thumbnail": video.get("thumbnail") or "",
            "video_music_id": (video.get("music") or {}).get("id") or "",
            "video_music_title": (video.get("music") or {}).get("title") or "",
            "video_music_artist": (video.get("music") or {}).get("artist") or "",
            "video_music_cover": (video.get("music") or {}).get("cover") or "",
            "video_url": video.get("url") or "",
            "video_author_username": video.get("author") or "",
            "video_author_nickname": video.get("author_name") or "",
            "author_username": video.get("author") or "",
            "author_nickname": video.get("author_name") or "",
            "video_created_at": video.get("create_time") or "",
            "_category": video.get("_category") or "",
            "_category_keywords": keywords,
            "hashtags": merged,
        })

    if comments_per_video > 0:
        print(f"\n== Fetching {comments_per_video} real comments per video ({len(all_videos)} videos, {workers} workers)...")
        with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
            futures = {pool.submit(fetch_video_comments, video, comments_per_video): video for video in all_videos}
            for index, future in enumerate(as_completed(futures), start=1):
                video = futures[future]
                try:
                    extra = future.result()
                except Exception:
                    extra = []
                rows.extend(extra)
                print(f"  [{index}/{len(all_videos)}] {video['id']}: {len(extra)} comments")
                sys.stdout.flush()

    out_path.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n[OK] {len(rows)} comment rows written to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
