/**
 * user_saved_places 행을 (user_id, place_id)로 찾거나 만든 뒤 user_saved_place_folders를 교체.
 * PostgREST upsert onConflict 가 환경마다 달라 실패할 수 있어 SELECT → INSERT/UPDATE 로 통일.
 *
 * 레거시: user_saved_places.user_id 가 auth.uid() 가 아니라 curators.id 인 행이 있으면,
 * auth 기준만 조회 시 못 찾아 같은 place_id 로 두 번째 행이 생길 수 있음 → OR 조회 후 중복 행 제거.
 *
 * place_id 컬럼은 places.id(UUID)만 허용. 카카오 검색/지도 픽은 id가 "kakao_숫자"일 수 있어
 * kakao_place_id로 places를 찾거나(없으면 좌표·이름으로 한 줄 insert) UUID로 치환한다.
 */

import { normalizeKakaoPlaceId } from "./mergePickedPlaceWithCuratorCatalog.js";
import { resolvePlaceWgs84 } from "./placeCoords.js";

function isUuidString(s) {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s.trim()
    )
  );
}

function kakaoIdFromRawPlaceId(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  if (t.startsWith("kakao_") && /^\d+$/.test(t.slice(6))) return t.slice(6);
  if (/^\d+$/.test(t)) return t;
  return null;
}

/**
 * user_saved_places.place_id 에 넣을 UUID 확보
 * @returns {{ ok: true, uuid: string } | { ok: false, message: string }}
 */
async function resolvePlaceIdToUuid(supabase, placeId, placeSnapshot) {
  if (isUuidString(placeId)) {
    return { ok: true, uuid: String(placeId).trim() };
  }

  const kid =
    normalizeKakaoPlaceId(placeSnapshot) || kakaoIdFromRawPlaceId(placeId);
  if (!kid) {
    return {
      ok: false,
      message:
        "이 장소는 저장용 DB ID가 없습니다. 지도·검색에서 고른 장소인지 확인해 주세요.",
    };
  }

  const { data: rows, error: selErr } = await supabase
    .from("places")
    .select("id")
    .eq("kakao_place_id", kid)
    .limit(1);

  if (selErr) {
    return {
      ok: false,
      message: selErr.message || "장소 조회에 실패했습니다.",
    };
  }

  const existing = rows?.[0]?.id;
  if (existing) return { ok: true, uuid: String(existing) };

  const w = placeSnapshot ? resolvePlaceWgs84(placeSnapshot) : null;
  if (!w || !Number.isFinite(w.lat) || !Number.isFinite(w.lng)) {
    return {
      ok: false,
      message: "장소 좌표를 알 수 없어 등록하지 못했습니다. 다시 선택해 주세요.",
    };
  }

  const rowPayload = {
    kakao_place_id: kid,
    name:
      placeSnapshot.place_name ||
      placeSnapshot.name ||
      "이름 없음",
    address:
      placeSnapshot.road_address_name ||
      placeSnapshot.address_name ||
      placeSnapshot.address ||
      "",
    category: placeSnapshot.category_name || placeSnapshot.category || "",
    lat: w.lat,
    lng: w.lng,
  };

  const { data: ins, error: insErr } = await supabase
    .from("places")
    .insert(rowPayload)
    .select("id")
    .single();

  if (!insErr && ins?.id) {
    return { ok: true, uuid: String(ins.id) };
  }

  if (insErr?.code === "23505") {
    const { data: again } = await supabase
      .from("places")
      .select("id")
      .eq("kakao_place_id", kid)
      .maybeSingle();
    if (again?.id) return { ok: true, uuid: String(again.id) };
  }

  return {
    ok: false,
    message: insErr?.message || "장소를 DB에 등록하지 못했습니다.",
  };
}

async function fetchCuratorPkForAuthUser(supabase, authUserId) {
  const { data: curRow } = await supabase
    .from("curators")
    .select("id")
    .eq("user_id", authUserId)
    .maybeSingle();
  return curRow?.id ?? null;
}

