"""Resilient public-page discovery helpers for ORKY.

Scrapling is intentionally a fallback/enrichment layer. Official APIs and yt-dlp
remain authoritative where they expose structured media metadata. This module
only reads public HTML and never turns scraped identities into native ORKY data.
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

_VIDEO_RE = re.compile(r"/video/(\d+)")


def _first(values) -> str:
    if not values:
        return ""
    value = values[0] if isinstance(values, (list, tuple)) else values
    return str(value or "").strip()


def _meta(page, selector: str) -> str:
    try:
        return str(page.css(selector).get() or "").strip()
    except Exception:
        return ""


def discover_profile_video_urls(username: str, limit: int = 10) -> list[str]:
    """Discover public TikTok video URLs from a profile page.

    This is a best-effort fallback for cases where yt-dlp can no longer enumerate
    a profile. It deliberately returns only URLs; media download remains yt-dlp's
    responsibility.
    """
    username = str(username or "").strip().lstrip("@")
    if not username or limit <= 0:
        return []

    from scrapling.fetchers import FetcherSession

    profile_url = f"https://www.tiktok.com/@{username}"
    with FetcherSession(impersonate="chrome") as session:
        page = session.get(profile_url, stealthy_headers=True)

    try:
        hrefs = page.css('a[href*="/video/"]::attr(href)', auto_save=True).getall()
    except Exception:
        hrefs = page.css('a[href*="/video/"]::attr(href)').getall()

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

    from scrapling.fetchers import FetcherSession

    with FetcherSession(impersonate="chrome") as session:
        page = session.get(url, stealthy_headers=True)

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
