"""Source Apify (secours payant optionnel) pour la collecte de commentaires.

Le pipeline par défaut scrape **localement** (gratuit, navigateur intégré).
Ce module permet de basculer sur Apify en cas de blocage TikTok : chaque run
est PAYANT (pay-per-result) et le dashboard affiche le coût estimé AVANT de
lancer. Rien n'est consommé tant qu'on n'utilise pas ce mode.

Architecture :
    run_actor          : POST /v2/acts/<actor>/runs puis polling du statut,
                        puis lecture du dataset (résultats)
    normalize_comments : convertit les items Apify vers le format comments.json
                        du scraper local (interopérable avec tout le pipeline :
                        dashboard, scoring, IA, veille).

Acteurs utilisés (pay-per-result, 2026) :
    - clockworks/tiktok-comments-scraper   5,00 $ / 1 000 résultats
    - apidojo/tiktok-comments-scraper      0,30 $ / 1 000 résultats

Fonctions pures (estimate_cost, normalize_comments) testables sans réseau.
"""

from __future__ import annotations

import datetime
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).parent
API_BASE = "https://api.apify.com/v2"
TOKEN_ENV = "APIFY_TOKEN"
ENV_FILE = BASE_DIR / ".env"

# Identifiants Apify au format `owner~acteur` (le format `owner/acteur`
# renvoie 404 sur l'API v2 — vérifié en réel le 05/08/2026).
ACTOR_COMMENTS = "clockworks~tiktok-comments-scraper"
ACTOR_CHEAP = "apidojo~tiktok-comments-scraper"

# Prix par 1 000 résultats (USD, d'après les pages acteurs Apify 2026).
PRICE_PER_1000 = {
    ACTOR_COMMENTS: 5.00,
    ACTOR_CHEAP: 0.30,
}


def get_token() -> str:
    """Token API Apify : variable d'environnement APIFY_TOKEN, puis .env.

    Même convention que la clé Groq (ai_summary) : on lit d'abord la variable
    d'environnement, puis le fichier .env du projet si présent.
    """
    token = os.getenv(TOKEN_ENV, "").strip()
    if token:
        return token
    if ENV_FILE.exists():
        try:
            for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith(TOKEN_ENV + "=") or line.startswith(TOKEN_ENV + " =") \
                        and "=" in line:
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
        except OSError:
            pass
    return ""


def estimate_cost(num_comments: int, actor: str = ACTOR_CHEAP) -> float:
    """Coût USD estimé d'un run (pur, testable)."""
    price = PRICE_PER_1000.get(actor, 0.30)
    return round(num_comments / 1000.0 * price, 2)


def _request(url: str, timeout: int = 60) -> dict:
    """GET JSON sur l'API Apify (levée en erreur réseau/HTTP)."""
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def check_token(token: str | None = None) -> tuple[bool, dict]:
    """Vérifie un token Apify via /v2/users/me (aucun coût).

    Retourne (ok, infos) : infos contient email, plan, crédit restant… en
    cas de succès, ou la raison de l'échec (token invalide, réseau).
    """
    from urllib.parse import quote

    token = (token or get_token()).strip()
    if not token:
        return False, {"error": "Token manquant (APIFY_TOKEN)."}
    url = f"{API_BASE}/users/me?token={quote(token, safe='')}"
    try:
        data = _request(url, timeout=30)
    except Exception as e:  # noqa: BLE001 — erreur lisible pour l'utilisateur
        return False, {"error": f"Impossible de contacter Apify ({e})."}
    info = data.get("data") or {}
    if not info:
        return False, {"error": "Token invalide ou expiré (réponse Apify vide)."}
    return True, {
        "email": info.get("email", "?"),
        "plan": info.get("plan", {}).get("id") if isinstance(info.get("plan"), dict)
        else info.get("plan", "?"),
        "credit": info.get("proxy", {}).get("credit") if isinstance(info.get("proxy"), dict)
        else None,
    }


def save_token_to_env(token: str) -> Path:
    """Écrit (ou met à jour) APIFY_TOKEN dans le fichier .env du projet.

    Permet à la veille planifiée (lancée sans navigateur) d'utiliser Apify.
    Retourne le chemin du fichier .env. N'écrase pas les autres clés.
    """
    token = token.strip()
    lines: list[str] = []
    replaced = False
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith(TOKEN_ENV + "=") or \
                    line.strip().startswith(TOKEN_ENV + " =") and "=" in line:
                lines.append(f"{TOKEN_ENV}={token}")
                replaced = True
            else:
                lines.append(line)
    if not replaced:
        lines.append(f"{TOKEN_ENV}={token}")
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return ENV_FILE


