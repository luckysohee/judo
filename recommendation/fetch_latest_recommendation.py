from __future__ import annotations

from typing import Any


def _location_lookup_variants(location: str) -> list[str]:
    """
    parse_query는 «성수»처럼 짧은 표준을 쓰는데, DB에는 «성수동» 등으로 들어간 row가 있을 수 있음.
    """
    loc = (location or "").strip()
    if not loc:
        return []
    seen: set[str] = set()
    out: list[str] = []

    def add(x: str) -> None:
        x = (x or "").strip()
        if x and x not in seen:
            seen.add(x)
            out.append(x)

    add(loc)
    if not loc.endswith("동"):
        add(loc + "동")
    if not loc.endswith("역"):
        add(loc + "역")
    for x in {
        "성수": ("성수동", "성수역"),
        "합정": ("합정동", "합정역"),
        "을지로": ("을지로동", "을지로입구"),
    }.get(loc, ()):
        add(x)
    return out


def fetch_latest_recommendation(
    supabase: Any, location: str, category: str
) -> dict[str, Any] | None:
    for loc in _location_lookup_variants(location):
        resp = (
            supabase.table("place_import_tmp")
            .select("*")
            .eq("location", loc)
            .eq("category", category)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if rows:
            return rows[0]
    return None
