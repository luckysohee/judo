import { getApiAuthHeaders } from "./apiAuthHeaders.js";

const AI_API_BASE = (import.meta.env.VITE_AI_API_BASE_URL || "").replace(
  /\/$/,
  ""
);

export const COURSE_DRAFT_ASSIST_MS = 22000;

/**
 * @param {Response} res
 * @param {object|null} data
 */
function failureFromResponse(res, data) {
  if (res.status === 401) {
    return {
      ok: false,
      reason: "unauthorized",
      message: "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
    };
  }
  if (res.status === 402) {
    return {
      ok: false,
      quotaExceeded: true,
      reason: "quota_exceeded",
      message:
        data?.message ||
        "이번 달 무료 AI 코스 초안 횟수를 모두 사용했어요.",
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      reason: "rate_limited",
      message: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
    };
  }
  return {
    ok: false,
    reason: data?.reason || "http_error",
    message:
      data?.message ||
      data?.error ||
      `AI 초안 API 오류 (${res.status}). 잠시 후 다시 시도해 주세요.`,
  };
}

/**
 * @param {{
 *   query: string,
 *   parsed?: Record<string, unknown>,
 *   places: object[],
 *   variantSeed?: number,
 *   diversityHint?: string,
 * }} payload
 */
export async function fetchCourseDraftAssist(payload) {
  const url = AI_API_BASE
    ? `${AI_API_BASE}/api/course-draft-assist`
    : "/api/course-draft-assist";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: await getApiAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      return failureFromResponse(res, data);
    }
    if (!data?.ok || !data?.draft?.steps?.length) {
      return {
        ok: false,
        reason: data?.reason || "empty_draft",
        message:
          data?.message ||
          "AI가 유효한 코스 초안을 만들지 못했어요. 검색어를 바꿔 보세요.",
      };
    }
    return data;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[course-draft-assist]", e?.message || e);
    }
    return {
      ok: false,
      reason: "network_error",
      message:
        "AI 서버에 연결하지 못했어요. npm run dev 로 API(4000)가 켜져 있는지 확인해 주세요.",
    };
  }
}

/**
 * @param {Parameters<typeof fetchCourseDraftAssist>[0]} payload
 * @param {number} [ms]
 */
export function raceCourseDraftAssist(payload, ms = COURSE_DRAFT_ASSIST_MS) {
  return Promise.race([
    fetchCourseDraftAssist(payload),
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            ok: false,
            reason: "timeout",
            message:
              "AI 초안 작성이 시간 초과됐어요. 잠시 후 다시 시도해 주세요.",
          }),
        ms
      )
    ),
  ]);
}
