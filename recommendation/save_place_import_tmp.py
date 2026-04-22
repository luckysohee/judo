from __future__ import annotations

from typing import Any, Mapping, Sequence


def places_payload_from_items(items: Sequence[Any] | None) -> list[dict[str, Any]]:
    """selected_items / deduped 리스트 → place_import_tmp.places JSON."""
    if not items:
        return []
    out: list[dict[str, Any]] = []
    for it in items:
        if isinstance(it, str):
            n = it.strip()
            if n:
                out.append({"name": n})
            continue
        if isinstance(it, Mapping):
            name = (
                it.get("name")
                or it.get("place_name")
                or it.get("title")
                or ""
            )
            name = str(name).strip() if name is not None else ""
            if not name:
                continue
            row: dict[str, Any] = {"name": name}
            sc = it.get("score")
            if sc is None:
                sc = it.get("relevance_score") or it.get("rating")
            if isinstance(sc, (int, float)) and not isinstance(sc, bool):
                row["score"] = float(sc) if isinstance(sc, float) else int(sc)
            elif sc is not None and str(sc).strip() != "":
                try:
                    fs = float(str(sc).replace(",", ""))
                    row["score"] = int(fs) if fs == int(fs) else fs
                except ValueError:
                    pass
            out.append(row)
            continue
        pn = getattr(it, "name", None)
        if pn:
            out.append({"name": str(pn).strip()})
    return out


def save_place_import_tmp(
    supabase: Any,
    *,
    location: str,
    category: str,
    content: str,
    selected_items: Sequence[Any] | None = None,
    deduped_items: Sequence[Any] | None = None,
    places: list[dict[str, Any]] | None = None,
    title: str | None = None,
    curator_id: str = "judo_ai",
    raw_data: Any | None = None,
) -> Any:
    """
    place_import_tmp insert. places는 places 인자가 있으면 그대로,
    없으면 selected_items → 없으면 deduped_items 순으로 만든다.
    """
    print("SAVE_TO_DB CALLED")
    print("SELECTED_ITEMS:", selected_items)
    print("DEDUPED_ITEMS:", deduped_items)
    print("PLACES_ARG:", places)

    if places is not None:
        places_col = list(places)
    else:
        src = (
            selected_items
            if selected_items is not None
            else deduped_items
        )
        places_col = places_payload_from_items(src)

    print("PLACES PAYLOAD:", places_col)

    row: dict[str, Any] = {
        "location": location,
        "category": category,
        "content": content,
        "places": places_col or [],
        "curator_id": curator_id,
    }
    if title is not None:
        row["title"] = title
    if raw_data is not None:
        row["raw_data"] = raw_data

    return supabase.table("place_import_tmp").insert(row).execute()


def save_db(
    supabase: Any,
    *,
    location: str,
    category: str,
    content: str,
    selected_items: Sequence[Any] | None = None,
    deduped_items: Sequence[Any] | None = None,
    places: list[dict[str, Any]] | None = None,
    title: str | None = None,
    curator_id: str = "judo_ai",
    raw_data: Any | None = None,
) -> Any:
    return save_place_import_tmp(
        supabase,
        location=location,
        category=category,
        content=content,
        selected_items=selected_items,
        deduped_items=deduped_items,
        places=places,
        title=title,
        curator_id=curator_id,
        raw_data=raw_data,
    )


save_to_db = save_db
