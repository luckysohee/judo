from __future__ import annotations

import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from supabase import create_client

from .fetch_latest_recommendation import fetch_latest_recommendation
from .parse_query import (
    CATEGORY_FALLBACK_ORDER,
    MEETING_CATEGORY_FALLBACK_ORDER,
    parse_query,
)
from .refine_with_user_query import refine_with_user_query

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))


def _category_try_order(parsed: dict[str, Any]) -> list[str]:
    meeting = bool(parsed.get("meeting"))
    fallback = (
        MEETING_CATEGORY_FALLBACK_ORDER
        if meeting
        else CATEGORY_FALLBACK_ORDER
    )
    default_first = "한정식" if meeting else "와인바"
    first = (parsed.get("category") or default_first).strip() or default_first
    out: list[str] = []
    seen: set[str] = set()
    for c in (first, *fallback):
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


def _name_compact(s: str) -> str:
    """공백·유사 공백 제거 후 소문자 — 띄어쓰기 없는 한글 상호와 DB 블록 상호 정렬."""
    return re.sub(r"\s+", "", (s or "").strip().lower())


def _name_tokens_overlap(a: str, b: str) -> bool:
    ta = {t for t in re.split(r"\s+", a.lower()) if len(t) >= 2}
    tb = {t for t in re.split(r"\s+", b.lower()) if len(t) >= 2}
    if ta and tb and (ta & tb):
        return True
    ca, cb = _name_compact(a), _name_compact(b)
    if len(ca) < 2 or len(cb) < 2:
        return False
    if ca == cb:
        return True
    shorter, longer = (ca, cb) if len(ca) <= len(cb) else (cb, ca)
    return shorter in longer


def _dicts_from_raw_import_blob(raw_blob: str) -> list[dict[str, Any]]:
    """
    `run_place_import.build_raw_data` 문자열 → 블록마다 네이버 수집 후보 1개.
    `place_import_tmp.places`에 넣기 전·후와 동일한 풀(배치마다 `raw_data`에 전부 있음).
    """
    out: list[dict[str, Any]] = []
    body = (raw_blob or "").strip()
    if not body:
        return out
    seq = 0
    for block in re.split(r"\n{2,}", body):
        block = block.strip()
        if not block:
            continue
        title = ""
        desc = ""
        if " / " in block:
            parts = [x.strip() for x in block.split(" / ", 2)]
            pname = (parts[0] if parts else "") or ""
            title = parts[1] if len(parts) > 1 else ""
            desc = parts[2] if len(parts) > 2 else ""
        else:
            pname = re.sub(r"\s+", " ", block)[:200].strip()
        if not pname:
            continue
        seq += 1
        out.append(
            {
                "id": f"import_pool_{seq}",
                "place_name": pname,
                "name": pname,
                "title": title,
                "description": desc,
            }
        )
    return out


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


def _matched_raw_blocks_text(place_name: str | None, raw_blob: str) -> str:
    """
    run_place_import `build_raw_data` 블록 중 상호가 맞는 것만 이어붙여 mood 점수용 텍스트로 쓴다.
    (_reason_from_raw_data 는 첫 매칭만 반환 — 여기서는 후기 신호를 넓게 잡기 위해 전부 합침)
    """
    n = str(place_name or "").strip()
    body = (raw_blob or "").strip()
    if not n or not body:
        return ""
    n_l = n.lower()
    chunks: list[str] = []
    for block in re.split(r"\n{2,}", body):
        block = block.strip()
        if not block:
            continue
        if " / " not in block:
            if n in block or n_l in block.lower():
                chunks.append(re.sub(r"\s+", " ", block))
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
        bits = [pname, title, desc]
        chunks.append(re.sub(r"\s+", " ", " ".join(x for x in bits if x)))
    joined = " ".join(chunks).strip()
    return joined[:6000] if joined else ""


def _ordered_place_names_from_content(content: str) -> list[str]:
    """
    place_import_tmp.content 본문에 적힌 추천 상호 순서를 뽑는다.
    우선 **상호명** 패턴을 사용하고, 중복은 제거한다.
    """
    c = str(content or "").strip()
    if not c:
        return []
    names = [m.strip() for m in re.findall(r"\*\*([^*]{2,60})\*\*", c) if m.strip()]
    out: list[str] = []
    seen: set[str] = set()
    for n in names:
        key = _name_compact(n)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(n)
    return out


# `후기`·`추천` 단독은 블로그 제목(상호 + 방문 후기)까지 주제로 오인하므로 넣지 않음.
_THEME_OR_KEYWORD_TITLE_RE = re.compile(
    r"(맛집|데이트\s*코스|분위기\s*좋|핫플|가볼만|소개팅|모임|역맛집|검색결과|키워드|"
    r"기념일|주제|에\s*가기|하기\s*좋은|가기\s*좋은|한잔하기|나들이|비스트로)",
    re.I,
)


