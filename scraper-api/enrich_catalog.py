"""Enrichit le catalogue vidéo ORKY avec ~10 vraies vidéos TikTok par thème.

Usage: python enrich_catalog.py [--per 10] [--comments 6] [--workers 4] [--out comments.json] [--apify] [--profiles]

Mode par défaut : recherche par HASHTAG via l'actor Apify clockworks/tiktok-scraper
(le catalogue suit les tendances réelles de chaque thème). Chaque catégorie
Discover (Trending, Music, Comedy, Sports, Food, Beauty) est mappée sur des
hashtags tendance ; l'actor retourne les vidéos les plus virales de chaque tag
avec vraies stats, miniatures, hashtags et créateurs.

--comments N (défaut 0) : récupère en plus N VRAIS commentaires TikTok par
vidéo via l'actor Apify clockworks/tiktok-comments-scraper (5 $/1 000), en
parallèle (--workers). Chaque commentaire devient une ligne du comments.json.

Fallback (--profiles, ou sans token Apify) : listing des profils officiels du
thème via yt-dlp (les pages tag de TikTok sont bloquées pour yt-dlp).

Écrit un comments.json au format attendu par l'API scraper (1 ligne = 1
commentaire ; les vidéos sont regroupées par video_id).
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).parent
APIFY_TOKEN = os.environ.get("APIFY_TOKEN") or ""
APIFY_ACTOR = "clockworks~tiktok-scraper"
APIFY_API = "https://api.apify.com/v2"

# Onglets Discover d'ORKY → hashtags tendance + profils officiels du thème.
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

# Mots-clés de catégorie utilisés par le filtre Discover d'ORKY (discoverService).
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
    if not token:
        env_path = ROOT / ".env"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                if line.startswith("APIFY_TOKEN="):
                    token = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    return token


def _apify_request(path: str, method: str = "GET", payload=None) -> dict:
    token = _load_token()
    sep = "&" if "?" in path else "?"
    url = f"{APIFY_API}{path}{sep}token={token}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"} if data else {})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())


def apify_search_hashtag(tag: str, count: int) -> list[dict]:
    """Lance un run Apify sur un hashtag et retourne les vidéos normalisées."""
    start = _apify_request(
        f"/acts/{APIFY_ACTOR}/runs", method="POST",
        payload={
            "hashtags": [tag],
            "resultsPerPage": count,
        },
    )
    run_id = start.get("data", {}).get("id")
    if not run_id:
        print(f"  ! #{tag}: run non démarré ({start})")
        return []

    # Poll
    status = "RUNNING"
    for _ in range(40):
        time.sleep(10)
        d = _apify_request(f"/actor-runs/{run_id}").get("data", {})
        status = d.get("status", "RUNNING")
        if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            break
    if status != "SUCCEEDED":
        print(f"  ! #{tag}: run {status}")
        return []

    items = _apify_request(f"/actor-runs/{run_id}/dataset/items?clean=true")
    out = []
    for it in items if isinstance(items, list) else []:
        vid = str(it.get("id") or "").strip()
        if not vid:
            continue
        am = it.get("authorMeta") or {}
        vm = it.get("videoMeta") or {}
        out.append({
            "id": vid,
            "title": str(it.get("text") or ""),
            "thumbnail": str(vm.get("coverUrl") or vm.get("originalCoverUrl") or ""),
            "views": int(it.get("playCount") or 0),
            "likes": int(it.get("diggCount") or 0),
            "duration": int(vm.get("duration") or 0),
            "author": str(am.get("name") or ""),
            "author_name": str(am.get("nickName") or am.get("name") or ""),
            "create_time": str(it.get("createTimeISO") or ""),
            "url": str(it.get("webVideoUrl") or ""),
            "hashtags": [h.get("name") for h in (it.get("hashtags") or []) if h.get("name")],
        })
    return out


def fetch_video_comments(video: dict, count: int) -> list[dict]:
    """Récupère `count` vrais commentaires TikTok pour une vidéo (Apify clockworks).

    Retourne des lignes au format comments.json (chaque ligne = 1 commentaire,
    avec les champs video_* de la vidéo). Vide si le run échoue.
    """
    sys.path.insert(0, str(ROOT))
    from apify_source import get_token, run_actor, normalize_comments, ACTOR_COMMENTS

    token = get_token()
    if not token:
        return []
    url = video.get("url") or f"https://www.tiktok.com/video/{video['id']}"
    try:
        items = run_actor(ACTOR_COMMENTS, url, count, token, logger=lambda *a, **k: None,
                          poll_interval=5, timeout_seconds=150)
        comments = normalize_comments(items, url)
    except Exception:
        return []

    rows = []
    for i, c in enumerate(comments[:count]):
        rows.append({
            "cid": f"c-{video['id']}-{i}",
            "text": c.get("text") or "",
            "username": c.get("username") or "",
            "nickname": c.get("nickname") or c.get("username") or "",
            "likes": c.get("likes") or 0,
            "reply_count": c.get("reply_count") or 0,
            "create_time": c.get("create_time") or 0,
            "replies": c.get("replies") or [],
            "video_id": video["id"],
            "video_title": video.get("title") or "",
            "video_views": video.get("views") or 0,
            "video_likes": video.get("likes") or 0,
            "video_duration": video.get("duration") or 0,
            "video_thumbnail": video.get("thumbnail") or "",
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


def extract_profile_videos(username: str, limit: int) -> list[dict]:
    """Fallback yt-dlp : liste les vidéos d'un profil (les pages tag sont bloquées)."""
    from yt_dlp import YoutubeDL

    profile_url = f"https://www.tiktok.com/@{username}"
    entries: list[dict] = []
    try:
        with YoutubeDL({"quiet": True, "no_warnings": True,
                        "extract_flat": "in_playlist", "skip_download": True,
                        "playlistend": limit, "socket_timeout": 20}) as ydl:
            info = ydl.extract_info(profile_url, download=False)
        entries = (info or {}).get("entries") or []
    except Exception as exc:
        print(f"  ! @{username}: list failed ({str(exc)[:80]})")
        return []

    out = []
    for entry in entries:
        vid = entry.get("id")
        if not vid:
            continue
        url = entry.get("url") or f"https://www.tiktok.com/@{username}/video/{vid}"
        meta = {"id": str(vid), "url": url}
        try:
            with YoutubeDL({"skip_download": True, "quiet": True,
                            "no_warnings": True, "noplaylist": True,
                            "socket_timeout": 20}) as ydl2:
                full = ydl2.extract_info(url, download=False)
            meta.update({
                "title": str(full.get("title") or ""),
                "thumbnail": str(full.get("thumbnail") or ""),
                "views": int(full.get("view_count") or 0),
                "likes": int(full.get("like_count") or 0),
                "duration": int(full.get("duration") or 0),
                "author": str(full.get("uploader_id") or full.get("uploader") or username),
                "author_name": str(full.get("uploader") or username),
                "create_time": str(full.get("timestamp") or ""),
                "hashtags": [],
            })
        except Exception:
            meta.update({"title": str(entry.get("title") or ""), "views": 0,
                         "likes": 0, "duration": 0, "author": username,
                         "author_name": username, "thumbnail": "",
                         "create_time": "", "hashtags": []})
        out.append(meta)
    return out


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
    total_cost = 0.0
    for category, cfg in CATEGORIES.items():
        kws = CATEGORY_KEYWORDS[category]
        cat_videos: list[dict] = []
        seen_ids: set[str] = set()
        print(f"== {category}")

        if use_apify:
            for tag in cfg["hashtags"]:
                if len(cat_videos) >= per:
                    break
                try:
                    vids = apify_search_hashtag(tag, per)
                except urllib.error.HTTPError as e:
                    print(f"  ! #{tag}: HTTP {e.code}")
                    vids = []
                except Exception as e:
                    print(f"  ! #{tag}: {str(e)[:80]}")
                    vids = []
                print(f"  #{tag}: {len(vids)} videos")
                for v in vids:
                    if v["id"] in seen_ids:
                        continue
                    seen_ids.add(v["id"])
                    v["_category"] = category
                    v["_keywords"] = kws
                    cat_videos.append(v)
        else:
            for username in cfg["profiles"]:
                if len(cat_videos) >= per:
                    break
                vids = extract_profile_videos(username, per)
                if not vids:
                    continue
                print(f"  @{username}: {len(vids)} videos")
                for v in vids:
                    if v["id"] in seen_ids:
                        continue
                    seen_ids.add(v["id"])
                    v["_category"] = category
                    v["_keywords"] = kws
                    cat_videos.append(v)

        cat_videos = cat_videos[:per]
        all_videos.extend(cat_videos)
        print(f"  => {len(cat_videos)} videos kept for {category}")

    if not all_videos:
        print("[ERROR] No videos fetched at all")
        return 1

    rows: list[dict] = []
    for v in all_videos:
        title = v["title"]
        vid = v["id"]
        hashtags = v.get("hashtags") or []
        kws = v.get("_keywords") or []
        # Hashtags réels du post + mots-clés de catégorie
        merged = list(dict.fromkeys([h.lower() for h in hashtags] + kws))
        v["hashtags"] = merged
        # La ligne "post" garantit la présence de la vidéo au catalogue.
        rows.append({
            "cid": f"feed-{vid}",
            "text": title or f"Video by @{v['author']}",
            "username": v["author"] or "tiktok",
            "nickname": v["author_name"] or v["author"] or "tiktok",
            "likes": v["likes"],
            "reply_count": 0,
            "create_time": v["create_time"] or 0,
            "video_id": vid,
            "video_title": title,
            "video_views": v["views"],
            "video_likes": v["likes"],
            "video_duration": v["duration"],
            "video_thumbnail": v["thumbnail"],
            "video_url": v["url"],
            "video_author_username": v["author"],
            "video_author_nickname": v["author_name"],
            "author_username": v["author"],
            "author_nickname": v["author_name"],
            "video_created_at": v["create_time"],
            "_category": v["_category"],
            "_category_keywords": kws,
            "hashtags": merged,
        })

    # Vrais commentaires par vidéo (option --comments N)
    if comments_per_video > 0:
        print(f"\n== Fetching {comments_per_video} real comments per video "
              f"({len(all_videos)} videos, {workers} workers)...")
        done = 0
        with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
            futures = {
                pool.submit(fetch_video_comments, v, comments_per_video): v
                for v in all_videos
            }
            for fut in as_completed(futures):
                v = futures[fut]
                try:
                    extra = fut.result()
                except Exception:
                    extra = []
                rows.extend(extra)
                done += 1
                n = len(extra)
                print(f"  [{done}/{len(all_videos)}] {v['id']}: {n} comments")
                sys.stdout.flush()
        real = sum(1 for r in rows if r["cid"].startswith("c-"))
        print(f"  => {real} real comments fetched")

    if not rows:
        print("[ERROR] No data written")
        return 1

    out_path.write_text(json.dumps(rows, ensure_ascii=False, indent=1),
                        encoding="utf-8")
    print(f"\n[OK] {len(rows)} comment rows written to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
