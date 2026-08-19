"""Resilient public-page discovery helpers for ORKY.

Scrapling is intentionally a fallback/enrichment layer. Official APIs and yt-dlp
remain authoritative where they expose structured media metadata. This module
only reads public HTML and never turns scraped identities into native ORKY data.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from urllib.parse import urljoin

_VIDEO_RE = re.compile(r"/video/(\d+)")
_STORAGE_FILE = os.environ.get("SCRAPLING_STORAGE_FILE", "/app/data/scrapling-adaptive.db")


def _fetch(url: str):
    from scrapling.fetchers import Fetcher

    Path(_STORAGE_FILE).parent.mkdir(parents=True, exist_ok=True)
    Fetcher.configure(
        adaptive=True,
        storage_args={"storage_file": _STORAGE_FILE},
        keep_comments=False,
        keep_cdata=False,
    )
    return Fetcher.get(url, impersonate="chrome", stealthy_headers=True)


def _meta(page, selector: str) -> str:
    try:
        return str(page.css(selector).get() or "").strip()
    except Exception:
        return ""


def discover_profile_video_urls(username: str, limit: int = 10) -> list[str]:
    """Discover public TikTok video URLs from a profile page."""
    username = str(username or "").strip().lstrip("@")
    if not username or limit <= 0:
        return []

    profile_url = f"https://www.tiktok.com/@{username}"
    page = _fetch(profile_url)
    selector = 'a[href*="/video/"]::attr(href)'
    try:
        hrefs = page.css(selector, auto_save=True, identifier="orky:tiktok:profile-video-links").getall()
    except Exception:
        hrefs = []
    if not hrefs:
        try:
            hrefs = page.css(selector, adaptive=True, identifier="orky:tiktok:profile-video-links").getall()
        except Exception:
            hrefs = page.css(selector).getall()

    output: list[str] = []
    seen: set[str] = set()
    for href in hrefs:
        url = urljoin(profile_url, str(href or "").strip())
        match = _VIDEO_RE.search(url)
        if not match:
            continue
        canonical = f"https://www.tiktok.com/@{username}/video/{match.group(1)}"
        if canonical in seen:
            continue
        seen.add(canonical)
        output.append(canonical)
        if len(output) >= limit:
            break
    return output


def fetch_public_video_metadata(url: str) -> dict:
    """Extract lightweight OpenGraph metadata from a public video page."""
    if not str(url or "").startswith("https://"):
        return {}

    page = _fetch(url)
    title = _meta(page, 'meta[property="og:title"]::attr(content)')
    description = _meta(page, 'meta[property="og:description"]::attr(content)')
    image = _meta(page, 'meta[property="og:image"]::attr(content)')
    author = _meta(page, 'meta[name="author"]::attr(content)')
    if not author and " on TikTok" in title:
        author = title.split(" on TikTok", 1)[0].strip().lstrip("@")

    return {
        "title": description or title,
        "thumbnail": image,
        "author": author,
        "author_name": author,
    }


def video_id_from_url(url: str) -> str:
    match = _VIDEO_RE.search(str(url or ""))
    return match.group(1) if match else ""
