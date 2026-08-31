import { supabase } from "./client";

export const REPORT_REASONS = [
  { id: "spam", label: "스팸·광고" },
  { id: "harassment", label: "괴롭힘·혐오" },
  { id: "hate", label: "차별·혐오 발언" },
  { id: "sexual", label: "음란·성적 콘텐츠" },
  { id: "misinfo", label: "허위·오해의 소지" },
  { id: "illegal", label: "불법·위험 행위" },
  { id: "other", label: "기타" },
];

export const REPORT_TARGET_TYPES = [
  "course",
  "place",
  "curator_place",
  "profile",
  "user",
  "photo",
  "pick",
  "checkin",
  "other",
];

/**
 * @param {{
 *   reporterId: string,
 *   targetType: string,
 *   targetId: string,
 *   reason: string,
 *   detail?: string,
 *   targetOwnerId?: string|null,
 * }} input
 */
export async function submitContentReport(input) {
  const reporterId = String(input?.reporterId || "").trim();
  const targetType = String(input?.targetType || "").trim();
  const targetId = String(input?.targetId || "").trim();
  const reason = String(input?.reason || "").trim();
  const detail = String(input?.detail || "").trim() || null;
  const targetOwnerId = input?.targetOwnerId
    ? String(input.targetOwnerId).trim()
    : null;

  if (!reporterId) throw new Error("로그인이 필요해요.");
  if (!REPORT_TARGET_TYPES.includes(targetType)) {
    throw new Error("신고 대상이 올바르지 않아요.");
  }
  if (!targetId) throw new Error("신고 대상을 확인할 수 없어요.");
  if (!REPORT_REASONS.some((r) => r.id === reason)) {
    throw new Error("신고 사유를 선택해 주세요.");
  }
  if (targetOwnerId && targetOwnerId === reporterId) {
    throw new Error("본인 콘텐츠는 신고할 수 없어요.");
  }

  const { data, error } = await supabase
    .from("content_reports")
    .insert({
      reporter_id: reporterId,
      target_type: targetType,
      target_id: targetId,
      target_owner_id: targetOwnerId || null,
      reason,
      detail,
      status: "pending",
    })
    .select("id, created_at")
    .maybeSingle();

  if (error) {
    const msg = error.message || String(error);
    if (/relation .*content_reports.* does not exist/i.test(msg)) {
      throw new Error(
        "신고 기능 준비 중입니다. 잠시 후 다시 시도하거나 고객지원에 문의해 주세요."
      );
    }
    throw new Error(msg);
  }

  return data;
}

/** @returns {Promise<number|null>} */
export async function countPendingContentReports() {
  try {
    const { count, error } = await supabase
      .from("content_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (error) return null;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ status?: string, limit?: number }} [opts]
 */
export async function listContentReports(opts = {}) {
  const status = opts.status || "pending";
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);

  let query = supabase
    .from("content_reports")
    .select(
      "id, reporter_id, target_type, target_id, target_owner_id, reason, detail, status, admin_note, reviewed_by, reviewed_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message || String(error));
  return data || [];
}

/**
 * @param {{
 *   reportId: string,
 *   adminId: string,
 *   status: 'reviewed'|'actioned'|'dismissed',
 *   adminNote?: string,
 * }} input
 */
export async function resolveContentReport(input) {
  const reportId = String(input?.reportId || "").trim();
  const adminId = String(input?.adminId || "").trim();
  const status = String(input?.status || "").trim();
  const adminNote = String(input?.adminNote || "").trim() || null;

  if (!reportId || !adminId) throw new Error("필수 값이 없어요.");
  if (!["reviewed", "actioned", "dismissed"].includes(status)) {
    throw new Error("처리 상태가 올바르지 않아요.");
  }

  const { data, error } = await supabase
    .from("content_reports")
    .update({
      status,
      admin_note: adminNote,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .select("id, status")
    .maybeSingle();

  if (error) throw new Error(error.message || String(error));
  return data;
}

/**
 * 신고 대상 콘텐츠를 비공개·보관 처리 (운영자).
 * @param {{ targetType: string, targetId: string }} input
 */
export async function hideReportedContent(input) {
  const targetType = String(input?.targetType || "").trim();
  const targetId = String(input?.targetId || "").trim();
  if (!targetType || !targetId) throw new Error("대상이 없어요.");

  if (targetType === "course") {
    const { error } = await supabase
      .from("curator_courses")
      .update({
        is_public: false,
        status: "private",
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId);
    if (error) throw new Error(error.message || String(error));
    return { hidden: "course" };
  }

  if (targetType === "curator_place" || targetType === "place") {
    const table =
      targetType === "curator_place" ? "curator_places" : "places";
    const { error } = await supabase
      .from(table)
      .update({ is_archived: true })
      .eq("id", targetId);
    if (error) {
      // places 에 is_archived 없을 수 있음 → curator_places 재시도
      if (targetType === "place") {
        const { error: e2 } = await supabase
          .from("curator_places")
          .update({ is_archived: true })
          .eq("id", targetId);
        if (e2) throw new Error(e2.message || String(e2));
        return { hidden: "curator_place" };
      }
      throw new Error(error.message || String(error));
    }
    return { hidden: table };
  }

  if (targetType === "user" || targetType === "profile") {
    const { error } = await supabase
      .from("curators")
      .update({ status: "suspended" })
      .eq("user_id", targetId);
    if (error && !/0 rows|PGRST116/i.test(error.message || "")) {
      // 큐레이터가 아니면 무시 가능
      if (import.meta.env.DEV) {
        console.warn("[hideReportedContent] curator suspend:", error.message);
      }
    }
    return { hidden: "profile_note" };
  }

  return { hidden: "none" };
}
