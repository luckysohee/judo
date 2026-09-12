import { supabase } from "./client";

function normalizeAssessment(raw) {
  if (!raw || typeof raw !== "object") {
    return { level: "ok", overlap_count: 0, overlap_ratio: 0, message: null };
  }
  const level = String(raw.level || "ok").toLowerCase();
  const safeLevel =
    level === "block" || level === "warn" ? level : "ok";
  return {
    level: safeLevel,
    overlap_count: Number(raw.overlap_count) || 0,
    overlap_ratio: Number(raw.overlap_ratio) || 0,
    my_public_count: Number(raw.my_public_count) || 0,
    message:
      raw.message != null && String(raw.message).trim()
        ? String(raw.message).trim()
        : null,
  };
}

/**
 * 공개 전 타 큐레이터와 장소 목록 겹침 평가 (경고 4+/70%, 차단 5+/75%는 DB 트리거).
 * @param {string} placeId places.id
 */
export async function assessCuratorPlacePublishOverlap(placeId) {
  const pid = String(placeId ?? "").trim();
  if (!pid) return normalizeAssessment({ level: "ok" });

  const { data, error } = await supabase.rpc(
    "check_curator_place_publish_overlap",
    { p_place_id: pid }
  );

  if (error) {
    const msg = String(error.message || "");
    if (
      /function.*does not exist|schema cache|could not find/i.test(msg)
    ) {
      console.warn(
        "[assessCuratorPlacePublishOverlap] migration not applied:",
        msg
      );
      return normalizeAssessment({ level: "ok" });
    }
    throw error;
  }

  return normalizeAssessment(data);
}

/**
 * 경고 시 confirm, 차단 시 throw. 취소 시 false.
 * @param {string} placeId
 * @param {{ confirm?: (message: string) => boolean }} [opts]
 * @returns {Promise<boolean>}
 */
export async function confirmCuratorPlacePublishOverlapIfNeeded(
  placeId,
  opts = {}
) {
  const assessment = await assessCuratorPlacePublishOverlap(placeId);
  const confirmFn =
    typeof opts.confirm === "function" ? opts.confirm : window.confirm.bind(window);

  if (assessment.level === "block") {
    const err = new Error(
      assessment.message ||
        "다른 큐레이터와 공개 장소가 너무 많이 겹쳐 공개할 수 없어요."
    );
    throw err;
  }

  if (assessment.level === "warn") {
    const detail =
      assessment.overlap_count > 0
        ? `\n(겹침 ${assessment.overlap_count}곳)`
        : "";
    const ok = confirmFn(
      `${assessment.message || "다른 큐레이터와 공개 장소가 많이 겹쳐요."}${detail}\n\n그래도 공개할까요?`
    );
    if (!ok) return false;
  }

  return true;
}
