/**
 * system_folders.created_by 컬럼은 마이그레이션(20260426120000) 이후에만 존재합니다.
 * 컬럼이 없으면 SELECT/INSERT 한 번 실패 후 created_by 없이 재시도합니다.
 */
let createdByColumnAvailable = true;

function missingCreatedByColumnError(err) {
  const msg = String(err?.message || err?.details || err?.hint || "").toLowerCase();
  if (!msg.includes("created_by")) return false;
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("column")
  );
}

/** 편집 UI 등: 컬럼이 없으면 소유자 필터 없음 */
export function systemFoldersHasCreatedByColumn() {
  return createdByColumnAvailable;
}

export async function selectSystemFoldersOrdered(supabase) {
  const full = "key, name, color, icon, sort_order, created_by";
  const minimal = "key, name, color, icon, sort_order";

  // 매 요청마다 full select 시도 — 예전에 컬럼 없어 false로 굳은 뒤 마이그레이션한 경우에도 복구됨
  const rFull = await supabase
    .from("system_folders")
    .select(full)
    .order("sort_order", { ascending: true });
  if (!rFull.error) {
    createdByColumnAvailable = true;
    return rFull;
  }
  if (missingCreatedByColumnError(rFull.error)) {
    createdByColumnAvailable = false;
    return supabase
      .from("system_folders")
      .select(minimal)
      .order("sort_order", { ascending: true });
  }
  return rFull;
}

export async function insertSystemFolderRow(supabase, row) {
  const strip = (r) => {
    const { created_by: _c, ...rest } = r;
    return rest;
  };

  let r = await supabase.from("system_folders").insert(row);
  if (!r.error) {
    createdByColumnAvailable = true;
    return r;
  }
  if (missingCreatedByColumnError(r.error)) {
    createdByColumnAvailable = false;
    r = await supabase.from("system_folders").insert(strip(row));
  }
  return r;
}

const IN_CHUNK = 40;

function chunkIds(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(ids.slice(i, i + IN_CHUNK));
  }
  return out;
}

/** curator_places 가 auth.uid() 또는 curators.id 로 저장된 레거시 모두 제거 */
async function deleteCuratorPlacesForPlaceBatches(
  supabase,
  authUserId,
  curatorRowId,
  placeIdBatches
) {
  const alt =
    curatorRowId && String(curatorRowId) !== String(authUserId)
      ? String(curatorRowId)
      : null;
  for (const batch of placeIdBatches) {
    if (!batch.length) continue;
    const { error: e1 } = await supabase
      .from("curator_places")
      .delete()
      .eq("curator_id", authUserId)
      .in("place_id", batch);
    if (e1) return e1;
    if (alt) {
      const { error: e2 } = await supabase
        .from("curator_places")
        .delete()
        .eq("curator_id", alt)
        .in("place_id", batch);
      if (e2) return e2;
    }
  }
  return null;
}

function mergeFolderDeleteHints(serverLinkedIds, serverPlaceIds, hint) {
  const linked = new Set((serverLinkedIds || []).map(String).filter(Boolean));
  const places = new Set((serverPlaceIds || []).map(String).filter(Boolean));
  for (const id of hint?.savedPlaceIds || []) {
    if (id != null && id !== "") linked.add(String(id));
  }
  for (const id of hint?.placeIds || []) {
    if (id != null && id !== "") places.add(String(id));
  }
  return {
    linkedUnique: [...linked],
    deletedPlaceIds: [...places],
  };
}

function rpcMissingError(err) {
  if (!err) return false;
  const code = err.code;
  const msg = String(err.message || err.details || "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "42883" ||
    msg.includes("studio_delete_own_custom_folder") ||
    msg.includes("could not find the function") ||
    msg.includes("does not exist")
  );
}

/**
 * PostgREST 다단계 DELETE + RLS 우회 실패 시 폴더/잔이 안 지워지는 경우가 있어,
 * 가능하면 DB 함수 studio_delete_own_custom_folder (SECURITY DEFINER) 를 먼저 호출.
 * 마이그레이션 미적용 시에만 예전 클라이언트 경로로 폴백.
 */
