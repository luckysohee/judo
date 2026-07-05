import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** @typedef {'expanded' | 'collapsed' | 'minimized'} VerticalSnapSheetSnap */

const SNAP_CYCLE = /** @type {const} */ (["expanded", "collapsed", "minimized"]);

/**
 * @param {VerticalSnapSheetSnap} snap
 * @param {{ expandedPx: number, collapsedPx: number, minimizedPx: number }} heights
 */
export function verticalSnapSheetHeightFor(snap, heights) {
  switch (snap) {
    case "minimized":
      return heights.minimizedPx;
    case "collapsed":
      return heights.collapsedPx;
    default:
      return heights.expandedPx;
  }
}

/**
 * @param {number} h
 * @param {{ expandedPx: number, collapsedPx: number, minimizedPx: number }} heights
 * @returns {VerticalSnapSheetSnap}
 */
export function nearestVerticalSnapSheetSnap(h, heights) {
  const candidates = [
    { id: /** @type {const} */ ("expanded"), px: heights.expandedPx },
    { id: /** @type {const} */ ("collapsed"), px: heights.collapsedPx },
    { id: /** @type {const} */ ("minimized"), px: heights.minimizedPx },
  ];
  let best = candidates[0];
  let minDist = Math.abs(h - best.px);
  for (let i = 1; i < candidates.length; i += 1) {
    const c = candidates[i];
    const d = Math.abs(h - c.px);
    if (d < minDist) {
      minDist = d;
      best = c;
    }
  }
  return best.id;
}

/**
 * 하단 시트 — 3단 스냅(펼침 · 중간 · 최소).
 * @param {{
 *   enabled?: boolean,
 *   expandedPx: number,
 *   collapsedPx: number,
 *   minimizedPx: number,
 *   initialSnap?: VerticalSnapSheetSnap,
 *   resetKey?: unknown,
 *   maxPx?: number,
 *   onDragRelease?: (heightPx: number) => boolean,
 * }} opts
 */
export function useVerticalSnapSheet({
  enabled = true,
  expandedPx,
  collapsedPx,
  minimizedPx,
  initialSnap = "expanded",
  resetKey,
  maxPx: maxPxOpt,
  onDragRelease,
}) {
  const heights = useMemo(
    () => ({ expandedPx, collapsedPx, minimizedPx }),
    [expandedPx, collapsedPx, minimizedPx]
  );

  const [snap, setSnap] = useState(initialSnap);
  const [heightPx, setHeightPx] = useState(() =>
    verticalSnapSheetHeightFor(initialSnap, heights)
  );
  const [isDragging, setIsDragging] = useState(false);
  const heightRef = useRef(heightPx);

  const loPx = Math.min(expandedPx, collapsedPx, minimizedPx);
  const hiPx = Math.max(
    maxPxOpt ?? 0,
    expandedPx,
    collapsedPx,
    minimizedPx
  );

  const clampHeight = useCallback(
    (h) => Math.max(loPx, Math.min(hiPx, h)),
    [loPx, hiPx]
  );

  const setSheetHeight = useCallback(
    (h) => {
      const next = clampHeight(h);
      heightRef.current = next;
      setHeightPx(next);
    },
    [clampHeight]
  );

  const applySnap = useCallback(
    (nextSnap) => {
      setSnap(nextSnap);
      const h = verticalSnapSheetHeightFor(nextSnap, heights);
      heightRef.current = h;
      setHeightPx(h);
    },
    [heights]
  );

  useEffect(() => {
    if (!enabled) return;
    applySnap(initialSnap);
  }, [enabled, heights, resetKey, initialSnap, applySnap]);

  /** 펼침·접힘 높이 상수 변경 시(미리보기 등) 현재 스냅 높이 동기화 */
  useEffect(() => {
    if (!enabled) return;
    const h = verticalSnapSheetHeightFor(snap, heights);
    heightRef.current = h;
    setHeightPx(h);
  }, [
    enabled,
    snap,
    heights.expandedPx,
    heights.collapsedPx,
    heights.minimizedPx,
  ]);

  const onDragHandlePointerDown = useCallback(
    (e) => {
      if (!enabled) return;
      if (e.button !== 0) return;
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest("button, a, input, textarea, select, [data-sheet-no-drag]")
      ) {
        return;
      }

      e.preventDefault();
      const el = e.currentTarget;
      if (typeof el.setPointerCapture === "function") {
        el.setPointerCapture(e.pointerId);
      }

      const startY = e.clientY;
      const startH = heightRef.current;
      setIsDragging(true);

      const onMove = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        const dy = ev.clientY - startY;
        const next = clampHeight(startH - dy);
        heightRef.current = next;
        setHeightPx(next);
      };

      const onUp = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        const handled = onDragRelease?.(heightRef.current) === true;
        if (!handled) {
          const nextSnap = nearestVerticalSnapSheetSnap(
            heightRef.current,
            heights
          );
          applySnap(nextSnap);
        }
        setIsDragging(false);
        if (typeof el.releasePointerCapture === "function") {
          try {
            el.releasePointerCapture(e.pointerId);
          } catch {
            /* already released */
          }
        }
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
      };

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    },
    [enabled, heights, clampHeight, applySnap, onDragRelease]
  );

  const toggleSnap = useCallback(() => {
    const idx = SNAP_CYCLE.indexOf(snap);
    const next = SNAP_CYCLE[(idx + 1) % SNAP_CYCLE.length];
    applySnap(next);
  }, [snap, applySnap]);

  const setSnapExpanded = useCallback(
    () => applySnap("expanded"),
    [applySnap]
  );
  const setSnapCollapsed = useCallback(
    () => applySnap("collapsed"),
    [applySnap]
  );
  const setSnapMinimized = useCallback(
    () => applySnap("minimized"),
    [applySnap]
  );

  return {
    snap,
    heightPx,
    isDragging,
    sheetHeightStyle: `${heightPx}px`,
    onDragHandlePointerDown,
    toggleSnap,
    setSnapExpanded,
    setSnapCollapsed,
    setSnapMinimized,
    setSheetHeight,
  };
}