def _looks_like_theme_or_keyword_title(s: str) -> bool:
    """블로그 키워드·주제 문장은 상호로 쓰지 않는다."""
    t = str(s or "").strip()
    if not t or len(t) < 2:
        return True
    low = t.lower()
    if _THEME_OR_KEYWORD_TITLE_RE.search(low):
        return True
    if re.search(r"(에\s*가기|하기\s*좋은|가기\s*좋은)\s*$", t.strip()):
        return True
    # 동네 + 업종만 (예: 성수동 카페)
    if re.match(
        r"^[가-힣0-9]+\s*동\s+(카페|바|술집|음식점|와인바|노포)\s*$",
        t.strip(),
    ):
        return True
    return False


def _clip_dense_blog_title(title: str, max_len: int = 56) -> str:
    """네이버 블로그 제목 앞부분을 상호 후보로."""
    t = (title or "").strip()
    if not t:
        return ""
    for sep in (" 방문", " 후기", " 추천", " 리뷰", " | ", " - "):
        i = t.find(sep)
        if 4 <= i <= 80:
            head = t[:i].strip()
            if len(head) >= 2:
                return head[:max_len].strip()
    return t[:max_len].strip()


def _canonical_place_name_row(p: dict[str, Any]) -> str:
    """DB JSON에 name·title이 뒤섞여 있어도 상호 후보를 한 줄로."""
    keys = (
        "place_name",
        "official_name",
        "business_name",
        "store_name",
        "name",
        "title",
    )
    fallback: str | None = None
    for k in keys:
        v = p.get(k)
        if not v or not str(v).strip():
            continue
        raw_s = str(v).strip()
        if fallback is None:
            fallback = raw_s
        if k == "title":
            clipped_head = _clip_dense_blog_title(raw_s)
            if (
                clipped_head
                and clipped_head != raw_s
                and not _looks_like_theme_or_keyword_title(clipped_head)
            ):
                return clipped_head[:120].strip()
        if k == "title" and len(raw_s) > 28:
            clipped = _clip_dense_blog_title(raw_s)
            if clipped and not _looks_like_theme_or_keyword_title(clipped):
                return clipped[:120].strip()
        if not _looks_like_theme_or_keyword_title(raw_s):
            return raw_s[:120].strip()
    t_full = str(p.get("title") or "").strip()
    if len(t_full) > 28:
        c = _clip_dense_blog_title(t_full)
        if c:
            return c[:120].strip()
    return (fallback or "")[:120].strip()


def _pin_content_top_places(
    places: list[Any], ordered_names: list[str], top_n: int = 3
) -> list[Any]:
    """
    content 본문 순서(상위 top_n)와 매칭되는 장소를 앞쪽으로 고정 배치한다.
    매칭 실패한 본문 상호는 강제 삽입하지 않는다.
    """
    if not places or not ordered_names or top_n <= 0:
        return places
    pinned: list[Any] = []
    used_idx: set[int] = set()
    for wanted in ordered_names[:top_n]:
        w = str(wanted or "").strip()
        if not w:
            continue
        found = -1
        for i, p in enumerate(places):
            if i in used_idx or not isinstance(p, dict):
                continue
            nm = _canonical_place_name_row(p)
            if not nm:
                continue
            if (
                _name_compact(w) == _name_compact(nm)
                or _name_tokens_overlap(w, nm)
                or _name_compact(w) in _name_compact(nm)
                or _name_compact(nm) in _name_compact(w)
            ):
                found = i
                break
        if found >= 0:
            used_idx.add(found)
            pinned.append(places[found])
    if not pinned:
        return places
    rest = [p for i, p in enumerate(places) if i not in used_idx]
    return pinned + rest


MOOD_SIGNAL_WORDS: dict[str, list[str]] = {
    "조용한": [
        "조용",
        "차분",
        "대화",
        "소개팅",
        "아늑",
        "잔잔",
        "프라이빗",
    ],
    "데이트": ["데이트", "분위기", "소개팅", "아늑", "조명"],
    "분위기": ["분위기", "조명", "감성", "무드", "아늑"],
}


