from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import re
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

HOST = os.getenv("OPENMONTAGE_EXECUTOR_HOST", "0.0.0.0")
PORT = int(os.getenv("OPENMONTAGE_EXECUTOR_PORT", "8787"))
ROOT = Path(os.getenv("OPENMONTAGE_ROOT", "/opt/openmontage")).resolve()
DATA = Path(os.getenv("OPENMONTAGE_EXECUTOR_DATA", "/data/openmontage-executor")).resolve()
TOKEN = os.getenv("OPENMONTAGE_EXECUTOR_TOKEN", "").strip()
PUBLIC_BASE = os.getenv("OPENMONTAGE_EXECUTOR_PUBLIC_BASE_URL", f"http://127.0.0.1:{PORT}").rstrip("/")
MAX_BODY = int(os.getenv("OPENMONTAGE_EXECUTOR_MAX_BODY_BYTES", "131072"))
MAX_WORKERS = max(1, min(8, int(os.getenv("OPENMONTAGE_EXECUTOR_MAX_CONCURRENT", "1"))))
AGENT_TIMEOUT = max(60, int(os.getenv("OPENMONTAGE_AGENT_TIMEOUT_SECONDS", "7200")))
JOB_RE = re.compile(r"^[a-f0-9]{32}$")

JOBS_DIR = DATA / "jobs"
PROMPTS_DIR = DATA / "prompts"
SIGNALS_DIR = DATA / "signals"
LOGS_DIR = DATA / "logs"
for directory in (DATA, JOBS_DIR, PROMPTS_DIR, SIGNALS_DIR, LOGS_DIR):
    directory.mkdir(parents=True, exist_ok=True)

if not ROOT.exists():
    raise RuntimeError(f"OPENMONTAGE_ROOT does not exist: {ROOT}")
if not TOKEN and os.getenv("OPENMONTAGE_EXECUTOR_ALLOW_NO_AUTH") != "1":
    raise RuntimeError("OPENMONTAGE_EXECUTOR_TOKEN is required")

_pool = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="openmontage-job")
_store_lock = threading.RLock()
_running: set[str] = set()
_running_lock = threading.RLock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def job_path(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.json"


def signal_path(job_id: str) -> Path:
    return SIGNALS_DIR / f"{job_id}.json"


def log_path(job_id: str) -> Path:
    return LOGS_DIR / f"{job_id}.log"


def prompt_path(job_id: str) -> Path:
    return PROMPTS_DIR / f"{job_id}.txt"


def atomic_write_json(path: Path, value: dict[str, Any]) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, path)


def load_job(job_id: str) -> dict[str, Any] | None:
    if not JOB_RE.fullmatch(job_id):
        return None
    path = job_path(job_id)
    if not path.exists():
        return None
    with _store_lock:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
    return value if isinstance(value, dict) else None


def save_job(job: dict[str, Any]) -> None:
    job["updatedAt"] = now_iso()
    with _store_lock:
        atomic_write_json(job_path(str(job["jobId"])), job)


def public_job(job: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        "jobId",
        "status",
        "stage",
        "progress",
        "projectName",
        "estimatedCostEur",
        "actualCostEur",
        "awaitingApproval",
        "render",
        "error",
        "updatedAt",
    }
    out = {key: value for key, value in job.items() if key in allowed and value is not None}
    render = out.get("render")
    if isinstance(render, dict):
        render = dict(render)
        render["downloadUrl"] = f"{PUBLIC_BASE}/jobs/{job['jobId']}/render"
        out["render"] = render
    return out


def bounded_number(value: Any, minimum: float, maximum: float) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    if number < minimum or number > maximum:
        return None
    return number


def sanitize_project_name(value: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:64]
    return base or f"orky-production-{uuid.uuid4().hex[:8]}"


