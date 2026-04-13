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

/**
 * 본인 user_saved_place_folders 에서 해당 folder_key 를 모두 제거한 뒤 system_folders 행 삭제.
 * (FK: folder_key → system_folders.key)
 */
export async function deleteOwnCustomSystemFolder(supabase, userId, folderKey) {
  const { data: uspRows, error: uspErr } = await supabase
    .from("user_saved_places")
    .select("id")
    .eq("user_id", userId);
  if (uspErr) return { error: uspErr };

  const ids = (uspRows || []).map((r) => r.id).filter(Boolean);
  if (ids.length > 0) {
    const { error: linkErr } = await supabase
      .from("user_saved_place_folders")
      .delete()
      .eq("folder_key", folderKey)
      .in("user_saved_place_id", ids);
    if (linkErr) return { error: linkErr };
  }

  const { error: delErr } = await supabase
    .from("system_folders")
    .delete()
    .eq("key", folderKey);
  return { error: delErr };
}
