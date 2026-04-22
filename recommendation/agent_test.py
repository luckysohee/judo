"""place_import_tmp 저장은 save_place_import_tmp만 사용한다."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


def save_place_import_tmp(supabase: Any, **kwargs: Any) -> Any:
    from recommendation.save_place_import_tmp import save_place_import_tmp as _impl

    return _impl(supabase, **kwargs)


def save_db(supabase: Any, **kwargs: Any) -> Any:
    from recommendation.save_place_import_tmp import save_db as _impl

    return _impl(supabase, **kwargs)


def save_to_db(supabase: Any, **kwargs: Any) -> Any:
    from recommendation.save_place_import_tmp import save_to_db as _impl

    return _impl(supabase, **kwargs)


__all__ = ["save_db", "save_place_import_tmp", "save_to_db"]


def _smoke_main() -> None:
    from dotenv import load_dotenv
    from supabase import create_client

    load_dotenv(dotenv_path=_ROOT / ".env")
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    save_to_db(
        sb,
        location=os.environ.get("AGENT_TEST_LOC", "_agent_test_smoke"),
        category=os.environ.get("AGENT_TEST_CAT", "와인바"),
        content=os.environ.get("AGENT_TEST_CONTENT", "smoke save"),
        selected_items=json.loads(
            os.environ.get(
                "AGENT_TEST_ITEMS_JSON",
                '[{"name": "_agent_test_place", "score": 0}]',
            )
        ),
    )


if __name__ == "__main__":
    _smoke_main()