def validate_manifest(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("manifest must be an object")
    if payload.get("schemaVersion") != "orky.openmontage.production-plan.v1":
        raise ValueError("unsupported manifest schemaVersion")
    brief = payload.get("brief")
    if not isinstance(brief, dict):
        raise ValueError("manifest.brief is required")
    topic = str(brief.get("topic") or "").strip()
    if len(topic) < 3 or len(topic) > 500:
        raise ValueError("manifest.brief.topic is invalid")
    duration = bounded_number(brief.get("targetDurationSeconds"), 10, 600)
    budget = bounded_number(brief.get("budgetEur"), 0, 1000)
    if duration is None or budget is None:
        raise ValueError("manifest duration/budget is invalid")
    return payload


def build_agent_command(prompt_file: Path, prompt: str, job: dict[str, Any]) -> list[str]:
    raw = os.getenv("OPENMONTAGE_AGENT_COMMAND_JSON", "").strip()
    if raw:
        try:
            command = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError("OPENMONTAGE_AGENT_COMMAND_JSON is not valid JSON") from exc
        if not isinstance(command, list) or not command or not all(isinstance(item, str) and item for item in command):
            raise RuntimeError("OPENMONTAGE_AGENT_COMMAND_JSON must be a non-empty JSON string array")
    else:
        command = [
            "codex",
            "exec",
            "--skip-git-repo-check",
            "--dangerously-bypass-approvals-and-sandbox",
            "{prompt}",
        ]

    replacements = {
        "{prompt}": prompt,
        "{prompt_file}": str(prompt_file),
        "{project_root}": str(ROOT),
        "{job_id}": str(job["jobId"]),
        "{project_id}": str(job["_internal"]["projectId"]),
    }
    return [replacements.get(item, item) for item in command]


def bridge_prompt(job: dict[str, Any], decision: dict[str, Any] | None) -> str:
    internal = job["_internal"]
    manifest_path = Path(internal["manifestPath"])
    signal = signal_path(str(job["jobId"]))
    project_id = internal["projectId"]
    decision_text = "Aucune décision de reprise : démarre ou reprends depuis les checkpoints présents."
    if decision:
        state = "APPROUVÉ" if decision.get("approved") else "REFUSÉ / À RÉVISER"
        decision_text = (
            f"Décision ORKY reçue pour le gate {decision.get('gate')!r}: {state}. "
            f"Note utilisateur: {decision.get('note') or '[aucune]'}."
        )

    return f"""Tu opères OpenMontage pour ORKY dans un processus headless contrôlé.

RÈGLES IMPÉRATIVES
1. Lis AGENT_GUIDE.md puis PROJECT_CONTEXT.md avant toute action.
2. Toute production passe par un pipeline OpenMontage et ses director skills. Ne crée pas de pipeline ad hoc.
3. La demande canonique est dans: {manifest_path}
4. L'identifiant de projet imposé est: {project_id}
5. Reprends les checkpoints existants si le projet existe déjà. Ne recommence pas une étape validée.
6. Les validations humaines ne se font PAS dans ce terminal. À chaque gate qui requiert une décision humaine, écris le fichier bridge JSON indiqué plus bas puis TERMINE immédiatement le processus sans franchir le gate.
7. Avant un appel payant ou un changement majeur de provider/runtime, respecte le Decision Communication Contract d'OpenMontage. Si une approbation est nécessaire, émets un gate au lieu de choisir silencieusement.
8. Respecte le budget maximal du manifeste. N'effectue jamais une génération payante qui ferait dépasser le budget approuvé.
9. Ne copie pas l'identité d'un créateur ou un média tiers non licencié. Une vidéo de référence sert uniquement de signal de rythme/structure/style.
10. Si un produit Orchidy est présent, n'invente jamais prix, stock, avis, disponibilité ou promesse commerciale.

REPRISE / DÉCISION
{decision_text}

PROTOCOLE BRIDGE
Écris un JSON UTF-8 atomique à: {signal}
Le JSON doit avoir exactement l'une de ces formes conceptuelles:

- En attente de validation:
  {{"status":"awaiting_approval","stage":"proposal","progress":20,"estimatedCostEur":1.2,"actualCostEur":0.0,"awaitingApproval":{{"gate":"proposal","summary":"Choix, coûts, compromis et recommandation en français."}}}}

- Terminé:
  {{"status":"completed","stage":"final-qc","progress":100,"actualCostEur":1.2,"renderPath":"projects/{project_id}/renders/final.mp4"}}

- Échec bloquant:
  {{"status":"failed","stage":"assets","progress":45,"actualCostEur":0.4,"error":"Description factuelle du blocage et options possibles."}}

Le summary d'un gate doit permettre à l'utilisateur ORKY de décider sans ouvrir le terminal. Pour le gate de composition, présente Remotion et HyperFrames si les deux sont disponibles, comme l'impose OpenMontage.

N'écris jamais status=completed sans vérifier que le vrai fichier final existe. Ne fabrique aucune URL de rendu: l'executor la construira après validation du fichier.
"""


def safe_render_path(value: str) -> Path:
    candidate = (ROOT / value).resolve() if not os.path.isabs(value) else Path(value).resolve()
    try:
        candidate.relative_to(ROOT)
    except ValueError as exc:
        raise ValueError("renderPath escapes OPENMONTAGE_ROOT") from exc
    if not candidate.is_file():
        raise ValueError("final render does not exist")
    if candidate.suffix.lower() not in {".mp4", ".mov", ".webm"}:
        raise ValueError("unsupported final render type")
    return candidate


def render_metadata(path: Path, job_id: str) -> dict[str, Any]:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)

    meta: dict[str, Any] = {
        "downloadUrl": f"{PUBLIC_BASE}/jobs/{job_id}/render",
        "fileName": path.name,
        "sha256": digest.hexdigest(),
    }
    try:
        process = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height:format=duration",
                "-of",
                "json",
                str(path),
            ],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
        if process.returncode == 0:
            info = json.loads(process.stdout or "{}")
            streams = info.get("streams") or []
            if streams and isinstance(streams[0], dict):
                width = streams[0].get("width")
                height = streams[0].get("height")
                if isinstance(width, int) and width > 0:
                    meta["width"] = width
                if isinstance(height, int) and height > 0:
                    meta["height"] = height
            duration = (info.get("format") or {}).get("duration")
            if duration is not None:
                parsed = float(duration)
                if parsed > 0:
                    meta["durationSeconds"] = parsed
    except (OSError, ValueError, json.JSONDecodeError, subprocess.SubprocessError):
        pass
    return meta


