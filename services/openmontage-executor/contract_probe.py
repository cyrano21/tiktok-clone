from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOKEN = "executor-contract-token"


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def request_json(base: str, method: str, path: str, body=None, token: str | None = TOKEN):
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(f"{base}{path}", data=data, method=method, headers=headers)
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


def wait_for(base: str, job_id: str, expected: str, timeout: float = 12.0):
    deadline = time.time() + timeout
    latest = None
    while time.time() < deadline:
        _, latest = request_json(base, "GET", f"/jobs/{job_id}")
        if latest.get("status") == expected:
            return latest
        if latest.get("status") == "failed":
            raise AssertionError(f"executor failed while waiting for {expected}: {latest}")
        time.sleep(0.15)
    raise AssertionError(f"timed out waiting for {expected}; latest={latest}")


def main() -> int:
    port = free_port()
    base = f"http://127.0.0.1:{port}"

    with tempfile.TemporaryDirectory(prefix="orky-openmontage-contract-") as temp_raw:
        temp = Path(temp_raw)
        root = temp / "openmontage"
        data = temp / "data"
        root.mkdir()
        data.mkdir()
        (root / "AGENT_GUIDE.md").write_text("contract fixture", encoding="utf-8")
        (root / "PROJECT_CONTEXT.md").write_text("contract fixture", encoding="utf-8")

        fake_agent = temp / "fake_agent.py"
        fake_agent.write_text(
            """from __future__ import annotations
import json
import os
import sys
from pathlib import Path

prompt = Path(sys.argv[1]).read_text(encoding='utf-8')
signal = Path(os.environ['ORKY_OPENMONTAGE_SIGNAL_PATH'])
root = Path(os.environ['OPENMONTAGE_ROOT'])
project = os.environ['ORKY_OPENMONTAGE_PROJECT_ID']

if 'Décision ORKY reçue' not in prompt:
    payload = {
        'status': 'awaiting_approval',
        'stage': 'proposal',
        'progress': 25,
        'estimatedCostEur': 0.0,
        'actualCostEur': 0.0,
        'awaitingApproval': {
            'gate': 'proposal',
            'summary': 'Contrat test: proposition prête à être approuvée.'
        }
    }
else:
    render = root / 'projects' / project / 'renders' / 'final.mp4'
    render.parent.mkdir(parents=True, exist_ok=True)
    render.write_bytes(b'fake-mp4-contract-render')
    payload = {
        'status': 'completed',
        'stage': 'final-qc',
        'progress': 100,
        'actualCostEur': 0.0,
        'renderPath': str(render.relative_to(root))
    }

signal.write_text(json.dumps(payload), encoding='utf-8')
""",
            encoding="utf-8",
        )

        command = [sys.executable, str(fake_agent), "{prompt_file}"]
        env = os.environ.copy()
        env.update(
            {
                "OPENMONTAGE_EXECUTOR_HOST": "127.0.0.1",
                "OPENMONTAGE_EXECUTOR_PORT": str(port),
                "OPENMONTAGE_ROOT": str(root),
                "OPENMONTAGE_EXECUTOR_DATA": str(data),
                "OPENMONTAGE_EXECUTOR_TOKEN": TOKEN,
                "OPENMONTAGE_EXECUTOR_PUBLIC_BASE_URL": base,
                "OPENMONTAGE_AGENT_COMMAND_JSON": json.dumps(command),
                "OPENMONTAGE_AGENT_TIMEOUT_SECONDS": "30",
                "OPENMONTAGE_EXECUTOR_MAX_CONCURRENT": "1",
            }
        )

        process = subprocess.Popen(
            [sys.executable, str(HERE / "server.py")],
            cwd=HERE,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        try:
            deadline = time.time() + 8
            while True:
                if process.poll() is not None:
                    output = process.stdout.read() if process.stdout else ""
                    raise AssertionError(f"executor exited during startup: {output}")
                try:
                    status, health = request_json(base, "GET", "/health", token=None)
                    if status == 200 and health.get("ok") is True:
                        break
                except (urllib.error.URLError, TimeoutError):
                    pass
                if time.time() > deadline:
                    raise AssertionError("executor health endpoint did not become ready")
                time.sleep(0.1)

            try:
                request_json(base, "GET", "/jobs/not-a-job", token=None)
                raise AssertionError("unauthenticated executor request unexpectedly succeeded")
            except urllib.error.HTTPError as error:
                assert error.code == 401, error.code

            manifest = {
                "schemaVersion": "orky.openmontage.production-plan.v1",
                "producer": "ORKY",
                "source": {"referencePolicy": "inspiration-only"},
                "brief": {
                    "topic": "Executor contract probe",
                    "objective": "Validate the ORKY execution bridge",
                    "language": "fr",
                    "tone": "test",
                    "targetDurationSeconds": 30,
                    "aspectRatio": "9:16",
                    "budgetEur": 0,
                },
                "production": {
                    "useRealFootageOnly": True,
                    "includeNarration": False,
                    "includeCaptions": True,
                    "targetPlatforms": ["orky"],
                    "requiredGates": ["proposal", "final-qc"],
                },
                "rights": {
                    "doNotCloneCreatorIdentity": True,
                    "doNotReuseUnlicensedMedia": True,
                    "referenceIsStyleSignalOnly": True,
                },
                "integration": {"mode": "external-openmontage-workspace", "reason": "contract probe"},
                "openMontagePrompt": "contract probe",
            }

            status, created = request_json(base, "POST", "/jobs", {"manifest": manifest})
            assert status == 202, status
            job_id = created["jobId"]
            assert len(job_id) == 32

            waiting = wait_for(base, job_id, "awaiting_approval")
            assert waiting["awaitingApproval"]["gate"] == "proposal"
            assert waiting["progress"] == 25

            status, resumed = request_json(
                base,
                "POST",
                f"/jobs/{job_id}/approval",
                {"gate": "proposal", "approved": True, "note": "OK contract probe"},
            )
            assert status == 202, status
            assert resumed["status"] == "queued"

            completed = wait_for(base, job_id, "completed")
            assert completed["progress"] == 100
            assert completed["render"]["sha256"]
            assert completed["projectName"].endswith(job_id[:8])

            request = urllib.request.Request(
                f"{base}/jobs/{job_id}/render",
                method="GET",
                headers={
                    "Authorization": f"Bearer {TOKEN}",
                    "Range": "bytes=0-3",
                },
            )
            with urllib.request.urlopen(request, timeout=5) as response:
                assert response.status == 206, response.status
                assert response.headers.get("Content-Range", "").startswith("bytes 0-3/")
                assert response.read() == b"fake"

            print("OpenMontage executor contract probe: OK")
            return 0
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
