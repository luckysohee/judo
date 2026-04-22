import os
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
        "location": location,
        "category": category,
        "content": content,
        "places": places_col,
        "raw_data": raw_data,
    }

    supabase.table("place_import_tmp").insert(row).execute()