def apply_signal(job: dict[str, Any]) -> None:
    path = signal_path(str(job["jobId"]))
    if not path.exists():
        raise RuntimeError("agent exited without writing the ORKY bridge signal")
    try:
        signal = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("agent wrote an invalid bridge signal") from exc
    if not isinstance(signal, dict):
        raise RuntimeError("agent bridge signal must be an object")

    status = signal.get("status")
    if status not in {"awaiting_approval", "completed", "failed"}:
        raise RuntimeError("agent bridge signal has unsupported status")

    stage = str(signal.get("stage") or "agent").strip()[:120]
    progress = bounded_number(signal.get("progress"), 0, 100)
    job["stage"] = stage
    if progress is not None:
        job["progress"] = progress

    for key in ("estimatedCostEur", "actualCostEur"):
        number = bounded_number(signal.get(key), 0, 10000)
        if number is not None:
            job[key] = number

    if status == "awaiting_approval":
        approval = signal.get("awaitingApproval")
        if not isinstance(approval, dict):
            raise RuntimeError("awaiting_approval signal is missing awaitingApproval")
        gate = str(approval.get("gate") or "").strip()[:120]
        summary = str(approval.get("summary") or "").strip()[:4000]
        if not gate or not summary:
            raise RuntimeError("awaitingApproval gate/summary is invalid")
        job["status"] = "awaiting_approval"
        job["awaitingApproval"] = {"gate": gate, "summary": summary}
        job.pop("error", None)
        return

    if status == "completed":
        render_value = str(signal.get("renderPath") or "").strip()
        if not render_value:
            raise RuntimeError("completed signal is missing renderPath")
        render_file = safe_render_path(render_value)
        job["status"] = "completed"
        job["stage"] = stage or "final-qc"
        job["progress"] = 100
        job["render"] = render_metadata(render_file, str(job["jobId"]))
        job["_internal"]["renderPath"] = str(render_file)
        job.pop("awaitingApproval", None)
        job.pop("error", None)
        return

    error = str(signal.get("error") or "OpenMontage agent reported a blocking failure.").strip()[:4000]
    job["status"] = "failed"
    job["error"] = error
    job.pop("awaitingApproval", None)


