from __future__ import annotations

import re
from typing import Any

# (별칭, 표준 지역명) — 동일 시작 위치면 긴 별칭이 우선되도록 길이 내림차순으로 순회
_LOCATION_CANON: list[tuple[str, str]] = [
    ("성수동", "성수"),
    ("성수", "성수"),
    ("합정동", "합정"),
    ("합정", "합정"),
    ("압구정", "압구정"),
    ("을지로", "을지로"),
    ("한남", "한남"),
    ("연남", "연남"),
    ("망원", "망원"),
    ("홍대", "홍대"),
    ("이태원", "이태원"),
    ("강남", "강남"),
    ("신촌", "신촌"),
    ("건대", "건대"),
    ("잠실", "잠실"),
]

# DB `fetch_latest_recommendation` 시도 순서 — recommend 가 그대로 사용
CATEGORY_FALLBACK_ORDER: tuple[str, ...] = ("와인바", "이자카야", "노포", "야장", "낮술")

# 업무 미팅 — Home 지도 검색(한정식·다이닝·조용한 카페)과 동일 축. 와인바 import 폴백 금지.
MEETING_CATEGORY_FALLBACK_ORDER: tuple[str, ...] = ("한정식", "다이닝", "카페")

_MEETING_INTENT_RE = re.compile(
    r"미팅|업무\s*미팅|업무미팅|비즈니스|회의|상담|거래처|클라이언트|바이어"
)

# 질문 문자열에서 업종 스팬을 찾을 때만 쓰는 추가 키워드(위 순서에 없는 것들)
_QUERY_CATEGORY_EXTRA: frozenset[str] = frozenset(
    {
        "바",
        "펍",
        "칵테일바",
        "요리주점",
        "포차",
        "고기집",
        "오마카세",
        "한정식",
        "다이닝",
        "카페",
    }
)
_CATEGORIES: frozenset[str] = frozenset(CATEGORY_FALLBACK_ORDER) | _QUERY_CATEGORY_EXTRA

MOOD_KEYWORDS = frozenset(
    {
        "조용한",
        "데이트",
        "2차",
        "가성비",
        "분위기",
        "낮술",
        "야장",
        "시끄러운",
        "로맨틱",
        "혼술",
        "단체",
        "뷰",
        "루프탑",
    }
)


def _span_overlaps(a0: int, a1: int, b0: int, b1: int) -> bool:
    return not (a1 <= b0 or b1 <= a0)


def _has_meeting_intent(q: str) -> bool:
    return bool(_MEETING_INTENT_RE.search(q or ""))


def _find_location_span(q: str) -> tuple[str, int, int] | None:
    cand: list[tuple[int, int, str, str]] = []
    for alias, canon in sorted(_LOCATION_CANON, key=lambda x: (-len(x[0]), x[0])):
        pos = q.find(alias)
        if pos != -1:
            cand.append((pos, -len(alias), alias, canon))
    if not cand:
        return None
    cand.sort()
    pos, _, alias, canon = cand[0]
    return canon, pos, pos + len(alias)


def _find_category_span(q: str) -> tuple[str, int, int] | None:
    cand: list[tuple[int, int, str]] = []
    for cat in sorted(_CATEGORIES, key=lambda x: (-len(x), x)):
        pos = q.find(cat)
        if pos != -1:
            cand.append((pos, -len(cat), cat))
    if not cand:
        return None
    cand.sort()
    pos, _, cat = cand[0]
    return cat, pos, pos + len(cat)


def parse_query(query: str) -> dict[str, Any]:
    raw = (query or "").strip()
    meeting = _has_meeting_intent(raw)
    if not raw:
        return {
            "location": None,
            "category": "와인바",
            "moods": [],
            "meeting": False,
        }

    loc_span = _find_location_span(raw)
    cat_span = _find_category_span(raw)

    location = loc_span[0] if loc_span else None

    theme_category: str | None = None
    theme_span: tuple[int, int] | None = None
    if "야장" in raw:
        theme_category = "야장"
        p = raw.find("야장")
        theme_span = (p, p + len("야장"))
    elif "노포" in raw:
        theme_category = "노포"
        p = raw.find("노포")
        theme_span = (p, p + len("노포"))
    elif "낮술" in raw:
        theme_category = "낮술"
        p = raw.find("낮술")
        theme_span = (p, p + len("낮술"))

    if theme_category:
        category = theme_category
    else:
        category = cat_span[0] if cat_span else None

    reserved: list[tuple[int, int]] = []
    if loc_span:
        reserved.append((loc_span[1], loc_span[2]))
    if theme_span:
        reserved.append(theme_span)
    elif cat_span:
        reserved.append((cat_span[1], cat_span[2]))

    mood_hits: list[tuple[int, str]] = []
    for mood in MOOD_KEYWORDS:
        if theme_category == "야장" and mood == "야장":
            continue
        if theme_category == "낮술" and mood == "낮술":
            continue
        pos = raw.find(mood)
        if pos == -1:
            continue
        end = pos + len(mood)
        if any(_span_overlaps(pos, end, r0, r1) for r0, r1 in reserved):
            continue
        mood_hits.append((pos, mood))

    mood_hits.sort(key=lambda x: (x[0], x[1]))
    seen: set[str] = set()
    moods: list[str] = []
    for _, m in mood_hits:
        if m in seen:
            continue
        seen.add(m)
        moods.append(m)

    moods = list(dict.fromkeys(moods))

    if category is None:
        category = "한정식" if meeting else "와인바"

    return {
        "location": location,
        "category": category,
        "moods": moods,
        "meeting": meeting,
    }


if __name__ == "__main__":
    assert parse_query("성수 조용한 와인바") == {
        "location": "성수",
        "category": "와인바",
        "moods": ["조용한"],
        "meeting": False,
    }
    assert parse_query("을지로 2차 노포") == {
        "location": "을지로",
        "category": "노포",
        "moods": ["2차"],
        "meeting": False,
    }
    assert parse_query("압구정 데이트 와인바") == {
        "location": "압구정",
        "category": "와인바",
        "moods": ["데이트"],
        "meeting": False,
    }
    assert parse_query("을지로 야장") == {
        "location": "을지로",
        "category": "야장",
        "moods": [],
        "meeting": False,
    }
    assert parse_query("성수 낮술") == {
        "location": "성수",
        "category": "낮술",
        "moods": [],
        "meeting": False,
    }
    assert parse_query("성수조용한와인바") == {
        "location": "성수",
        "category": "와인바",
        "moods": ["조용한"],
        "meeting": False,
    }
    assert parse_query("성수 업무 미팅 장소 추천") == {
        "location": "성수",
        "category": "한정식",
        "moods": [],
        "meeting": True,
    }
    assert parse_query("을지로 업무 미팅 괜찮은 장소") == {
        "location": "을지로",
        "category": "한정식",
        "moods": [],
        "meeting": True,
    }
    assert parse_query("강남 비즈니스 회의 카페") == {
        "location": "강남",
        "category": "카페",
        "moods": [],
        "meeting": True,
    }
    print("ok")
