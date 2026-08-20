from __future__ import annotations

import json
import tempfile
from pathlib import Path

from codex_guard import enforce_budget


def write(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value), encoding="utf-8")


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        root = Path(temp_dir)
        manifest = root / "manifest.json"
        signal = root / "signal.json"

        write(manifest, {"brief": {"budgetEur": 1.0}})

        write(
            signal,
            {
                "status": "awaiting_approval",
                "stage": "proposal",
                "progress": 20,
                "estimatedCostEur": 0.75,
                "actualCostEur": 0.0,
                "awaitingApproval": {"gate": "proposal", "summary": "ok"},
            },
        )
        assert enforce_budget(manifest, signal) is True
        assert read(signal)["status"] == "awaiting_approval"

        write(
            signal,
            {
                "status": "awaiting_approval",
                "stage": "proposal",
                "progress": 20,
                "estimatedCostEur": 1.25,
                "actualCostEur": 0.0,
                "awaitingApproval": {"gate": "proposal", "summary": "too expensive"},
            },
        )
        assert enforce_budget(manifest, signal) is False
        blocked = read(signal)
        assert blocked["status"] == "failed"
        assert "BUDGET_GUARD" in blocked["error"]

        write(
            signal,
            {
                "status": "completed",
                "stage": "final-qc",
                "progress": 100,
                "actualCostEur": 1.01,
                "renderPath": "projects/demo/renders/final.mp4",
            },
        )
        assert enforce_budget(manifest, signal) is False
        assert read(signal)["status"] == "failed"

        write(
            signal,
            {
                "status": "completed",
                "stage": "final-qc",
                "progress": 100,
                "renderPath": "projects/demo/renders/final.mp4",
            },
        )
        assert enforce_budget(manifest, signal) is False
        assert "actualCostEur" in read(signal)["error"]

        write(manifest, {"brief": {"budgetEur": 0.0}})
        write(
            signal,
            {
                "status": "completed",
                "stage": "final-qc",
                "progress": 100,
                "actualCostEur": 0.0,
                "renderPath": "projects/demo/renders/final.mp4",
            },
        )
        assert enforce_budget(manifest, signal) is True

    print("budget guard probe: ok")


if __name__ == "__main__":
    main()