def run_agent(job_id: str, decision: dict[str, Any] | None = None) -> None:
    with _running_lock:
        if job_id in _running:
            return
        _running.add(job_id)

    try:
        job = load_job(job_id)
        if not job:
            return
        signal_path(job_id).unlink(missing_ok=True)
        job["status"] = "running"
        job["stage"] = "resuming" if decision else "preflight"
        job["progress"] = max(1, float(job.get("progress") or 0))
        job.pop("awaitingApproval", None)
        job.pop("error", None)
        save_job(job)

        prompt = bridge_prompt(job, decision)
        prompt_file = prompt_path(job_id)
        prompt_file.write_text(prompt, encoding="utf-8")
        command = build_agent_command(prompt_file, prompt, job)
        env = os.environ.copy()
        env.update(
            {
                "TERM": env.get("TERM") or "xterm-256color",
                "ORKY_OPENMONTAGE_JOB_ID": job_id,
                "ORKY_OPENMONTAGE_PROJECT_ID": str(job["_internal"]["projectId"]),
                "ORKY_OPENMONTAGE_SIGNAL_PATH": str(signal_path(job_id)),
                "ORKY_OPENMONTAGE_MANIFEST_PATH": str(job["_internal"]["manifestPath"]),
            }
        )

        with log_path(job_id).open("a", encoding="utf-8") as log:
            log.write(f"\n[{now_iso()}] COMMAND: {json.dumps(command[:4] + (['<prompt>'] if '{prompt}' not in command else []), ensure_ascii=False)}\n")
            log.flush()
            process = subprocess.Popen(
                command,
                cwd=ROOT,
                env=env,
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=subprocess.STDOUT,
                text=True,
            )
            try:
                return_code = process.wait(timeout=AGENT_TIMEOUT)
            except subprocess.TimeoutExpired:
                process.terminate()
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)
                raise RuntimeError(f"agent timed out after {AGENT_TIMEOUT}s")

        job = load_job(job_id) or job
        if return_code != 0 and not signal_path(job_id).exists():
            raise RuntimeError(f"agent process exited with code {return_code}")
        apply_signal(job)
        job["_internal"]["attempt"] = int(job["_internal"].get("attempt") or 0) + 1
        save_job(job)
    except Exception as exc:  # executor boundary: persist a factual failure for ORKY
        job = load_job(job_id)
        if job:
            job["status"] = "failed"
            job["error"] = str(exc)[:4000]
            job.pop("awaitingApproval", None)
            save_job(job)
    finally:
        with _running_lock:
            _running.discard(job_id)


def enqueue(job_id: str, decision: dict[str, Any] | None = None) -> None:
    _pool.submit(run_agent, job_id, decision)


def create_job(body: dict[str, Any]) -> dict[str, Any]:
    manifest = validate_manifest(body.get("manifest"))
    topic = str(manifest["brief"]["topic"])
    project_id = sanitize_project_name(topic)
    job_id = uuid.uuid4().hex
    manifest_file = DATA / "manifests" / f"{job_id}.json"
    manifest_file.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_json(manifest_file, manifest)

    job: dict[str, Any] = {
        "jobId": job_id,
        "status": "queued",
        "stage": "queued",
        "progress": 0,
        "projectName": project_id,
        "updatedAt": now_iso(),
        "_internal": {
            "projectId": project_id,
            "manifestPath": str(manifest_file),
            "attempt": 0,
            "decisions": [],
            "createdAt": now_iso(),
        },
    }
    save_job(job)
    enqueue(job_id)
    return job


