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
    (async () => {
      const resolved = await resolveCourseStepThumbMap(slice, { limit });
      if (cancelled) return;
      setThumbByKey((prev) => ({ ...prev, ...resolved }));
    })();

    return () => {
      cancelled = true;
    };
  }, [signature, enabled, limit]);

  return thumbByKey;
}
