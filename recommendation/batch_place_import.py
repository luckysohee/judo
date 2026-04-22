#!/usr/bin/env python3
"""place_import_tmp bulk write — only recommendation.save_place_import_tmp.save_to_db."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

from recommendation.save_place_import_tmp import save_to_db


def _load_jobs() -> list[dict[str, Any]]:
    if len(sys.argv) > 1:
        raw = Path(sys.argv[1]).read_text(encoding="utf-8")
    else:
        raw = (os.environ.get("PLACE_IMPORT_JOBS_JSON") or "").strip()
        if not raw:
            print(
                "Usage: python3 -m recommendation.batch_place_import <jobs.json>\n"
                "Or set PLACE_IMPORT_JOBS_JSON to a JSON array of job objects.",
                file=sys.stderr,
            )
            raise SystemExit(2)
    data = json.loads(raw)
    if not isinstance(data, list):
        raise SystemExit("jobs must be a JSON array")
    return data


def main() -> None:
    load_dotenv(dotenv_path=ROOT / ".env")
    jobs = _load_jobs()
    for job in jobs:
        save_to_db(
            location=str(job["location"]),
            category=str(job["category"]),
            content=str(job["content"]),
            selected_items=job.get("selected_items"),
            deduped_items=job.get("deduped_items"),
            places=job.get("places"),
            raw_data=job.get("raw_data"),
        )


if __name__ == "__main__":
    main()
