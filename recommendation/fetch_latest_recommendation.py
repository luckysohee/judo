from __future__ import annotations

from typing import Any


def fetch_latest_recommendation(
    supabase: Any, location: str, category: str
) -> dict[str, Any] | None:
    resp = (
        supabase.table("place_import_tmp")
        .select("*")
        .eq("location", location)
        .eq("category", category)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0] if rows else None
