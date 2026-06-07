/**
 * 개발·MVP 체감 속도 분석용 구간 타이머.
 * - DEV 또는 VITE_PERF_TRACE=true 일 때만 콘솔 출력
 * - window.__judoPerfTraces 에 최근 30건 보관 (복사·비교용)
 */

const MAX_TRACES = 30;

export function isPerfTraceEnabled() {
  if (import.meta.env.VITE_PERF_TRACE === "true") return true;
  if (import.meta.env.VITE_PERF_TRACE === "false") return false;
  return Boolean(import.meta.env.DEV);
}

const noopTrace = {
  mark() {},
  async time(_name, fn) {
    return fn();
  },
  end() {
    return null;
  },
};

/**
 * @param {string} traceId 예: "search:course", "place:card"
 * @param {Record<string, unknown>} [meta]
 */
export function createPerfTrace(traceId, meta = {}) {
  if (!isPerfTraceEnabled()) return noopTrace;

  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  let last = t0;
  /** @type {{ name: string, at: number, delta: number, extra?: Record<string, unknown> }[]} */
  const marks = [];

  const mark = (name, extra) => {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    marks.push({
      name,
      at: now - t0,
      delta: now - last,
      extra: extra && typeof extra === "object" ? extra : undefined,
    });
    last = now;
  };

  const time = async (name, fn) => {
    const s =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      return await fn();
    } finally {
      const ms = Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - s
      );
      mark(name, { ms });
    }
  };

  const end = (extra) => {
    mark("TOTAL", extra);
    const totalMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0
    );
    const report = {
      traceId,
      meta,
      marks: marks.map((m) => ({
        step: m.name,
        deltaMs: Math.round(m.delta),
        cumMs: Math.round(m.at),
        ...(m.extra || {}),
      })),
      totalMs,
      at: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      const bag = window.__judoPerfTraces || [];
      bag.push(report);
      while (bag.length > MAX_TRACES) bag.shift();
      window.__judoPerfTraces = bag;
    }

    const label =
      meta?.query || meta?.placeId || meta?.name
        ? ` (${meta.query || meta.placeId || meta.name})`
        : "";
    console.info(
      `[perf] ${traceId} · ${totalMs}ms${label} — 상세는 아래 ▶ 그룹 또는 window.__judoPerfTraces`
    );
    console.groupCollapsed(`[perf] ${traceId} detail · ${totalMs}ms`);
    console.table(report.marks);
    console.groupEnd();
    return report;
  };

  return { mark, time, end };
}

/** 콘솔에서 `copy(JSON.stringify(__judoPerfTraces, null, 2))` 용 */
export function getRecentPerfTraces() {
  if (typeof window === "undefined") return [];
  return window.__judoPerfTraces || [];
}

/** 브라우저 콘솔에서 `__judoPerfHelp()` 입력 */
export function installPerfTraceConsoleHelp() {
  if (typeof window === "undefined" || !isPerfTraceEnabled()) return;
  if (window.__judoPerfHelp) return;
  window.__judoPerfTraces = window.__judoPerfTraces || [];
  window.__judoPerfHelp = () => {
    console.info(
      "[perf] 사용법:\n" +
        "1) 검색창에 「성수 데이트 코스」 등 코스 검색 후 Enter\n" +
        "2) 지도 마커 탭 → 장소 카드 열기\n" +
        "3) 콘솔 필터에 perf 입력\n" +
        "4) copy(JSON.stringify(__judoPerfTraces, null, 2))"
    );
    return getRecentPerfTraces();
  };
}
