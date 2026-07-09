import { createTtlCache } from "./simpleTtlCache.js";

/**
 * 카카오 Local API(키워드·주소) 업스트림 보호:
 * - 동일 파라미터 짧은 TTL 캐시
 * - 전역 직렬 큐 + 최소 간격 (초당 한도·429 완화)
 */

const CACHE_TTL_MS = Number(process.env.KAKAO_LOCAL_CACHE_TTL_MS) || 90_000;
const CACHE_MAX = Number(process.env.KAKAO_LOCAL_CACHE_MAX) || 400;
/** 카카오 업스트림 호출 사이 최소 간격 (ms) */
const MIN_GAP_MS = Number(process.env.KAKAO_LOCAL_MIN_GAP_MS) || 120;
/** 429 직후 쿨다운 (ms) */
const COOLDOWN_AFTER_429_MS =
  Number(process.env.KAKAO_LOCAL_COOLDOWN_MS) || 8_000;

const cache = createTtlCache(CACHE_MAX, CACHE_TTL_MS);

let queue = Promise.resolve();
let lastUpstreamAt = 0;
let cooldownUntil = 0;

function roundCoord(n, digits = 4) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  const p = 10 ** digits;
  return String(Math.round(x * p) / p);
}

/** @param {'keyword'|'address'} kind @param {Record<string, unknown>} params */
export function kakaoLocalCacheKey(kind, params) {
  const q = String(params.query || "")
    .trim()
    .toLowerCase()
    .slice(0, 80);
  const size = Number(params.size) > 0 ? Math.min(Number(params.size), 30) : 15;
  const x = roundCoord(params.x);
  const y = roundCoord(params.y);
  const r =
    params.radius != null && Number.isFinite(Number(params.radius))
      ? Math.min(Math.round(Number(params.radius)), 20000)
      : "";
  return `${kind}|${q}|${size}|${x}|${y}|${r}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 캐시 히트면 즉시 반환. 미스면 큐에 넣어 업스트림 호출.
 * @param {string} cacheKey
 * @param {() => Promise<{ status: number, data: any }>} fetchUpstream
 *   status 200 + data = 성공 본문. 그 외는 카카오/네트워크 상태.
 */
export function runKakaoLocalThrottled(cacheKey, fetchUpstream) {
  const hit = cache.get(cacheKey);
  if (hit != null) {
    return Promise.resolve({
      ok: true,
      cached: true,
      status: 200,
      data: hit,
    });
  }

  const run = async () => {
    const now = Date.now();
    if (now < cooldownUntil) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((cooldownUntil - now) / 1000)
      );
      return {
        ok: false,
        cached: false,
        status: 429,
        retryAfterSec,
        data: {
          error: "카카오 Local API 쿨다운 중 — 잠시 후 다시 시도하세요.",
          retry_after: retryAfterSec,
        },
      };
    }

    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastUpstreamAt));
    if (wait > 0) await sleep(wait);

    lastUpstreamAt = Date.now();
    let result;
    try {
      result = await fetchUpstream();
    } catch (e) {
      const status = e?.response?.status;
      if (status === 429) {
        cooldownUntil = Date.now() + COOLDOWN_AFTER_429_MS;
        const retryAfterSec = Math.ceil(COOLDOWN_AFTER_429_MS / 1000);
        return {
          ok: false,
          cached: false,
          status: 429,
          retryAfterSec,
          data: {
            error: "카카오 429: 호출 한도 초과",
            retry_after: retryAfterSec,
            kakao: e?.response?.data,
          },
        };
      }
      throw e;
    }

    const status = Number(result?.status) || 0;
    if (status === 429) {
      cooldownUntil = Date.now() + COOLDOWN_AFTER_429_MS;
      const retryAfterSec = Math.ceil(COOLDOWN_AFTER_429_MS / 1000);
      return {
        ok: false,
        cached: false,
        status: 429,
        retryAfterSec,
        data: result.data ?? {
          error: "카카오 429: 호출 한도 초과",
          retry_after: retryAfterSec,
        },
      };
    }

    if (status >= 200 && status < 300 && result.data != null) {
      cache.set(cacheKey, result.data);
      return {
        ok: true,
        cached: false,
        status,
        data: result.data,
      };
    }

    return {
      ok: false,
      cached: false,
      status: status || 502,
      data: result.data ?? { error: "카카오 Local API 비정상 응답" },
    };
  };

  const job = queue.then(run, run);
  queue = job.then(
    () => undefined,
    () => undefined
  );
  return job;
}

export function getKakaoLocalThrottleStats() {
  return {
    cacheTtlMs: CACHE_TTL_MS,
    minGapMs: MIN_GAP_MS,
    cooldownUntil,
    coolingDown: Date.now() < cooldownUntil,
  };
}
