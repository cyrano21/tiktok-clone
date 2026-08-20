#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

REAL_CODEX = os.getenv("ORKY_REAL_CODEX", "/usr/local/bin/codex-real")
EPSILON_EUR = 0.0001


def _finite_number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    return number if math.isfinite(number) and number >= 0 else None


def _atomic_write(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_suffix(path.suffix + ".budget.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def enforce_budget(manifest_path: Path, signal_path: Path) -> bool:
    """Validate the agent bridge against the user-approved production budget.

    Returns True when the original signal is within budget. On violation, the
    bridge is atomically replaced by a factual `failed` signal so server.py can
    never publish an over-budget production as successful/approved.
    """
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        signal = json.loads(signal_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return True  # server.py remains the canonical malformed-signal validator

    if not isinstance(manifest, dict) or not isinstance(signal, dict):
        return True
    brief = manifest.get("brief")
    if not isinstance(brief, dict):
        return True

    budget = _finite_number(brief.get("budgetEur"))
    if budget is None:
        return True  # validate_manifest() rejects this before a job can start

    status = str(signal.get("status") or "")
    estimated = _finite_number(signal.get("estimatedCostEur"))
    actual = _finite_number(signal.get("actualCostEur"))

    violation: str | None = None
    if estimated is not None and estimated > budget + EPSILON_EUR:
        violation = f"estimated cost {estimated:.4f} EUR exceeds approved budget {budget:.4f} EUR"
    if actual is not None and actual > budget + EPSILON_EUR:
        violation = f"actual cost {actual:.4f} EUR exceeds approved budget {budget:.4f} EUR"
    if status == "completed" and actual is None:
        violation = "completed signal is missing a valid actualCostEur"

    if not violation:
        return True

    failed: dict[str, Any] = {
        "status": "failed",
        "stage": str(signal.get("stage") or "budget-guard")[:120],
        "progress": signal.get("progress", 0),
        "error": f"BUDGET_GUARD: {violation}.",
    }
    if estimated is not None:
        failed["estimatedCostEur"] = estimated
    if actual is not None:
        failed["actualCostEur"] = actual
    _atomic_write(signal_path, failed)
    return False


def main() -> int:
    process = subprocess.run([REAL_CODEX, *sys.argv[1:]], check=False)

    manifest_raw = os.getenv("ORKY_OPENMONTAGE_MANIFEST_PATH", "").strip()
    signal_raw = os.getenv("ORKY_OPENMONTAGE_SIGNAL_PATH", "").strip()
    if manifest_raw and signal_raw:
        signal_path = Path(signal_raw)
        if signal_path.is_file():
            enforce_budget(Path(manifest_raw), signal_path)

    return int(process.returncode)


if __name__ == "__main__":
    raise SystemExit(main())
