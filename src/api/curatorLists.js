import { supabase } from "./client";
import { mapPlaceRowForCourse } from "./places.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id, label) {
  const s = String(id ?? "").trim();
  if (!s || !UUID_RE.test(s)) {
    throw new Error(`${label}: invalid uuid`);
  }
  return s;
}

function throwIfSupabaseError(error, koLabel) {
  if (!error) return;
  console.error(koLabel, error);
  const err = new Error(
    String(error.message || error.details || koLabel || "요청 실패")
  );
  err.code = error.code;
  err.details = error.details;
  err.hint = error.hint;
  err.cause = error;
  throw err;
}

function isMissingImageUrlColumnError(error) {
  const msg = String(error?.message || error?.details || "");
  const code = String(error?.code || "");
  return (
    code === "42703" ||
    (/image_url/i.test(msg) &&
      (/column/i.test(msg) ||
        /schema cache/i.test(msg) ||
        /does not exist/i.test(msg)))
  );
}

function isMissingPlaceNameColumnError(error) {
  const msg = String(error?.message || error?.details || "");
  const code = String(error?.code || "");
  return (
    code === "42703" ||
    (/place_name/i.test(msg) &&
      (/column/i.test(msg) || /schema cache/i.test(msg)))
  );
}

function normalizeListRow(row) {
  if (!row || typeof row !== "object") return row;
  const nested = row.curator_list_places;
  let place_count = 0;
  if (Array.isArray(nested)) {
    if (nested.length > 0 && nested[0]?.count != null) {
      place_count = Number(nested[0].count) || 0;
    } else {
      place_count = nested.length;
    }
  }
  const { curator_list_places: _omit, ...rest } = row;
  return { ...rest, place_count };
}

/**
 * 공개 맛집첩 목록 (홈 디스커버리)
 * @param {{ limit?: number }} [opts]
 */
export async function fetchPublicCuratorLists(opts = {}) {
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(60, Math.floor(opts.limit))
      : 24;

  const { data, error } = await supabase
    .from("curator_lists")
    .select(
      `
      id,
      curator_id,
      title,
      description,
      cover_image_url,
      area,
      theme_tags,
      status,
      is_public,
      created_at,
      updated_at,
      curator_list_places (count)
    `
    )
    .eq("status", "published")
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  throwIfSupabaseError(error, "[공개 맛집첩 조회 실패]");
  return (Array.isArray(data) ? data : []).map(normalizeListRow);
}

/**
 * 내 맛집첩
 * @param {string} curatorId auth uid
 */
export async function fetchMyCuratorLists(curatorId, opts = {}) {
  const cid = assertUuid(curatorId, "fetchMyCuratorLists.curatorId");
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id || user.id !== cid) {
    throw new Error("fetchMyCuratorLists: curatorId must match the signed-in user");
  }
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(100, Math.floor(opts.limit))
      : 50;

  const { data, error } = await supabase
    .from("curator_lists")
    .select(
      `
      *,
      curator_list_places (count)
    `
    )
    .eq("curator_id", cid)
    .order("updated_at", { ascending: false })
    .limit(limit);

  throwIfSupabaseError(error, "[내 맛집첩 조회 실패]");
  return (Array.isArray(data) ? data : []).map(normalizeListRow);
}

/**
 * @param {string} listId
 */
export async function fetchCuratorListById(listId) {
  const id = assertUuid(listId, "fetchCuratorListById.listId");
  const { data, error } = await supabase
    .from("curator_lists")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfSupabaseError(error, "[맛집첩 조회 실패]");
  return data;
}

/**
 * 맛집첩 장소 (+ places 메타)
 * @param {string} listId
 */
export async function fetchCuratorListPlaces(listId) {
  const id = assertUuid(listId, "fetchCuratorListPlaces.listId");

  const selectWithImage = `
      id,
      list_id,
      place_id,
      order_index,
      memo,
      image_url,
      places (
        id,
        name,
        place_name,
        address,
        category,
        category_name,
        lat,
        lng,
        kakao_place_id,
        image_url
      )
    `;
  const selectBasic = `
      id,
      list_id,
      place_id,
      order_index,
      memo,
      places (
        id,
        name,
        address,
        category,
        lat,
        lng,
        kakao_place_id
      )
    `;

  let res = await supabase
    .from("curator_list_places")
    .select(selectWithImage)
    .eq("list_id", id)
    .order("order_index", { ascending: true });

  if (
    res.error &&
    (isMissingImageUrlColumnError(res.error) ||
      isMissingPlaceNameColumnError(res.error))
  ) {
    res = await supabase
      .from("curator_list_places")
      .select(selectBasic)
      .eq("list_id", id)
      .order("order_index", { ascending: true });
  }

  throwIfSupabaseError(res.error, "[맛집첩 장소 조회 실패]");
  return (Array.isArray(res.data) ? res.data : []).map((row) => {
    const pl = row?.places && typeof row.places === "object" ? row.places : {};
    const mapped = mapPlaceRowForCourse(pl) || {};
    return {
      ...row,
      image_url: row.image_url ?? null,
      place_name: mapped.name || pl.name || pl.place_name || "",
      place_address: mapped.address || pl.address || "",
      lat: mapped.lat ?? pl.lat,
      lng: mapped.lng ?? pl.lng,
      kakao_place_id: mapped.kakao_place_id || pl.kakao_place_id || null,
    };
  });
}

