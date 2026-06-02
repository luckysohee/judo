import { useEffect, useMemo, useState } from "react";
import {
  pickStepUploadedThumb,
  resolveCourseStepThumbMap,
  stepThumbKey,
} from "../utils/courseStepThumb";

/**
 * 코스 스텝 썸네일 — 업로드 사진 우선, 없으면 카카오 장소 사진.
 * @param {object[]} steps
 * @param {{ limit?: number, enabled?: boolean }} [opts]
 */
export function useCourseStepThumbs(steps, opts = {}) {
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(6, Math.floor(opts.limit))
      : 3;
  const enabled = opts.enabled !== false;
  const skipGoogleFallback = opts.skipGoogleFallback !== false;
  const slice = useMemo(
    () => (Array.isArray(steps) ? steps.slice(0, limit) : []),
    [steps, limit]
  );
  const signature = useMemo(
    () =>
      slice
        .map((s, i) =>
          [
            stepThumbKey(s, i),
            pickStepUploadedThumb(s) || "",
            s?.kakao_place_id || "",
            s?.name || "",
          ].join("|")
        )
        .join(";"),
    [slice]
  );

  const [thumbByKey, setThumbByKey] = useState(() => {
    const initial = /** @type {Record<string, string>} */ ({});
    slice.forEach((s, i) => {
      const uploaded = pickStepUploadedThumb(s);
      if (uploaded) initial[stepThumbKey(s, i)] = uploaded;
    });
    return initial;
  });

  useEffect(() => {
    const initial = /** @type {Record<string, string>} */ ({});
    slice.forEach((s, i) => {
      const uploaded = pickStepUploadedThumb(s);
      if (uploaded) initial[stepThumbKey(s, i)] = uploaded;
    });
    setThumbByKey(initial);

    if (!enabled || slice.length === 0) return undefined;

    let cancelled = false;
    let idleId = null;
    let timeoutId = null;

    const run = async () => {
      const resolved = await resolveCourseStepThumbMap(slice, {
        limit,
        skipGoogleFallback,
      });
      if (cancelled) return;
      setThumbByKey((prev) => ({ ...prev, ...resolved }));
    };

    const start = () => {
      if (cancelled) return;
      void run();
    };

    if (typeof globalThis.requestIdleCallback === "function") {
      idleId = globalThis.requestIdleCallback(start, { timeout: 1200 });
    } else {
      timeoutId = globalThis.setTimeout(start, 280);
    }

    return () => {
      cancelled = true;
      if (idleId != null && typeof globalThis.cancelIdleCallback === "function") {
        globalThis.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) globalThis.clearTimeout(timeoutId);
    };
  }, [signature, enabled, limit, skipGoogleFallback]);

  return thumbByKey;
}
