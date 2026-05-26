import { supabase } from "./client";
import { getSupabaseUserSafe } from "../lib/supabaseAuth";
import { isSupabaseSchemaMissingError } from "../utils/supabaseSchemaErrors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuid(id) {
  const s = String(id ?? "").trim().toLowerCase();
  if (!s || !UUID_RE.test(s)) return null;
  return s;
}

function errorText(error) {
  if (!error || typeof error !== "object") return "";
  return [error.message, error.details, error.hint].filter(Boolean).join(" ");
}

function isSupabaseConflictError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code ?? "");
  if (code === "23503" || code === "P0001") return false;
  if (code === "23505") return true;
  const status = Number(
    error.status ?? error.statusCode ?? error.status_code ?? 0
  );
  if (status === 409 && code !== "23503") return true;
  const msg = errorText(error).toLowerCase();
  return /duplicate|unique|conflict|already exists|violates unique/.test(msg);
}

async function lookupImportedSnapshotIdViaRpc(sourceId) {
  const { data, error } = await supabase.rpc(
    "get_my_imported_course_snapshot_id",
    { p_source_course_id: sourceId }
  );
  if (error) {
    if (isSupabaseSchemaMissingError(error)) return null;
    return null;
  }
  return parseUuid(data);
}

async function lookupImportedSnapshotIdViaTable(sourceId, userId) {
  const { data, error } = await supabase
    .from("curator_courses")
    .select("id")
    .eq("curator_id", userId)
    .eq("imported_from_course_id", sourceId)
    .maybeSingle();

  if (error) {
    if (!isSupabaseSchemaMissingError(error)) {
      console.warn("[lookupImportedSnapshotIdViaTable]", error);
    }
    return null;
  }
  return data?.id ? String(data.id) : null;
}

/**
 * @returns {Promise<string|null>} 내 스냅샷 course id
 */
export async function findMyImportedCourseIdForSource(sourceCourseId) {
  const sourceId = parseUuid(sourceCourseId);
  const user = await getSupabaseUserSafe();
  if (!sourceId || !user?.id) return null;

  const fromRpc = await lookupImportedSnapshotIdViaRpc(sourceId);
  if (fromRpc) return fromRpc;

  return lookupImportedSnapshotIdViaTable(sourceId, user.id);
}

/**
 * @returns {Promise<boolean>}
 */
export async function isPublicCourseImportedByMe(sourceCourseId) {
  return Boolean(await findMyImportedCourseIdForSource(sourceCourseId));
}

/**
 * 공개 코스를 내 계정에 읽기 전용 스크랩(스냅샷)으로 저장
 * @returns {Promise<string>} 스냅샷 course id
 */
export async function importPublicCuratorCourseSnapshot(sourceCourseId) {
  const sourceId = parseUuid(sourceCourseId);
  if (!sourceId) throw new Error("코스 ID가 올바르지 않습니다.");

  const user = await getSupabaseUserSafe();
  if (!user?.id) throw new Error("로그인이 필요합니다.");

  const existingId = await findMyImportedCourseIdForSource(sourceId);
  if (existingId) return existingId;

  const { data, error } = await supabase.rpc("import_curator_course_snapshot", {
    p_source_course_id: sourceId,
  });

  if (error) {
    console.warn("[importPublicCuratorCourseSnapshot]", error);

    if (isSupabaseConflictError(error)) {
      const retryId = await findMyImportedCourseIdForSource(sourceId);
      if (retryId) return retryId;
    }

    if (isSupabaseSchemaMissingError(error)) {
      throw new Error(
        "코스 스크랩 DB가 아직 적용되지 않았어요. supabase/migrations/20260519140000_curator_course_imported_snapshots.sql 과 20260520120000_course_scrap_allow_authenticated_users.sql 을 실행해 주세요."
      );
    }

    const msg = String(error.message || "");
    if (msg.includes("내가 만든 코스")) {
      throw new Error("내가 만든 코스는 스크랩할 수 없어요.");
    }
    if (msg.includes("공개된 코스만")) {
      throw new Error("공개된 코스만 스크랩할 수 있어요.");
    }
    if (msg.includes("장소가 없는")) {
      throw new Error("장소가 없는 코스는 스크랩할 수 없어요.");
    }
    if (isSupabaseConflictError(error)) {
      throw new Error("이미 스크랩한 코스예요. 스크랩 목록을 확인해 주세요.");
    }
    throw new Error(msg || "코스 스크랩에 실패했습니다.");
  }

  const id = parseUuid(data);
  if (!id) throw new Error("코스 스크랩에 실패했습니다.");
  return id;
}

/**
 * 스크랩한 코스 스냅샷 삭제 (원본 코스는 유지)
 * @param {string} snapshotCourseId
 */
export async function removeImportedCuratorCourse(snapshotCourseId) {
  const id = parseUuid(snapshotCourseId);
  if (!id) throw new Error("코스 ID가 올바르지 않습니다.");

  const user = await getSupabaseUserSafe();
  if (!user?.id) throw new Error("로그인이 필요합니다.");

  const { data: row, error: selErr } = await supabase
    .from("curator_courses")
    .select("id, curator_id, imported_from_course_id")
    .eq("id", id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (!row?.id) throw new Error("스크랩한 코스를 찾을 수 없습니다.");
  if (String(row.curator_id) !== String(user.id)) {
    throw new Error("삭제 권한이 없습니다.");
  }
  if (!row.imported_from_course_id) {
    throw new Error("직접 만든 코스는 여기서 삭제할 수 없습니다.");
  }

  const { error: delErr } = await supabase
    .from("curator_courses")
    .delete()
    .eq("id", id);
  if (delErr) throw delErr;
}

/**
 * @param {string} sourceCourseId 공개 원본 코스 id
 */
export async function removeImportedCuratorCourseBySource(sourceCourseId) {
  const existingId = await findMyImportedCourseIdForSource(sourceCourseId);
  if (!existingId) return;
  await removeImportedCuratorCourse(existingId);
}

/**
 * @returns {Promise<{ imported: boolean, snapshotId?: string }>}
 */
export async function togglePublicCuratorCourseImport(sourceCourseId) {
  const sourceId = parseUuid(sourceCourseId);
  if (!sourceId) throw new Error("코스 ID가 올바르지 않습니다.");

  const existingId = await findMyImportedCourseIdForSource(sourceId);
  if (existingId) {
    await removeImportedCuratorCourse(existingId);
    return { imported: false };
  }

  const snapshotId = await importPublicCuratorCourseSnapshot(sourceId);
  return { imported: true, snapshotId };
}
