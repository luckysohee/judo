from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv
from supabase import create_client

from .fetch_latest_recommendation import fetch_latest_recommendation
from .parse_query import parse_query
from .refine_with_user_query import refine_with_user_query

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

_FALLBACK_CATEGORIES = ("와인바", "이자카야", "노포")


def _category_try_order(parsed: dict[str, Any]) -> list[str]:
    first = (parsed.get("category") or "와인바").strip() or "와인바"
    out: list[str] = []
    seen: set[str] = set()
    for c in (first, *_FALLBACK_CATEGORIES):
        if c in seen:
            continue
        seen.add(c)
        out.append(c)
    return out


def _places_list(row: dict[str, Any]) -> list[Any]:
    raw = row.get("places")
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            v = json.loads(raw)
            return v if isinstance(v, list) else []
        except json.JSONDecodeError:
            return []
    return []


def recommend(query: str) -> dict[str, Any]:
    parsed = parse_query(query)
    location = parsed.get("location")
    if not location:
        return {
            "ok": False,
            "message": "지역을 더 구체적으로 입력해줘",
        }

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_KEY"],
    )

    base_row: dict[str, Any] | None = None
    matched_category: str | None = None
    for cat in _category_try_order(parsed):
        row = fetch_latest_recommendation(supabase, location, cat)
        if row:
            base_row = row
            matched_category = cat
            break

    if not base_row or matched_category is None:
        return {
            "ok": False,
            "message": "해당 조건의 추천 데이터가 아직 없어",
        }

    moods = parsed.get("moods") or []
    stored = (base_row.get("content") or "").strip()
    summary = stored
    if moods and os.environ.get("OPENAI_API_KEY", "").strip():
        import httpx
        from openai import OpenAI

        openai_client = OpenAI(
            api_key=os.environ["OPENAI_API_KEY"],
            timeout=httpx.Timeout(60.0),
            max_retries=3,
        )
        summary = refine_with_user_query(openai_client, query, base_row)

    places_out = _places_list(base_row)

    return {
        "ok": True,
        "query": query.strip(),
        "location": location,
        "category": matched_category,
        "requested_category": parsed.get("category"),
        "summary": summary,
        "places": places_out,
    }