def _mood_score_place(
    p: dict[str, Any],
    moods: list[str],
    raw_blob: str = "",
    content: str = "",
) -> int:
    """
    무드 신호가 어느 근거에 붙었는지에 따라 가중치 부여(MVP).
    title +1, description +3, reason·content 스니펫 +4, signals +5, raw_data +2
    """
    nm = _canonical_place_name_row(p) or str(
        p.get("place_name") or p.get("name") or ""
    ).strip()
    title = str(p.get("title") or "")
    description = str(p.get("description") or "")
    reason = str(p.get("reason") or "")
    content_snip = _reason_from_content_column(nm, content) or ""
    reason_content = f"{reason} {content_snip}".strip()
    signals_txt = (
        " ".join(map(str, p.get("signals") or []))
        if isinstance(p.get("signals"), list)
        else ""
    )
    raw_extra = _matched_raw_blocks_text(nm, raw_blob) if raw_blob else ""

    score = 0
    for mood in moods:
        m = str(mood).strip()
        if not m:
            continue
        for w in MOOD_SIGNAL_WORDS.get(m, [m]):
            if not w:
                continue
            if w in title:
                score += 1
            if w in description:
                score += 3
            if w in reason_content:
                score += 4
            if w in signals_txt:
                score += 5
            if w in raw_extra:
                score += 2
    return score


def _enrich_place_for_api(p: Any, content: str, raw_blob: str) -> Any:
    """
    장소별 한 줄: content(place_import_tmp) → raw_data(블로그 블록) → DB places.reason → signals.
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

    # place_import_tmp.content 를 먼저 쓴다(raw_data 는 상호 불일치·블록 깨짐 시에도 이유가 남는 경우가 있어
    # 이전에는 raw 만 먹고 content 가 사실상 무시됨).
    line = _reason_from_content_column(nm, content)
    if not line:
        line = _reason_from_raw_data(nm, raw_s)
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

    try:
        supabase_url = os.environ["SUPABASE_URL"]
        supabase_key = os.environ["SUPABASE_KEY"]
    except KeyError:
        return {
            "ok": False,
            "message": "Supabase 연결 정보가 설정되지 않았어",
        }

    supabase = create_client(supabase_url, supabase_key)

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
    has_openai = bool(os.environ.get("OPENAI_API_KEY", "").strip())
    mood_refinement_applied = False
    mood_refinement_skipped_reason: str | None = None

    if moods and not has_openai:
        mood_refinement_skipped_reason = "openai_key_missing"
    elif moods and has_openai:
        try:
            import httpx
            from openai import OpenAI

            openai_client = OpenAI(
                api_key=os.environ["OPENAI_API_KEY"],
                timeout=httpx.Timeout(60.0),
                max_retries=3,
            )
            summary = refine_with_user_query(openai_client, query, base_row)
            mood_refinement_applied = True
        except Exception:
            summary = stored_content
            mood_refinement_skipped_reason = "refine_failed"

    places_raw = _places_list(base_row)
    places_out = [
        _enrich_place_for_api(p, stored_content, raw_data_blob) for p in places_raw
    ]
    content_order_names = _ordered_place_names_from_content(stored_content)

    if moods:
        scored = [
            (
                p,
                (
                    _mood_score_place(
                        p, moods, raw_data_blob, stored_content
                    )
                    if isinstance(p, dict)
                    else 0
                ),
            )
            for p in places_out
        ]
        # 점수 높은 순; 동점은 수집·DB 원래 순서 유지(안정 정렬)
        places_out = [p for p, _ in sorted(scored, key=lambda x: x[1], reverse=True)]
        for p in places_out:
            if isinstance(p, dict):
                p["mood_score"] = _mood_score_place(
                    p, moods, raw_data_blob, stored_content
                )

    # DB content 본문에 적힌 추천 1~3순위를 최종 응답 상단으로 고정.
    places_out = _pin_content_top_places(places_out, content_order_names, top_n=3)

    pool_src = _dicts_from_raw_import_blob(raw_data_blob)
    import_pool_out: list[dict[str, Any]] = []
    for p in pool_src:
        if isinstance(p, dict):
            import_pool_out.append(
                _enrich_place_for_api(dict(p), stored_content, raw_data_blob)
            )
    if not import_pool_out:
        import_pool_out = [
            dict(x) if isinstance(x, dict) else {"name": str(x)}
            for x in places_out
        ]
    else:
        import_pool_out = _pin_content_top_places(
            import_pool_out, content_order_names, top_n=3
        )

    return {
        "ok": True,
        "query": query.strip(),
        "location": location,
        "category": matched_category,
        "requested_category": parsed.get("category"),
        "meeting": bool(parsed.get("meeting")),
        "moods": moods,
        "mood_refinement_applied": mood_refinement_applied,
        "mood_refinement_skipped_reason": mood_refinement_skipped_reason,
        "content_order_names": content_order_names,
        "summary": summary,
        "places": places_out,
        "import_pool": import_pool_out,
    }