/**
 * @param {{
 *   curator_id: string,
 *   title: string,
 *   description?: string|null,
 *   area?: string|null,
 *   theme_tags?: string[],
 *   cover_image_url?: string|null,
 *   status?: string,
 *   is_public?: boolean,
 * }} payload
 */
export async function createCuratorList(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const curator_id = assertUuid(p.curator_id, "createCuratorList.curator_id");
  const title = String(p.title ?? "").trim();
  if (!title) throw new Error("createCuratorList: title required");

  const row = {
    curator_id,
    title,
    description: p.description ?? null,
    area: p.area ?? null,
    theme_tags: Array.isArray(p.theme_tags) ? p.theme_tags : [],
    cover_image_url: p.cover_image_url ?? null,
    status: p.status ?? "draft",
    is_public: p.is_public ?? false,
  };

  const { data, error } = await supabase
    .from("curator_lists")
    .insert(row)
    .select()
    .single();
  throwIfSupabaseError(error, "[맛집첩 생성 실패]");
  return data;
}

/**
 * @param {string} listId
 * @param {Record<string, unknown>} payload
 */
export async function updateCuratorList(listId, payload) {
  const id = assertUuid(listId, "updateCuratorList.listId");
  const p = payload && typeof payload === "object" ? payload : {};
  const patch = {};
  if ("title" in p) {
    const t = String(p.title ?? "").trim();
    if (!t) throw new Error("updateCuratorList: title cannot be empty");
    patch.title = t;
  }
  if ("description" in p) patch.description = p.description;
  if ("area" in p) patch.area = p.area;
  if ("theme_tags" in p)
    patch.theme_tags = Array.isArray(p.theme_tags) ? p.theme_tags : [];
  if ("cover_image_url" in p) patch.cover_image_url = p.cover_image_url;
  if ("status" in p) patch.status = p.status;
  if ("is_public" in p) patch.is_public = p.is_public;

  if (Object.keys(patch).length === 0) {
    return fetchCuratorListById(id);
  }

  const { data, error } = await supabase
    .from("curator_lists")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  throwIfSupabaseError(error, "[맛집첩 수정 실패]");
  return data;
}

export async function deleteCuratorList(listId) {
  const id = assertUuid(listId, "deleteCuratorList.listId");
  const { error } = await supabase.from("curator_lists").delete().eq("id", id);
  throwIfSupabaseError(error, "[맛집첩 삭제 실패]");
}

/**
 * @param {string} listId
 * @param {Array<{ place_id: string, order_index?: number, memo?: string|null, image_url?: string|null }>} places
 */
export async function saveCuratorListPlaces(listId, places) {
  const id = assertUuid(listId, "saveCuratorListPlaces.listId");
  const rows = Array.isArray(places) ? places : [];
  if (rows.length < 1) {
    throw new Error("맛집첩에는 장소를 1곳 이상 넣어 주세요.");
  }
  if (rows.length > 24) {
    throw new Error("맛집첩 장소는 최대 24곳까지입니다.");
  }

  const { error: delErr } = await supabase
    .from("curator_list_places")
    .delete()
    .eq("list_id", id);
  throwIfSupabaseError(delErr, "[맛집첩 장소 초기화 실패]");

  const insertRows = rows.map((r, i) => {
    const imageUrl =
      r.image_url != null ? String(r.image_url).trim() || null : null;
    return {
      list_id: id,
      place_id: assertUuid(r.place_id, `place[${i}]`),
      order_index:
        typeof r.order_index === "number" && Number.isFinite(r.order_index)
          ? Math.max(0, Math.floor(r.order_index))
          : i,
      memo: r.memo != null ? String(r.memo).trim() || null : null,
      image_url: imageUrl,
    };
  });

  let { error: insErr } = await supabase
    .from("curator_list_places")
    .insert(insertRows);

  if (insErr && isMissingImageUrlColumnError(insErr)) {
    const withoutImage = insertRows.map((row) => {
      const next = { ...row };
      delete next.image_url;
      return next;
    });
    const retry = await supabase.from("curator_list_places").insert(withoutImage);
    insErr = retry.error;
  }

  throwIfSupabaseError(insErr, "[맛집첩 장소 저장 실패]");
}

/**
 * @param {string} listId
 * @param {{ skipPlaceCheck?: boolean }} [opts]
 */
export async function publishCuratorList(listId, opts = {}) {
  const id = assertUuid(listId, "publishCuratorList.listId");
  if (!opts.skipPlaceCheck) {
    const places = await fetchCuratorListPlaces(id);
    if (places.length < 1) {
      throw new Error("공개하려면 장소를 1곳 이상 넣어 주세요.");
    }
  }
  return updateCuratorList(id, { status: "published", is_public: true });
}
