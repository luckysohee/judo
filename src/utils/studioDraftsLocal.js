/**
 * 스튜디오「잔 채우기」임시저장 — localStorage를 로그인 계정(auth uid)별로 분리.
 * (기존 전역 키 `studio_drafts`는 큐레이터 간 공유되어 버그 유발)
 */

export function studioDraftsStorageKey(userId) {
  const id = userId != null ? String(userId).trim() : "";
  return id ? `studio_drafts:${id}` : "studio_drafts:guest";
}

export function readStudioDrafts(userId) {
  try {
    return JSON.parse(
      localStorage.getItem(studioDraftsStorageKey(userId)) || "[]"
    );
  } catch {
    return [];
  }
}

export function writeStudioDrafts(userId, drafts) {
  try {
    localStorage.setItem(
      studioDraftsStorageKey(userId),
      JSON.stringify(Array.isArray(drafts) ? drafts : [])
    );
  } catch (e) {
    console.warn("writeStudioDrafts", e);
  }
}