def approve_job(job: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    if job.get("status") != "awaiting_approval" or not isinstance(job.get("awaitingApproval"), dict):
        raise ValueError("job is not awaiting approval")
    gate = str(body.get("gate") or "").strip()[:120]
    expected_gate = str(job["awaitingApproval"].get("gate") or "")
    if not gate or gate != expected_gate:
        raise ValueError("approval gate does not match the active gate")
    approved = body.get("approved")
    if not isinstance(approved, bool):
        raise ValueError("approved must be boolean")
    note = str(body.get("note") or "").strip()[:2000]
    decision = {"gate": gate, "approved": approved, "note": note, "at": now_iso()}
    job["_internal"].setdefault("decisions", []).append(decision)
    job["status"] = "queued"
    job["stage"] = f"resume:{gate}"
    job.pop("awaitingApproval", None)
    save_job(job)
    enqueue(str(job["jobId"]), decision)
    return job


def recover_jobs() -> None:
    for path in JOBS_DIR.glob("*.json"):
        try:
            job = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(job, dict) or not JOB_RE.fullmatch(str(job.get("jobId") or "")):
            continue
        if job.get("status") in {"queued", "running"}:
            job["status"] = "queued"
            job["stage"] = "recovering"
            save_job(job)
            enqueue(str(job["jobId"]))


class Handler(BaseHTTPRequestHandler):
    server_version = "OrkyOpenMontageExecutor/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[{now_iso()}] {self.address_string()} {fmt % args}")

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def authorized(self) -> bool:
        if not TOKEN and os.getenv("OPENMONTAGE_EXECUTOR_ALLOW_NO_AUTH") == "1":
            return True
        header = self.headers.get("Authorization", "")
        expected = f"Bearer {TOKEN}".encode()
        provided = header.encode()
        return bool(TOKEN) and hmac.compare_digest(provided, expected)

    def read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > MAX_BODY:
            raise ValueError("invalid request body size")
        raw = self.rfile.read(length)
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ValueError("request body must be an object")
        return value

    def parse_job_route(self) -> tuple[str | None, str | None]:
        path = urlparse(self.path).path.rstrip("/")
        match = re.fullmatch(r"/jobs/([a-f0-9]{32})(?:/(approval|render))?", path)
        if not match:
            return None, None
        return match.group(1), match.group(2)

    def do_GET(self) -> None:
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path == "/health":
            self.send_json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "openMontageRoot": ROOT.exists(),
                    "agentConfigured": bool(os.getenv("OPENMONTAGE_AGENT_COMMAND_JSON", "").strip()) or bool(Path("/usr/local/bin/codex").exists()),
                    "maxConcurrent": MAX_WORKERS,
                },
            )
            return
        if not self.authorized():
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "UNAUTHORIZED"})
            return
        job_id, suffix = self.parse_job_route()
        if not job_id:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "NOT_FOUND"})
            return
        job = load_job(job_id)
        if not job:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "JOB_NOT_FOUND"})
            return
        if suffix == "render":
            self.serve_render(job)
            return
        if suffix is not None:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "NOT_FOUND"})
            return
        self.send_json(HTTPStatus.OK, public_job(job))

    def do_POST(self) -> None:
        if not self.authorized():
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "UNAUTHORIZED"})
            return
        path = urlparse(self.path).path.rstrip("/") or "/"
        try:
            body = self.read_json()
            if path == "/jobs":
                self.send_json(HTTPStatus.ACCEPTED, public_job(create_job(body)))
                return
            job_id, suffix = self.parse_job_route()
            if job_id and suffix == "approval":
                job = load_job(job_id)
                if not job:
                    self.send_json(HTTPStatus.NOT_FOUND, {"error": "JOB_NOT_FOUND"})
                    return
                self.send_json(HTTPStatus.ACCEPTED, public_job(approve_job(job, body)))
                return
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "NOT_FOUND"})
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)[:1000]})
        except Exception as exc:
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)[:1000]})

    def serve_render(self, job: dict[str, Any]) -> None:
        internal = job.get("_internal") or {}
        render_value = internal.get("renderPath")
        if job.get("status") != "completed" or not isinstance(render_value, str):
            self.send_json(HTTPStatus.CONFLICT, {"error": "RENDER_NOT_READY"})
            return
        try:
            path = safe_render_path(render_value)
        except ValueError as exc:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": str(exc)})
            return

        size = path.stat().st_size
        start, end = 0, size - 1
        range_header = self.headers.get("Range", "")
        partial = False
        if range_header:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
            if not match:
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
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
                end = size - 1
            if start < 0 or end < start or start >= size:
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            end = min(end, size - 1)
            partial = True

        length = end - start + 1
        self.send_response(HTTPStatus.PARTIAL_CONTENT if partial else HTTPStatus.OK)
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Disposition", f'inline; filename="{path.name}"')
        self.send_header("Cache-Control", "private, max-age=60")
        if partial:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with path.open("rb") as handle:
            handle.seek(start)
            remaining = length
            while remaining > 0:
                chunk = handle.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)


if __name__ == "__main__":
    recover_jobs()
    print(f"ORKY OpenMontage executor listening on {HOST}:{PORT}; root={ROOT}; data={DATA}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
