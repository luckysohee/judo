#!/usr/bin/env python3
"""Usage: python3 recommendation/cli_recommend.py "성수 와인바"  → JSON on stdout"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from recommendation.recommend import recommend  # noqa: E402


def main() -> None:
    q = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
    print(json.dumps(recommend(q), ensure_ascii=False))


if __name__ == "__main__":
    main()
