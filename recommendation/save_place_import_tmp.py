import os
from datetime import datetime, timezone
from typing import Any

from supabase import create_client


def places_payload_from_items(items):
    if not items:
        return []

    return [
        {
            "name": i.get("place_name") or i.get("name"),
            "score": i.get("score", 0),
        }
        for i in items
    ]


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
        places_col = list(places)
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