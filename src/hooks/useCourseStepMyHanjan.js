import { useEffect, useState } from "react";
import { fetchMyHanjanStepPlaceIds } from "../api/courseStepMyHanjan";

/**
 * 코스 도장 UI — 스텝별 내 한잔함 여부.
 * @param {object[]} steps
 * @param {{ enabled?: boolean, refreshKey?: number|string }} [opts]
 */
export default function useCourseStepMyHanjan(steps, opts = {}) {
  const enabled = opts.enabled !== false;
  const refreshKey = opts.refreshKey ?? 0;
  const [hanjanPlaceIds, setHanjanPlaceIds] = useState(() => new Set());

  useEffect(() => {
    if (!enabled || !Array.isArray(steps) || steps.length === 0) {
      setHanjanPlaceIds(new Set());
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const ids = await fetchMyHanjanStepPlaceIds(steps);
      if (!cancelled) setHanjanPlaceIds(ids);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, steps, refreshKey]);

  return hanjanPlaceIds;
}
