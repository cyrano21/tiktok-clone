import io
import json
import unittest
from unittest.mock import patch

import api_server


CATALOG = [
    {"id": "lampe-sunset-projection", "title": "Lampe Sunset Projection LED", "images": [], "price": 12.99, "currency": "EUR"},
    {"id": "casque-audio-bluetooth", "title": "Casque Audio Bluetooth Sans Fil", "images": [], "price": 19.99, "currency": "EUR"},
    {"id": "tapis-de-bain", "title": "Tapis de bain antidérapant", "images": [], "price": 8.5, "currency": "EUR"},
]


def make_handler(video_id="7200000000000000001"):
    handler = object.__new__(api_server.ScraperAPI)
    handler.path = f"/api/videos/{video_id}/product-matches"
    handler.client_address = ("127.0.0.1", 12345)
    handler.headers = {"Content-Length": "0"}
    handler.rfile = io.BytesIO(b"")
    handler.responses = []
    handler._json = lambda data, status=200: handler.responses.append((data, status))
    return handler


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

    def test_video_carries_provider_shares_saves_and_sound(self):
        comments = [{
            "video_id": "7200000000000000001",
            "video_title": "Sunset lamp unboxing",
            "video_views": 1200000,
            "video_likes": 85000,
            "video_shares": 676100,
            "video_saves": 476500,
            "video_duration": 12,
            "video_music_id": "music-1",
            "video_music_title": "Sunset",
            "video_music_artist": "fang",
            "video_music_cover": "https://cdn.example.test/cover.jpg",
        }]

        with patch.object(api_server, "_load_comments", return_value=comments):
            api_server.ScraperAPI.reload()

        video = api_server.ScraperAPI.videos[0]
        self.assertEqual(video["shares"], 676100)
        self.assertEqual(video["saves"], 476500)
        self.assertEqual(video["sound"], {
            "id": "music-1",
            "title": "Sunset",
            "artist": "fang",
            "coverUrl": "https://cdn.example.test/cover.jpg",
        })

    def test_video_without_provider_metrics_omits_them(self):
        comments = [{
            "video_id": "7200000000000000002",
            "video_title": "No extra metrics",
            "video_views": 100,
            "video_likes": 10,
            "video_duration": 5,
        }]

        with patch.object(api_server, "_load_comments", return_value=comments):
            api_server.ScraperAPI.reload()

        video = api_server.ScraperAPI.videos[0]
        self.assertNotIn("shares", video)
        self.assertNotIn("saves", video)
        self.assertIsNone(video.get("sound"))

    def test_lexical_score_ranks_relevant_products(self):
        query = "Lampe sunset projection"
        scores = {product["id"]: api_server._lexical_score(query, product["title"]) for product in CATALOG}
        self.assertGreater(scores["lampe-sunset-projection"], scores["casque-audio-bluetooth"])
        self.assertGreater(scores["lampe-sunset-projection"], 0.45)
        self.assertEqual(scores["tapis-de-bain"], 0.0)

    def test_auto_match_emits_suggested_product_matches(self):
        comments = [{
            "video_id": "7200000000000000004",
            "video_title": "Découvrez la lampe sunset projection !",
            "video_views": 5000,
            "video_likes": 400,
            "video_duration": 10,
        }]
        with patch.object(api_server, "AUTO_MATCH_ENABLED", True), \
                patch.object(api_server, "_load_orchidy_catalog", return_value=CATALOG):
            with patch.object(api_server, "_load_comments", return_value=comments):
                api_server.ScraperAPI.reload()

        video = api_server.ScraperAPI.videos[0]
        matches = video["productMatches"]
        self.assertTrue(matches)
        self.assertEqual(matches[0]["orchidyCatalogItemId"], "lampe-sunset-projection")
        self.assertEqual(matches[0]["status"], "suggested")
        self.assertEqual(matches[0]["source"], "catalog_lexical_match")

    def test_auto_match_disabled_by_default(self):
        comments = [{
            "video_id": "7200000000000000005",
            "video_title": "Une vidéo quelconque",
            "video_views": 100,
            "video_likes": 10,
            "video_duration": 5,
        }]
        with patch.object(api_server, "AUTO_MATCH_ENABLED", False):
            with patch.object(api_server, "_load_comments", return_value=comments):
                api_server.ScraperAPI.reload()
        self.assertNotIn("productMatches", api_server.ScraperAPI.videos[0])

    def test_approved_matches_win_over_suggestions(self):
        comments = [{
            "video_id": "7200000000000000006",
            "video_title": "Lampe sunset projection test",
            "video_views": 100,
            "video_likes": 10,
            "video_duration": 5,
        }]
        approved = {
            "7200000000000000006": [{
                "orchidyCatalogItemId": "casque-audio-bluetooth",
                "variantKey": "",
                "confidence": 1.0,
                "source": "manual",
                "status": "approved",
            }]
        }
        with patch.object(api_server, "AUTO_MATCH_ENABLED", True), \
                patch.object(api_server, "_load_orchidy_catalog", return_value=CATALOG), \
                patch.object(api_server, "_load_approved_matches", return_value=approved):
            with patch.object(api_server, "_load_comments", return_value=comments):
                api_server.ScraperAPI.reload()

        video = api_server.ScraperAPI.videos[0]
        matches = video["productMatches"]
        # L'approbation prime ; la suggestion auto ne duplique jamais un produit
        # déjà approuvé, mais peut proposer un AUTRE produit.
        self.assertEqual(matches[0]["status"], "approved")
        self.assertEqual(matches[0]["orchidyCatalogItemId"], "casque-audio-bluetooth")
        self.assertEqual(
            [m["orchidyCatalogItemId"] for m in matches].count("casque-audio-bluetooth"),
            1,
        )
        self.assertIn("suggested", [m["status"] for m in matches])

    def test_post_approves_and_persists_match(self):
        comments = [{
            "video_id": "7200000000000000007",
            "video_title": "Casque audio bluetooth unboxing",
            "video_views": 100,
            "video_likes": 10,
            "video_duration": 5,
        }]
        with patch.object(api_server, "AUTO_MATCH_ENABLED", True), \
                patch.object(api_server, "_load_orchidy_catalog", return_value=CATALOG), \
                patch.object(api_server, "_load_approved_matches", return_value={}), \
                patch.object(api_server, "_save_approved_matches") as save_mock:
            with patch.object(api_server, "_load_comments", return_value=comments):
                api_server.ScraperAPI.reload()

            handler = make_handler("7200000000000000007")
            body = json.dumps({"orchidyCatalogItemId": "casque-audio-bluetooth", "confidence": 0.9}).encode()
            handler.headers = {"Content-Length": str(len(body))}
            handler.rfile = io.BytesIO(body)
            handler._handle_product_matches_write("7200000000000000007", len(body))

            data, status = handler.responses[0]
            self.assertEqual(status, 200)
            self.assertTrue(data["ok"])
            save_mock.assert_called_once()
            video = api_server.ScraperAPI.videos[0]
            self.assertEqual(video["productMatches"][0]["status"], "approved")
            self.assertEqual(video["productMatches"][0]["orchidyCatalogItemId"], "casque-audio-bluetooth")

    def test_delete_removes_approved_match(self):
        comments = [{
            "video_id": "7200000000000000008",
            "video_title": "Casque audio bluetooth unboxing",
            "video_views": 100,
            "video_likes": 10,
            "video_duration": 5,
        }]
        approved = {
            "7200000000000000008": [{
                "orchidyCatalogItemId": "casque-audio-bluetooth",
                "variantKey": "",
                "confidence": 1.0,
                "source": "manual",
                "status": "approved",
            }]
        }
        with patch.object(api_server, "AUTO_MATCH_ENABLED", True), \
                patch.object(api_server, "_load_orchidy_catalog", return_value=CATALOG), \
                patch.object(api_server, "_load_approved_matches", return_value=approved), \
                patch.object(api_server, "_save_approved_matches") as save_mock:
            with patch.object(api_server, "_load_comments", return_value=comments):
                api_server.ScraperAPI.reload()

            handler = make_handler("7200000000000000008")
            handler.path += "?item=casque-audio-bluetooth"
            handler._handle_product_matches_delete("7200000000000000008", 0)

            data, status = handler.responses[0]
            self.assertEqual(status, 200)
            self.assertTrue(data["removed"])
            save_mock.assert_called_once()
            video = api_server.ScraperAPI.videos[0]
            # L'approbation est retirée ; l'auto-match peut re-suggérer le produit.
            self.assertNotIn(
                "casque-audio-bluetooth",
                [m["orchidyCatalogItemId"] for m in video["productMatches"] if m["status"] == "approved"],
            )

    def test_optional_metrics_merged_from_later_comment_rows(self):
        comments = [
            {
                "video_id": "7200000000000000003",
                "video_title": "Merged metrics",
                "video_views": 100,
                "video_likes": 10,
                "video_duration": 5,
                "cid": "feed-3",
                "text": "post",
            },
            {
                "video_id": "7200000000000000003",
                "video_title": "Merged metrics",
                "video_shares": 42,
                "video_music_title": "Late row sound",
                "cid": "c-3-1",
                "text": "comment",
            },
        ]

        with patch.object(api_server, "_load_comments", return_value=comments):
            api_server.ScraperAPI.reload()

        video = api_server.ScraperAPI.videos[0]
        self.assertEqual(video["shares"], 42)
        self.assertEqual(video["sound"]["title"], "Late row sound")
        self.assertEqual(video["commentCount"], 2)


if __name__ == "__main__":
    unittest.main()
