import os
import re
from datetime import datetime, timezone
from typing import Any

from supabase import create_client


def _compact(s: str) -> str:
    return re.sub(r"\s+", "", (s or "").strip())


def _pick_canonical_place_name(x: dict[str, Any]) -> str:
    """
    CrewAI/에이전트가 title·name에 분위기 문장을 넣어도,
    place_name·official_name 등이 있으면 그걸 상호로 쓴다.
    """
    for k in (
        "place_name",
        "official_name",
        "business_name",
        "store_name",
        "name",
    ):
        v = x.get(k)
        if v and str(v).strip():
            return str(v).strip()
    t = (x.get("title") or "").strip()
    return t


def extract_signals_from_text(text: str) -> list[str]:
    c = _compact(text)
    if not c:
        return []
    out: list[str] = []
    seen: set[str] = set()

    def add(label: str) -> None:
        if label not in seen:
            seen.add(label)
            out.append(label)

    if "조용" in c:
        add("조용한 분위기")
    elif "분위기" in c:
        add("분위기")
    if "데이트" in c:
        add("데이트")
    if "2차" in c:
        add("2차")
    if "가성비" in c:
        add("가성비")
    if "화장실" in c:
        add("화장실")
    if "좌석" in c or "자리" in c:
        add("좌석 편함")
    if "재방문" in c:
        add("재방문각")
    return out[:8]


def reason_from_signals(signals: list[str], place_name: str) -> str:
    s = signals[:2]
    if len(s) >= 2:
        return f"{s[0]}·{s[1]} 포인트가 후기에 잘 드러나요."
    if len(s) == 1:
        return f"{s[0]} 포인트가 후기에 잘 드러나요."
    label = (place_name or "").strip() or "이 장소"
    return f"블로그 타이틀·본문에서 {label} 언급이 꾸준해요."


def build_place_row_from_item(i: dict[str, Any]) -> dict[str, Any]:
    title = (i.get("title") or "").strip()
    desc = (i.get("description") or "").strip()
    blob = f"{title} {desc}".strip()
    signals = extract_signals_from_text(blob)
    name = _pick_canonical_place_name(i)
    return {
        "name": name,
        "place_name": name,
        "score": i.get("score", 0),
        "reason": reason_from_signals(signals, str(name or "")),
        "signals": signals,
    }


def places_payload_from_items(items):
    if not items:
        return []
    return [build_place_row_from_item(i) for i in items if isinstance(i, dict)]


def _finalize_place_dict(d: dict[str, Any]) -> dict[str, Any]:
    x = dict(d)
    name = _pick_canonical_place_name(x)
    title = (x.get("title") or "").strip()
    desc = (x.get("description") or "").strip()
    blob = f"{title} {desc}".strip()
    signals = list(x.get("signals") or [])
    if blob and not signals:
        signals = extract_signals_from_text(blob)
    reason = (x.get("reason") or "").strip()
    if not reason:
        reason = reason_from_signals(signals, str(name or ""))
    return {
        "name": name,
        "place_name": name,
        "score": x.get("score", 0),
        "reason": reason,
        "signals": signals,
    }


def save_to_db(
    location: str,
    category: str,
    content: str,
    selected_items=None,
    deduped_items=None,
    places=None,
    raw_data=None,
):
    print("SAVE_TO_DB CALLED")

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_KEY"],
    )

    print("SELECTED_ITEMS:", selected_items)
    print("DEDUPED_ITEMS:", deduped_items)
    print("PLACES_ARG:", places)

    if places is not None:
        places_col = [_finalize_place_dict(p) for p in places if isinstance(p, dict)]
    else:
        src = selected_items or deduped_items or []
        places_col = places_payload_from_items(src)

    print("PLACES PAYLOAD:", places_col)

    row: dict[str, Any] = {
        "name": f"{location} {category}",
        "category": category,
        "address": f"{location} 일대",
        "curator_id": "judo_ai",
        "title": f"{location} {category} 추천",
        "location": location,
        "content": content,
        "source_key": f"{location}-{category}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "raw_data": raw_data,
        "picked_count": len(places_col),
        "places": places_col,
    }

    supabase.table("place_import_tmp").insert(row).execute()


def save_db(_supabase: Any = None, **kwargs: Any) -> None:
    save_to_db(**kwargs)


def save_place_import_tmp(_supabase: Any = None, **kwargs: Any) -> None:
    save_to_db(**kwargs)
