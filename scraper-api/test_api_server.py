import unittest
from unittest.mock import patch

import api_server


class ScraperVideoSourceTests(unittest.TestCase):
    def test_video_without_exported_url_uses_id_based_tiktok_source(self):
        comments = [{
            "video_id": "7670293981833612574",
            "video_title": "A real scraped video",
            "video_views": 100,
            "video_likes": 10,
            "video_duration": 12,
            "url": None,
            "video_url": None,
        }]

        with patch.object(api_server, "_load_comments", return_value=comments):
            api_server.ScraperAPI.reload()

        self.assertEqual(
            api_server.ScraperAPI.videos[0]["url"],
            "https://www.tiktok.com/@tiktok/video/7670293981833612574",
        )
        self.assertEqual(
            api_server.ScraperAPI._url_index["7670293981833612574"],
            "https://www.tiktok.com/@tiktok/video/7670293981833612574",
        )


if __name__ == "__main__":
    unittest.main()
