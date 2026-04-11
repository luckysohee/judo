/** @typedef {{ action: string, targetUserId?: string|null, meta?: Record<string, unknown> }} AdminAuditPayload */

/**
 * (선택) 클라이언트에서 감사 로그 1건 추가. 신청·큐레이터 변경 등은 DB 트리거가 기록함.
 * 마이그레이션 `20260421120000_admin_audit_server_triggers` 적용 후에는 대부분 서버만 신뢰.
 */
export async function appendAdminAuditLog(supabase, { action, targetUserId = null, meta = {} }) {
  try {
    const { error } = await supabase.rpc("append_admin_audit_log", {
      p_action: action,
      p_target_user_id: targetUserId || null,
      p_meta: meta,
    });
    if (error) {
      console.warn("append_admin_audit_log:", error.message || error);
    }
  } catch (e) {
    console.warn("append_admin_audit_log:", e);
  }
}

export const ADMIN_AUDIT_ACTION = {
  APPLICATION_APPROVED: "application_approved",
  APPLICATION_REJECTED: "application_rejected",
  APPLICATION_DELETED: "application_deleted",
  APPLICATION_REVOKE_CURATOR: "application_revoke_curator",
  CURATOR_GRADE_CHANGED: "curator_grade_changed",
  CURATOR_STATUS_CHANGED: "curator_status_changed",
  CURATOR_REVOKED: "curator_revoked",
  GRADE_REVIEW_DISMISSED: "grade_review_dismissed",
};

/** 한글 표시용 (AdminCuratorsAuditPage 등) */
export const ADMIN_AUDIT_ACTION_LABEL_KO = {
  [ADMIN_AUDIT_ACTION.APPLICATION_APPROVED]: "신청 승인",
  [ADMIN_AUDIT_ACTION.APPLICATION_REJECTED]: "신청 반려",
  [ADMIN_AUDIT_ACTION.APPLICATION_DELETED]: "신청 삭제",
  [ADMIN_AUDIT_ACTION.APPLICATION_REVOKE_CURATOR]: "신청 목록에서 자격 되돌리기",
  [ADMIN_AUDIT_ACTION.CURATOR_GRADE_CHANGED]: "큐레이터 등급 변경",
  [ADMIN_AUDIT_ACTION.CURATOR_STATUS_CHANGED]: "큐레이터 상태 변경",
  [ADMIN_AUDIT_ACTION.CURATOR_REVOKED]: "큐레이터 자격 박탈",
  [ADMIN_AUDIT_ACTION.GRADE_REVIEW_DISMISSED]: "승급 검토 알림 해제",
};
