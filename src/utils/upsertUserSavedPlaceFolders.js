/**
 * user_saved_places 행을 (user_id, place_id)로 찾거나 만든 뒤 user_saved_place_folders를 교체.
 * PostgREST upsert onConflict 가 환경마다 달라 실패할 수 있어 SELECT → INSERT/UPDATE 로 통일.
 */
export async function upsertUserSavedPlaceFolders(
  supabase,
  {
    placeId,
    folderKeys,
    firstSavedFrom = "studio",
    /** insert/update 시 user_saved_places에 함께 넣을 컬럼 (예: search_session_id) */
    extraSavedPlaceFields = null,
  }
) {
  const pid = placeId != null ? String(placeId).trim() : "";
  if (!pid) {
    return { ok: false, message: "장소 ID가 없습니다." };
  }
  if (!folderKeys?.length) {
    return { ok: true };
  }

  const {
    data: authData,
    error: authErr,
  } = await supabase.auth.getUser();
  const authUser = authData?.user;
  if (authErr || !authUser?.id) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  const { data: existing, error: exErr } = await supabase
    .from("user_saved_places")
    .select("id")
    .eq("user_id", authUser.id)
    .eq("place_id", pid)
    .maybeSingle();

  if (exErr) {
    console.error("user_saved_places select:", exErr);
    return {
      ok: false,
      message: exErr.message || "내 저장 조회에 실패했습니다.",
    };
  }

  let savedPlaceId = existing?.id ?? null;

  if (!savedPlaceId) {
    const { data: inserted, error: insErr } = await supabase
      .from("user_saved_places")
      .insert({
        user_id: authUser.id,
        place_id: pid,
        first_saved_from: firstSavedFrom,
        ...(extraSavedPlaceFields && typeof extraSavedPlaceFields === "object"
          ? extraSavedPlaceFields
          : {}),
      })
      .select("id")
      .single();

    if (insErr) {
      if (insErr.code === "23505") {
        const { data: again, error: againErr } = await supabase
          .from("user_saved_places")
          .select("id")
          .eq("user_id", authUser.id)
          .eq("place_id", pid)
          .maybeSingle();
        if (!againErr && again?.id) {
          savedPlaceId = again.id;
        }
      }
      if (!savedPlaceId) {
        console.error("user_saved_places insert:", insErr);
        return {
          ok: false,
          message: insErr.message || "내 저장에 넣지 못했습니다.",
        };
      }
    } else {
      savedPlaceId = inserted?.id ?? null;
    }
  } else {
    const patch = { first_saved_from: firstSavedFrom };
    if (extraSavedPlaceFields && typeof extraSavedPlaceFields === "object") {
      Object.assign(patch, extraSavedPlaceFields);
    }
    await supabase.from("user_saved_places").update(patch).eq("id", savedPlaceId);
  }

  if (!savedPlaceId) {
    return { ok: false, message: "저장 행 ID를 받지 못했습니다." };
  }

  await supabase
    .from("user_saved_place_folders")
    .delete()
    .eq("user_saved_place_id", savedPlaceId);

  const { error: folderError } = await supabase
    .from("user_saved_place_folders")
    .insert(
      folderKeys.map((folder_key) => ({
        user_saved_place_id: savedPlaceId,
        folder_key,
      }))
    );

  if (folderError) {
    console.error("user_saved_place_folders insert:", folderError);
    return {
      ok: false,
      message: folderError.message || "폴더 연결에 실패했습니다.",
    };
  }

  return { ok: true };
}
