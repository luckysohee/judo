from __future__ import annotations

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

_CATEGORIES = frozenset(
    {
        "노포",
        "와인바",
        "이자카야",
        "바",
        "펍",
        "칵테일바",
        "요리주점",
        "포차",
        "고기집",
        "오마카세",
    }
)

MOOD_KEYWORDS = frozenset(
    {
        "조용한",
        "데이트",
        "2차",
        "가성비",
        "분위기",
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
    if not raw:
        return {"location": None, "category": "와인바", "moods": []}

    loc_span = _find_location_span(raw)
    cat_span = _find_category_span(raw)

    location = loc_span[0] if loc_span else None
    category = cat_span[0] if cat_span else None

    reserved: list[tuple[int, int]] = []
    if loc_span:
        reserved.append((loc_span[1], loc_span[2]))
    if cat_span:
        reserved.append((cat_span[1], cat_span[2]))

    mood_hits: list[tuple[int, str]] = []
    for mood in MOOD_KEYWORDS:
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
        category = "와인바"

    return {"location": location, "category": category, "moods": moods}


if __name__ == "__main__":
    assert parse_query("성수 조용한 와인바") == {
        "location": "성수",
        "category": "와인바",
        "moods": ["조용한"],
    }
    assert parse_query("을지로 2차 노포") == {
        "location": "을지로",
        "category": "노포",
        "moods": ["2차"],
    }
    assert parse_query("압구정 데이트 와인바") == {
        "location": "압구정",
        "category": "와인바",
        "moods": ["데이트"],
    }
    assert parse_query("성수조용한와인바") == {
        "location": "성수",
        "category": "와인바",
        "moods": ["조용한"],
    }
    print("ok")
