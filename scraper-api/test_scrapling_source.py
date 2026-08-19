from __future__ import annotations

import scrapling_source


class _Values:
    def __init__(self, values):
        self._values = values

    def getall(self):
        return list(self._values)


class _Links:
    def __init__(self, hrefs):
        self.hrefs = hrefs

    def css(self, selector):
        assert selector == "::attr(href)"
        return _Values(self.hrefs)


class _ProfilePage:
    def __init__(self, hrefs, fail_first=False):
        self.hrefs = hrefs
        self.fail_first = fail_first
        self.calls = []

    def css(self, selector, **kwargs):
        self.calls.append((selector, kwargs))
        assert selector == 'a[href*="/video/"]'
        if kwargs.get("auto_save") and self.fail_first:
            return []
        return _Links(self.hrefs)


class _MetaValue:
    def __init__(self, value):
        self.value = value

    def get(self):
        return self.value


class _MetaPage:
    VALUES = {
        'meta[property="og:title"]::attr(content)': "@creator on TikTok",
        'meta[property="og:description"]::attr(content)': "A public caption",
        'meta[property="og:image"]::attr(content)': "https://cdn.example/cover.jpg",
        'meta[name="author"]::attr(content)': "creator",
    }

    def css(self, selector):
        return _MetaValue(self.VALUES.get(selector, ""))


def test_video_id_from_url():
    assert scrapling_source.video_id_from_url(
        "https://www.tiktok.com/@creator/video/1234567890"
    ) == "1234567890"
    assert scrapling_source.video_id_from_url("https://example.com/no-video") == ""


def test_profile_discovery_deduplicates_and_canonicalizes(monkeypatch):
    page = _ProfilePage(
        [
            "/@creator/video/111",
            "https://www.tiktok.com/@creator/video/111?is_copy_url=1",
            "/@creator/video/222",
            "/not-a-video",
        ]
    )
    monkeypatch.setattr(scrapling_source, "_fetch", lambda _url: page)

    assert scrapling_source.discover_profile_video_urls("@creator", 10) == [
        "https://www.tiktok.com/@creator/video/111",
        "https://www.tiktok.com/@creator/video/222",
    ]
    assert page.calls[0][1]["auto_save"] is True
    assert page.calls[0][1]["identifier"] == "orky:tiktok:profile-video-links"


def test_profile_discovery_tries_adaptive_after_empty_saved_selector(monkeypatch):
    page = _ProfilePage(["/@creator/video/333"], fail_first=True)
    monkeypatch.setattr(scrapling_source, "_fetch", lambda _url: page)

    assert scrapling_source.discover_profile_video_urls("creator", 1) == [
        "https://www.tiktok.com/@creator/video/333"
    ]
    assert page.calls[1][1]["adaptive"] is True
    assert page.calls[1][1]["identifier"] == "orky:tiktok:profile-video-links"


def test_public_video_metadata(monkeypatch):
    monkeypatch.setattr(scrapling_source, "_fetch", lambda _url: _MetaPage())
    assert scrapling_source.fetch_public_video_metadata(
        "https://www.tiktok.com/@creator/video/123"
    ) == {
        "title": "A public caption",
        "thumbnail": "https://cdn.example/cover.jpg",
        "author": "creator",
        "author_name": "creator",
    }
