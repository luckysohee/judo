from __future__ import annotations

import json
import os
import re
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


def _content_chunks(content: str) -> list[str]:
    c = (content or "").strip()
    if not c:
        return []
    parts = re.split(r"(?<=[.!?…])\s+|\n+", c)
    return [p.strip() for p in parts if p and str(p).strip()]


def _reason_from_content_column(place_name: str | None, content: str) -> str | None:
    """content 컬럼에서 해당 가게와 관련된 한 덩어리."""
    n = str(place_name or "").strip()
    c = (content or "").strip()
    if not n or not c:
        return None
    for ch in _content_chunks(c):
        if n in ch:
            return ch[:260].strip()
    for token in n.replace("/", " ").split():
        t = token.strip()
        if len(t) >= 2 and t in c:
            for ch in _content_chunks(c):
                if t in ch:
                    return ch[:260].strip()
    idx = c.find(n)
    if idx >= 0:
        lo = max(0, idx - 30)
        hi = min(len(c), idx + len(n) + 200)
        return c[lo:hi].replace("\n", " ").strip()
    return None


def _normalize_raw_data_field(raw_data: Any) -> str:
    if raw_data is None:
        return ""
    if isinstance(raw_data, str):
        return raw_data.strip()
    try:
        return json.dumps(raw_data, ensure_ascii=False)
    except Exception:
        return str(raw_data).strip()


def _name_tokens_overlap(a: str, b: str) -> bool:
    ta = {t for t in re.split(r"\s+", a.lower()) if len(t) >= 2}
    tb = {t for t in re.split(r"\s+", b.lower()) if len(t) >= 2}
    return bool(ta & tb) if ta and tb else False


def _reason_from_raw_data(place_name: str | None, raw_blob: str) -> str | None:
    """
    raw_data: run_place_import `build_raw_data` 형태
    `place_name / title / description` 블록이 빈 줄(\\n\\n)로 구분.
    """
    n = str(place_name or "").strip()
    body = (raw_blob or "").strip()
    if not n or not body:
        return None
    n_l = n.lower()
    for block in re.split(r"\n{2,}", body):
        block = block.strip()
        if not block:
            continue
        if " / " not in block:
            if n in block or n_l in block.lower():
                one = re.sub(r"\s+", " ", block)[:260].strip()
                return one or None
            continue
        parts = [x.strip() for x in block.split(" / ", 2)]
        pname = parts[0] if parts else ""
        title = parts[1] if len(parts) > 1 else ""
        desc = parts[2] if len(parts) > 2 else ""
        if not pname:
            continue
        p_l = pname.lower()
        matched = (
            n_l in p_l
            or p_l in n_l
            or n in pname
            or pname in n
            or _name_tokens_overlap(n, pname)
        )
        if not matched:
            continue
        bits: list[str] = []
        if title:
            bits.append(re.sub(r"\s+", " ", title)[:120])
        if desc:
            d = re.sub(r"\s+", " ", desc)
            bits.append(d[:160])
        line = " — ".join(x for x in bits if x)
        return (line[:280] + ("…" if len(line) > 280 else "")).strip() if line else None
    return None


def _canonical_place_name_row(p: dict[str, Any]) -> str:
    """DB JSON에 name·title이 뒤섞여 있어도 상호 후보를 한 줄로."""
    for k in (
        "place_name",
        "official_name",
        "business_name",
        "store_name",
        "name",
    ):
        v = p.get(k)
        if v and str(v).strip():
            return str(v).strip()
    t = str(p.get("title") or "").strip()
    return t


def _enrich_place_for_api(p: Any, content: str, raw_blob: str) -> Any:
    """
    장소별 한 줄: raw_data(블로그 원문) → content(GPT 요약) → DB places.reason → signals.
    """
    if not isinstance(p, dict):
        return p
    out = dict(p)
    canon = _canonical_place_name_row(out)
    if canon:
        out["name"] = canon
        out["place_name"] = canon
    nm = canon or out.get("place_name") or out.get("name")
    raw_s = _normalize_raw_data_field(raw_blob)

    line = _reason_from_raw_data(nm, raw_s)
    if not line:
        line = _reason_from_content_column(nm, content)
    if not line:
        r0 = str(out.get("reason") or "").strip()
        if r0:
            line = r0
    if not line:
        sigs = out.get("signals")
        if isinstance(sigs, list):
            parts = [str(x).strip() for x in sigs if x and str(x).strip()]
            if parts:
                line = " · ".join(parts[:2])
    if line:
        out["reason"] = line
    return out


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
    stored_content = (base_row.get("content") or "").strip()
    raw_data_blob = _normalize_raw_data_field(base_row.get("raw_data"))
    summary = stored_content
    if moods and os.environ.get("OPENAI_API_KEY", "").strip():
        import httpx
        from openai import OpenAI

        openai_client = OpenAI(
            api_key=os.environ["OPENAI_API_KEY"],
            timeout=httpx.Timeout(60.0),
            max_retries=3,
        )
        summary = refine_with_user_query(openai_client, query, base_row)

    places_raw = _places_list(base_row)
    places_out = [
        _enrich_place_for_api(p, stored_content, raw_data_blob) for p in places_raw
    ]

    return {
        "ok": True,
        "query": query.strip(),
        "location": location,
        "category": matched_category,
        "requested_category": parsed.get("category"),
        "summary": summary,
        "places": places_out,
    }