def run_actor(actor_id: str, post_url: str, max_comments: int, token: str,
              logger=print, poll_interval: float = 4.0,
              timeout_seconds: float = 300.0) -> list[dict]:
    """Lance l'acteur commentaires sur une vidéo et attend les résultats.

    Retourne la liste des items bruts Apify. Lève RuntimeError sur erreur
    réseau, run échoué, ou timeout.
    """
    from urllib.parse import quote

    encoded = quote(token, safe="")
    # Chaque acteur a SON format d'entrée (vérifié en réel le 05/08/2026) :
    #   - clockworks : postURLs + commentsPerPost (erreur « Input must
    #     contain postURLs... » sinon)
    #   - apidojo    : startUrls + maxComments (erreur « Start URLs must be
    #     provided » sinon)
    n = max(1, int(max_comments))
    if actor_id == ACTOR_COMMENTS:
        input_payload = {
            "postURLs": [post_url],
            "commentsPerPost": n,
            "maxRepliesPerComment": 2,
        }
    else:
        input_payload = {
            "startUrls": [{"url": post_url}],
            "maxComments": n,
        }
    run_url = (f"{API_BASE}/acts/{quote(actor_id, safe='/')}/runs"
               f"?token={encoded}")
    body = json.dumps(input_payload).encode("utf-8")
    req = urllib.request.Request(
        run_url, data=body, method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            start = json.loads(resp.read().decode("utf-8", "replace"))
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Apify : impossible de lancer l'acteur ({e}). "
                           "Vérifiez le token (APIFY_TOKEN).") from e

    run = (start.get("data") or {}).get("id")
    if not run:
        raise RuntimeError(f"Apify : réponse de lancement inattendue ({start}).")
    logger(f"[APIFY] Run {run} lancé ({actor_id}, {max_comments} c. max).")

    # Polling du statut du run.
    status_url = f"{API_BASE}/actor-runs/{run}?token={encoded}"
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            status_data = _request(status_url)
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(f"Apify : erreur de polling ({e}).") from e
        status = (status_data.get("data") or {}).get("status")
        logger(f"[APIFY] Statut du run : {status}.")
        if status == "SUCCEEDED":
            break
        if status in ("FAILED", "ABORTED", "TIMED-OUT"):
            raise RuntimeError(
                f"Apify : le run a échoué (statut {status}).")
        time.sleep(poll_interval)
    else:
        raise RuntimeError("Apify : timeout — le run n'a pas abouti dans le "
                           "délai imparti.")

    # Récupération des résultats (dataset items).
    items_url = (f"{API_BASE}/actor-runs/{run}/dataset/items"
                 f"?token={encoded}&format=json")
    try:
        items = _request(items_url)
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Apify : impossible de lire les résultats ({e}).") from e
    if not isinstance(items, list):
        raise RuntimeError(f"Apify : résultats inattendus ({type(items).__name__}).")
    logger(f"[APIFY] {len(items)} résultats récupérés.")
    return items


def normalize_comments(items: list[dict], video_url: str) -> list[dict]:
    """Convertit les items Apify en commentaires au format du scraper local.

    Mapping tolérant : les acteurs commentaires renvoient des champs variés
    (text, authorMeta.uniqueId, diggCount, createTime…). Chaque champ
    manquant retombe sur une valeur sûre — jamais d'exception.
    """
    video_id = video_url.rstrip("/").split("/")[-1]
    comments: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        # Champs variants selon l'acteur : apidojo donne commentId, clockworks
        # donne `cid` (vérifié en réel — les deux doivent être acceptés).
        cid = str(item.get("commentId") or item.get("cid") or item.get("id") or "")
        text = str(item.get("text") or item.get("commentText") or "")
        # Item inutilisable (ni identifiant ni texte) : on l'ignore.
        if not cid and not text.strip():
            continue
        author = item.get("authorMeta") if isinstance(item.get("authorMeta"), dict) else {}
        record = {
            "cid": cid,
            "text": text or "Texte manquant",
            "username": str(author.get("uniqueId") or item.get("uniqueId")
                            or "Utilisateur_Inconnu"),
            "nickname": str(author.get("name") or author.get("nickname") or ""),
            "likes": int(item.get("diggCount") or item.get("likes") or 0),
            "reply_count": int(item.get("replyCount") or item.get("replyCommentTotal")
                               or item.get("reply_comment_total") or 0),
            "create_time": _as_timestamp(item.get("createTime")
                                          or item.get("createTimeISO")),
            "video_id": video_id,
            "replies": [],
        }
        comments.append(record)
    return comments


def _as_timestamp(value) -> int:
    """Timestamp Unix tolérant : int direct, ISO 8601, ou 0."""
    if isinstance(value, (int, float)) and value > 0:
        return int(value)
    if isinstance(value, str):
        if value.isdigit():
            return int(value)
        try:
            iso = value.replace("Z", "+00:00")
            return int(datetime.datetime.fromisoformat(iso).timestamp())
        except ValueError:
            return 0
    return 0


def scrape_comments_via_apify(post_url: str, max_comments: int,
                              token: str | None = None, logger=print,
                              actor: str = ACTOR_CHEAP) -> list[dict]:
    """Scrape les commentaires d'une vidéo via Apify, normalisés.

    Retourne les commentaires au format du scraper local (réutilisables par
    le dashboard/scoring/IA/veille). Lève RuntimeError si pas de token.

    Secours automatique : apidojo (0,30 $/1 000) est maintenu de moins en
    moins et renvoie souvent des items `noResults` face à l'anti-bot 2026.
    Comme Apify facture par RÉSULTAT, un run sans résultat ne coûte rien :
    on retente alors avec clockworks (5 $/1 000, maintenu par Apify) —
    vérifié en réel le 05/08/2026.
    """
    token = token or get_token()
    if not token:
        raise RuntimeError(
            "Mode Apify : aucun token. Définissez APIFY_TOKEN (gratuit sur "
            "apify.com → Settings → API tokens).")
    items = run_actor(actor, post_url, max_comments, token, logger=logger)
    comments = normalize_comments(items, post_url)
    if actor == ACTOR_CHEAP and not comments:
        logger("[APIFY] Aucun résultat avec apidojo (0,30 $/1 000) — "
               "secours clockworks (5 $/1 000, maintenu).")
        items = run_actor(ACTOR_COMMENTS, post_url, max_comments, token,
                          logger=logger)
        comments = normalize_comments(items, post_url)
    return comments


def estimate_run_cost(videos: int, per_video: int, actor: str = ACTOR_CHEAP) -> float:
    """Coût estimé d'un run multi-vidéos (pur, testable)."""
    return estimate_cost(max(0, int(videos)) * max(0, int(per_video)), actor=actor)
