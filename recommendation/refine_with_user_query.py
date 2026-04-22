from __future__ import annotations

import json
import re
from typing import Any

from .parse_query import parse_query

_SYSTEM = (
    "너는 한국 술집·와인바·노포를 아는 큐레이터다. "
    "주어진 데이터에만 근거해 3~5문장의 짧은 추천 글을 한국어로 쓴다. "
    "없는 사실·가게·가격·메뉴·영업정보는 절대 만들지 않는다. "
    "톤은 친근하지만 전문적으로, 추천 한 줄 코멘트에 가깝게. "
    "좋다·괜찮다·멋지다·분위기 좋다 등 일반적인 평가 표현은 줄이고, "
    "데이터에 나온 구체적 특징·차별점 위주로 쓴다."
)

_USER_TMPL = """[기존 추천 데이터 — 사실은 여기에만 있다]
{payload}

[유저 검색어]
{user_query}

[반영할 분위기 키워드]
{moods_line}

[규칙]
- location·category 값은 바꾸지 말고 그대로 반영한다(다른 지역·업종으로 바꾸지 않는다).
- 유저 검색어와 분위기 키워드에 맞춰 어떤 점이 맞는지만, 위 데이터 안에서 짧게 연결한다.
- 분위기 키워드가 있으면 해당 조건에 맞는 부분만 강조해서 추천한다.
- 3문장 이상 5문장 이하. 불릿·번호 없이 문단만.
- 좋다·괜찮다 같은 뻔한 평가 대신, 데이터에 있는 사실·특징만 골라 말한다.
"""


def _format_places_for_prompt(places: Any) -> str:
    if places is None:
        return "(없음)"
    if isinstance(places, str):
        s = places.strip()
        return s if s else "(없음)"
    if isinstance(places, dict):
        lines = []
        for k, v in places.items():
            name = k
            score = v
            if isinstance(v, dict):
                name = v.get("name") or v.get("place_name") or k
                score = v.get("score", v.get("relevance_score", v.get("rating", "")))
            lines.append(f"{name} + {score}".strip())
        return "\n".join(lines) if lines else "(없음)"
    if isinstance(places, (list, tuple)):
        lines = []
        for item in places:
            if isinstance(item, dict):
                name = (
                    item.get("name")
                    or item.get("place_name")
                    or item.get("title")
                    or item.get("place_id")
                    or ""
                )
                score = item.get("score")
                if score is None:
                    score = item.get("relevance_score", item.get("rating", ""))
                lines.append(f"{name} + {score}".strip())
            else:
                lines.append(f"{str(item)} + ")
        return "\n".join(lines) if lines else "(없음)"
    return str(places)


def _cap_at_most_sentences(text: str, max_sentences: int = 5) -> str:
    t = (text or "").strip()
    if not t:
        return t
    chunks = [c.strip() for c in re.split(r"(?<=[.!?…。])\s+", t) if c.strip()]
    if len(chunks) < 2:
        chunks = [c.strip() for c in re.split(r"\n+", t) if c.strip()]
    if len(chunks) < 2:
        return t
    return " ".join(chunks[:max_sentences])


def refine_with_user_query(client: Any, user_query: str, base_row: dict) -> str:
    moods = parse_query(user_query).get("moods") or []
    moods_line = ", ".join(moods) if moods else "(해당 없음)"

    content = base_row.get("content") or ""
    if len(content) > 15000:
        content = content[:15000] + "\n...(이하 생략)"

    payload = {
        "location": base_row.get("location"),
        "category": base_row.get("category"),
        "places": _format_places_for_prompt(base_row.get("places")),
        "content": content,
    }
    user_msg = _USER_TMPL.format(
        payload=json.dumps(payload, ensure_ascii=False, default=str),
        user_query=user_query.strip(),
        moods_line=moods_line,
    )

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.6,
    )
    out = resp.choices[0].message.content
    return _cap_at_most_sentences((out or "").strip(), 5)