async function deleteOwnCustomSystemFolderClient(
  supabase,
  userId,
  folderKey,
  hint
) {
  const empty = { error: null, deletedPlaceIds: [] };

  const { data: linkRows, error: linkErr } = await supabase
    .from("user_saved_place_folders")
    .select("user_saved_place_id")
    .eq("folder_key", folderKey);

  if (linkErr) return { ...empty, error: linkErr };

  const folderUspIds = [
    ...new Set(
      (linkRows || []).map((r) => r.user_saved_place_id).filter(Boolean)
    ),
  ];

  const curatorAlt =
    hint?.curatorRowId &&
    String(hint.curatorRowId) !== String(userId)
      ? String(hint.curatorRowId)
      : null;

  const linkedFromServer = [];
  const placesFromServer = [];
  for (const batch of chunkIds(folderUspIds)) {
    if (batch.length === 0) continue;
    let q = supabase
      .from("user_saved_places")
      .select("id, place_id")
      .in("id", batch);
    if (curatorAlt) {
      q = q.or(`user_id.eq.${userId},user_id.eq.${curatorAlt}`);
    } else {
      q = q.eq("user_id", userId);
    }
    const { data: uspBatch, error: uspErr } = await q;
    if (uspErr) return { ...empty, error: uspErr };
    for (const r of uspBatch || []) {
      if (r.id) linkedFromServer.push(r.id);
      if (r.place_id != null) placesFromServer.push(String(r.place_id));
    }
  }

  const { linkedUnique, deletedPlaceIds } = mergeFolderDeleteHints(
    linkedFromServer,
    placesFromServer,
    hint
  );

  for (const batch of chunkIds(linkedUnique)) {
    if (batch.length === 0) continue;
    const { error: delUspErr } = await supabase
      .from("user_saved_places")
      .delete()
      .eq("user_id", userId)
      .in("id", batch);
    if (delUspErr) return { ...empty, error: delUspErr, deletedPlaceIds };
    if (curatorAlt) {
      const { error: delUsp2 } = await supabase
        .from("user_saved_places")
        .delete()
        .eq("user_id", curatorAlt)
        .in("id", batch);
      if (delUsp2) return { ...empty, error: delUsp2, deletedPlaceIds };
    }
  }

  const cpErr = await deleteCuratorPlacesForPlaceBatches(
    supabase,
    userId,
    hint?.curatorRowId,
    chunkIds(deletedPlaceIds)
  );
  if (cpErr) return { error: cpErr, deletedPlaceIds };

  const { error: delErr } = await supabase
    .from("system_folders")
    .delete()
    .eq("key", folderKey);
  return { error: delErr, deletedPlaceIds };
}

/**
 * 이 폴더에 연결된 본인 user_saved_places 를 모두 삭제하고,
 * 같은 장소(place_id)에 대한 본인 curator_places 추천 행도 삭제해 스튜디오 잔 리스트에서 빠지게 함.
 * 마지막으로 system_folders 행 삭제.
 */
export async function deleteOwnCustomSystemFolder(
  supabase,
  userId,
  folderKey,
  hint = null
) {
  const { data, error } = await supabase.rpc("studio_delete_own_custom_folder", {
    p_folder_key: folderKey,
  });

  if (!error && data && typeof data === "object" && "ok" in data) {
    if (data.ok === false) {
      return {
        error: { message: String(data.error || "삭제하지 못했습니다.") },
        deletedPlaceIds: [],
      };
    }
    if (data.ok === true) {
      const fromRpc = Array.isArray(data.deleted_place_ids)
        ? data.deleted_place_ids.map((x) => String(x))
        : [];
      const hintPlaces = (hint?.placeIds || [])
        .map((x) => String(x))
        .filter(Boolean);
      const merged = [...new Set([...fromRpc, ...hintPlaces])];
      if (merged.length > 0) {
        const mopErr = await deleteCuratorPlacesForPlaceBatches(
          supabase,
          userId,
          hint?.curatorRowId,
          chunkIds(merged)
        );
        if (mopErr) {
          return { error: mopErr, deletedPlaceIds: merged };
        }
      }
      return { error: null, deletedPlaceIds: merged };
    }
  }

  if (error && rpcMissingError(error)) {
    return deleteOwnCustomSystemFolderClient(
      supabase,
      userId,
      folderKey,
      hint
    );
  }

  if (error) {
    return { error, deletedPlaceIds: [] };
  }

  return deleteOwnCustomSystemFolderClient(supabase, userId, folderKey, hint);
}