function ownedUserSavedPlacesQuery(supabase, placeId, authUserId, curatorPk) {
  let q = supabase
    .from("user_saved_places")
    .select("id, user_id")
    .eq("place_id", placeId);
  if (curatorPk && String(curatorPk) !== String(authUserId)) {
    q = q.or(`user_id.eq.${authUserId},user_id.eq.${curatorPk}`);
  } else {
    q = q.eq("user_id", authUserId);
  }
  return q;
}

/** 같은 장소에 본인 소유 user_saved_places 가 여러 줄이면 auth.uid() 행을 우선 남기고 나머지 삭제 */
async function dedupeUserSavedPlacesForPlace(supabase, rows, authUserId) {
  if (!rows?.length) return null;
  const canonical =
    rows.find((r) => String(r.user_id) === String(authUserId)) || rows[0];
  const duplicates = rows.filter((r) => r.id !== canonical.id);
  for (const dup of duplicates) {
    await supabase
      .from("user_saved_place_folders")
      .delete()
      .eq("user_saved_place_id", dup.id);
    const { error } = await supabase
      .from("user_saved_places")
      .delete()
      .eq("id", dup.id);
    if (error) {
      console.warn("user_saved_places dedupe delete:", error);
    }
  }
  return canonical.id;
}

export async function upsertUserSavedPlaceFolders(
  supabase,
  {
    placeId,
    /** UUID가 아닐 때 places 행 조회·생성에 사용 (카카오 픽 등) */
    placeSnapshot = null,
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

  const resolved = await resolvePlaceIdToUuid(supabase, pid, placeSnapshot);
  if (!resolved.ok) {
    return { ok: false, message: resolved.message };
  }
  const uuidPlaceId = resolved.uuid;

  const {
    data: authData,
    error: authErr,
  } = await supabase.auth.getUser();
  const authUser = authData?.user;
  if (authErr || !authUser?.id) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  const curatorPk = await fetchCuratorPkForAuthUser(supabase, authUser.id);

  const { data: uspRows, error: exErr } = await ownedUserSavedPlacesQuery(
    supabase,
    uuidPlaceId,
    authUser.id,
    curatorPk
  );

  if (exErr) {
    console.error("user_saved_places select:", exErr);
    return {
      ok: false,
      message: exErr.message || "내 저장 조회에 실패했습니다.",
    };
  }

  let savedPlaceId = await dedupeUserSavedPlacesForPlace(
    supabase,
    uspRows || [],
    authUser.id
  );
  let isNewInsert = false;

  if (!savedPlaceId) {
    const { data: inserted, error: insErr } = await supabase
      .from("user_saved_places")
      .insert({
        user_id: authUser.id,
        place_id: uuidPlaceId,
        first_saved_from: firstSavedFrom,
        ...(extraSavedPlaceFields && typeof extraSavedPlaceFields === "object"
          ? extraSavedPlaceFields
          : {}),
      })
      .select("id")
      .single();

    if (insErr) {
      if (insErr.code === "23505") {
        const { data: againRows } = await ownedUserSavedPlacesQuery(
          supabase,
          uuidPlaceId,
          authUser.id,
          curatorPk
        );
        savedPlaceId = await dedupeUserSavedPlacesForPlace(
          supabase,
          againRows || [],
          authUser.id
        );
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
      isNewInsert = true;
    }
  }

  if (!savedPlaceId) {
    return { ok: false, message: "저장 행 ID를 받지 못했습니다." };
  }

  if (!isNewInsert) {
    const patch = { first_saved_from: firstSavedFrom };
    if (extraSavedPlaceFields && typeof extraSavedPlaceFields === "object") {
      Object.assign(patch, extraSavedPlaceFields);
    }
    await supabase.from("user_saved_places").update(patch).eq("id", savedPlaceId);
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

  return { ok: true, placeUuid: uuidPlaceId };
}
