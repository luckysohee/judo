import { supabase } from "../lib/supabase";
import { prepareImageFileForUpload } from "./prepareImageFileForUpload";

const BUCKET = "curator-place-photos";

export function curatorPhotoPublicUrl(storagePath) {
  if (!storagePath || typeof storagePath !== "string") return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || "";
}

/**
 * 프로필 전용: `curator-place-photos`에 `{userId}/profile/...` 로만 올림 (curator_place_photos 행 없음)
 * @returns {Promise<string>} 공개 URL
 */
export async function uploadCuratorProfileAvatarFile(file, curatorUserId) {
  if (!file || !curatorUserId) {
    throw new Error("파일과 큐레이터 사용자 ID가 필요합니다.");
  }
  const prepared = await prepareImageFileForUpload(file);
  if (prepared.size > 5 * 1024 * 1024) {
    throw new Error("파일은 5MB 이하여야 합니다.");
  }
  const rawName = (prepared.name || "avatar").toLowerCase();
  const ext = rawName.includes(".")
    ? rawName.split(".").pop()
    : (prepared.type || "").includes("png")
      ? "png"
      : (prepared.type || "").includes("webp")
        ? "webp"
        : (prepared.type || "").includes("gif")
          ? "gif"
          : "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${curatorUserId}/profile/avatar-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${safeExt}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, prepared, { cacheControl: "3600", upsert: false });

  if (upErr) {
    const extra =
      upErr.message?.includes("Bucket not found") || upErr.message?.includes("not found")
        ? " Supabase에서 버킷 curator-place-photos(Public)와 Storage 정책을 확인하세요."
        : upErr.message?.includes("new row violates") || upErr.message?.includes("policy")
          ? " Storage RLS: 경로가 '{본인 user id}/...' 인지, 큐레이터 권한이 있는지 확인하세요."
          : "";
    throw new Error((upErr.message || "프로필 사진 업로드 실패") + extra);
  }

  return curatorPhotoPublicUrl(path);
}

/** 일반 사용자 프로필 — 경로·버킷은 큐레이터 아바타와 동일 (`{userId}/profile/...`) */
export function uploadUserProfileAvatarFile(file, userId) {
  return uploadCuratorProfileAvatarFile(file, userId);
}

function isUuid(s) {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    )
  );
}

/**
 * 큐레이터 업로드 사진 URL 목록 (카카오 장소 ID 또는 내부 places.id)
 * PostgREST `.or()`에 UUID·숫자를 같이 넣으면 파싱이 깨지는 경우가 있어 조회를 나눔.
 */
export async function fetchCuratorPlacePhotoRows({ kakaoPlaceId, internalPlaceId }) {
  const byPath = new Map();

  const pull = async (column, value) => {
    if (value == null || value === "") return;
    const { data, error } = await supabase
      .from("curator_place_photos")
      .select("id,curator_id,storage_path,created_at")
      .eq(column, value)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("fetchCuratorPlacePhotoRows", column, error.message);
      return;
    }
    for (const row of data || []) {
      if (row?.storage_path && !byPath.has(row.storage_path)) {
        byPath.set(row.storage_path, {
          id: row.id,
          curator_id: row.curator_id,
          storage_path: row.storage_path,
          created_at: row.created_at,
        });
      }
    }
  };

  await Promise.all([
    pull("kakao_place_id", kakaoPlaceId != null ? String(kakaoPlaceId) : null),
    pull("place_id", internalPlaceId && isUuid(internalPlaceId) ? internalPlaceId : null),
  ]);

  return Array.from(byPath.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

export async function fetchCuratorPlacePhotoUrls(params) {
  const rows = await fetchCuratorPlacePhotoRows(params);
  return rows
    .map((r) => curatorPhotoPublicUrl(r.storage_path))
    .filter(Boolean);
}

/**
 * @param {Object} opts
 * @param {File} opts.file
 * @param {string} opts.curatorId - auth user id
 * @param {string|null} opts.kakaoPlaceId
 * @param {string|null} opts.placeId - places.id uuid
 */
export async function uploadCuratorPlacePhoto({
  file,
  curatorId,
  kakaoPlaceId,
  placeId,
}) {
  if (!kakaoPlaceId && !placeId) {
    throw new Error("kakao_place_id 또는 place_id가 필요합니다.");
  }
  const ext = (file.name && file.name.includes(".")
    ? file.name.split(".").pop()
    : "jpg"
  ).toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)
    ? ext
    : "jpg";
  const path = `${curatorId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${safeExt}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (upErr) {
    const extra =
      upErr.message?.includes("Bucket not found") || upErr.message?.includes("not found")
        ? " Supabase SQL Editor에서 database/migrations/20260410_ensure_curator_place_photos_bucket.sql 를 실행하거나, Dashboard → Storage에서 버킷 이름 curator-place-photos(Public)를 만드세요."
        : upErr.message?.includes("new row violates") ||
            upErr.message?.includes("policy")
          ? " Storage RLS: 경로가 '{본인 user id}/파일명' 형식인지, 큐레이터 권한이 있는지 확인하세요."
          : "";
    throw new Error((upErr.message || "스토리지 업로드 실패") + extra);
  }

  const { error: insErr } = await supabase.from("curator_place_photos").insert({
    curator_id: curatorId,
    kakao_place_id: kakaoPlaceId || null,
    place_id: placeId || null,
    storage_path: path,
  });

  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    const missingTable =
      insErr.message?.includes("Could not find the table") ||
      insErr.message?.includes("schema cache");
    const hint = missingTable
      ? " Supabase SQL Editor에서 database/migrations/20260408_curator_place_photos.sql 전체를 실행한 뒤 잠시 기다리세요."
      : insErr.code === "42501" || insErr.message?.includes("policy")
        ? " (RLS: curators·관리자만 삽입 가능)"
        : "";
    const msg = [insErr.message, insErr.details, insErr.hint]
      .filter(Boolean)
      .join(" — ");
    throw new Error((msg || "DB 저장 실패") + hint);
  }

  return curatorPhotoPublicUrl(path);
}

/**
 * 본인이 올린 행만 삭제 (RLS: auth.uid() = curator_id)
 * DB 행 삭제 후 스토리지 객체 제거
 */
export async function deleteCuratorPlacePhoto({ id, storagePath }) {
  if (!id || !storagePath) {
    throw new Error("삭제할 사진 정보가 없습니다.");
  }
  const { error: dbErr } = await supabase
    .from("curator_place_photos")
    .delete()
    .eq("id", id);

  if (dbErr) {
    const hint =
      dbErr.code === "42501" || dbErr.message?.includes("policy")
        ? " 본인이 등록한 사진만 삭제할 수 있습니다."
        : "";
    throw new Error((dbErr.message || "삭제에 실패했습니다.") + hint);
  }

  const { error: stErr } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);
  if (stErr) {
    console.warn("curator storage remove:", stErr.message);
  }
}
