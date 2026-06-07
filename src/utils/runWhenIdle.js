/**
 * 메인 스레드 여유 시점에 실행 — 초기 랜딩·지도 이후 부가 fetch에 사용.
 */
export function runWhenIdle(fn, { timeout = 4000 } = {}) {
  if (typeof window === "undefined") {
    fn();
    return () => {};
  }
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(() => fn(), { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 120);
  return () => window.clearTimeout(id);
}
