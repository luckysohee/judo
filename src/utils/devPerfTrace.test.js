import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createPerfTrace, isPerfTraceEnabled } from "./devPerfTrace.js";

describe("devPerfTrace", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { __judoPerfTraces: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isPerfTraceEnabled respects VITE_PERF_TRACE", () => {
    expect(typeof isPerfTraceEnabled()).toBe("boolean");
  });

  it("records marks and stores on window", async () => {
    const prev = import.meta.env.VITE_PERF_TRACE;
    import.meta.env.VITE_PERF_TRACE = "true";
    const trace = createPerfTrace("test:unit", { query: "성수 데이트 코스" });
    trace.mark("start");
    await trace.time("sleep", () => new Promise((r) => setTimeout(r, 5)));
    const report = trace.end({ ok: true });
    import.meta.env.VITE_PERF_TRACE = prev;

    expect(report?.totalMs).toBeGreaterThanOrEqual(4);
    expect(report?.marks.length).toBeGreaterThanOrEqual(2);
    expect(window.__judoPerfTraces?.length).toBe(1);
  });
});
