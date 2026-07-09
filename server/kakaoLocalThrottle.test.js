import { describe, it, expect, vi } from "vitest";
import {
  kakaoLocalCacheKey,
  runKakaoLocalThrottled,
} from "./kakaoLocalThrottle.js";

describe("kakaoLocalCacheKey", () => {
  it("normalizes query and rounds coords", () => {
    const a = kakaoLocalCacheKey("keyword", {
      query: " 포장마차 ",
      size: 10,
      x: 127.05512,
      y: 37.54419,
      radius: 2200,
    });
    const b = kakaoLocalCacheKey("keyword", {
      query: "포장마차",
      size: 10,
      x: 127.05514,
      y: 37.54421,
      radius: 2200,
    });
    expect(a).toBe(b);
  });
});

describe("runKakaoLocalThrottled", () => {
  it("caches successful upstream responses", async () => {
    const fetchUpstream = vi.fn(async () => ({
      status: 200,
      data: { documents: [{ id: "1" }] },
    }));
    const key = `test-cache-${Date.now()}-${Math.random()}`;
    const r1 = await runKakaoLocalThrottled(key, fetchUpstream);
    expect(r1.ok).toBe(true);
    expect(r1.cached).toBe(false);
    expect(fetchUpstream).toHaveBeenCalledTimes(1);

    const r2 = await runKakaoLocalThrottled(key, fetchUpstream);
    expect(r2.ok).toBe(true);
    expect(r2.cached).toBe(true);
    expect(fetchUpstream).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent calls", async () => {
    const order = [];
    const started = [];
    const makeFetch = (label) => async () => {
      started.push(label);
      await new Promise((r) => setTimeout(r, 30));
      order.push(label);
      return { status: 200, data: { documents: [] } };
    };
    const p1 = runKakaoLocalThrottled(
      `gap-a-${Date.now()}-${Math.random()}`,
      makeFetch("a")
    );
    const p2 = runKakaoLocalThrottled(
      `gap-b-${Date.now()}-${Math.random()}`,
      makeFetch("b")
    );
    await Promise.all([p1, p2]);
    expect(order).toEqual(["a", "b"]);
    // second must not start before first finishes (serial queue)
    expect(started[0]).toBe("a");
  });
});
