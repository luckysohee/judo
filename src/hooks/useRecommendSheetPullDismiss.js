import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** 아래로 당겨 시트 전체 닫기(추천 결과 해제) */
const PULL_DISMISS_PX = 56;
const PULL_SLOP_PX = 10;
/** 펼친 상태에서 위로 당길 때 고무줄 저항 */
const PULL_UP_RUBBER_MAX_PX = 22;

function bindSheetDragNode(el, { isAiSearching, onDrag, onEnd }) {
  if (!el) return () => {};

  const state = { startY: 0, startX: 0, active: false, dragging: false };
  let finishGuardUntil = 0;

  const finishOnce = (payload) => {
    const now = Date.now();
    if (now < finishGuardUntil) return;
    finishGuardUntil = now + 380;
    onEnd(payload);
  };

  const reset = () => {
    state.active = false;
    state.dragging = false;
  };

  const onPointerDown = (e) => {
    if (isAiSearching || e.button !== 0) return;
    state.startY = e.clientY;
    state.startX = e.clientX;
    state.active = true;
    state.dragging = false;
    if (typeof el.setPointerCapture === "function") {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const onPointerMove = (e) => {
    if (!state.active) return;
    const dy = e.clientY - state.startY;
    const dx = e.clientX - state.startX;
    if (!state.dragging) {
      if (Math.abs(dy) <= PULL_SLOP_PX && Math.abs(dx) <= PULL_SLOP_PX) return;
      if (Math.abs(dx) >= Math.abs(dy)) return;
      state.dragging = true;
    }
    if (state.dragging) {
      e.preventDefault();
      onDrag(dy);
    }
  };

  const finishPointer = (e) => {
    if (!state.active) return;
    const dy = e.clientY - state.startY;
    const dragged = state.dragging;
    reset();
    finishOnce({ dy, dragged });
    if (typeof el.releasePointerCapture === "function") {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const onTouchStart = (e) => {
    if (isAiSearching || e.touches.length !== 1) return;
    state.startY = e.touches[0].clientY;
    state.startX = e.touches[0].clientX;
    state.active = true;
    state.dragging = false;
  };

  const onTouchMove = (e) => {
    if (!state.active || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - state.startY;
    const dx = e.touches[0].clientX - state.startX;
    if (!state.dragging) {
      if (Math.abs(dy) <= PULL_SLOP_PX && Math.abs(dx) <= PULL_SLOP_PX) return;
      if (Math.abs(dx) >= Math.abs(dy)) return;
      state.dragging = true;
    }
    if (state.dragging) {
      e.preventDefault();
      onDrag(dy);
    }
  };

  const onTouchEnd = (e) => {
    if (!state.active) return;
    const t = e.changedTouches[0];
    const dy = t ? t.clientY - state.startY : 0;
    const dragged = state.dragging;
    reset();
    finishOnce({ dy, dragged });
  };

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", finishPointer);
  el.addEventListener("pointercancel", finishPointer);
  el.addEventListener("touchstart", onTouchStart, { passive: true });
  el.addEventListener("touchmove", onTouchMove, { passive: false });
  el.addEventListener("touchend", onTouchEnd, { passive: true });
  el.addEventListener("touchcancel", onTouchEnd, { passive: true });

  return () => {
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", finishPointer);
    el.removeEventListener("pointercancel", finishPointer);
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchmove", onTouchMove);
    el.removeEventListener("touchend", onTouchEnd);
    el.removeEventListener("touchcancel", onTouchEnd);
  };
}

function rubberBandDy(dy) {
  if (dy >= 0) return dy;
  return Math.max(-PULL_UP_RUBBER_MAX_PX, dy * 0.28);
}

/**
 * 맞춤 추천 시트 — 손잡이·헤더에서 위·아래 드래그.
 * 아래로 충분히 당기면 추천 시트 전체 닫기(접힘 단계 없음).
 *
 * @param {{
 *   enabled?: boolean,
 *   onDismiss?: () => void,
 *   isAiSearching?: boolean,
 *   onPullRelease?: (ctx: { dy: number, dragged: boolean }) => boolean | void,
 * }} opts
 */
export function useRecommendSheetPullDismiss({
  enabled = true,
  onDismiss,
  isAiSearching = false,
  onPullRelease,
}) {
  const [pullDy, setPullDy] = useState(0);
  const [pullDragging, setPullDragging] = useState(false);
  const sheetChromeRef = useRef(null);
  const suppressHeaderClickRef = useRef(false);

  const onDrag = useCallback((dy) => {
    setPullDragging(true);
    setPullDy(rubberBandDy(dy));
  }, []);

  const onEnd = useCallback(
    ({ dy, dragged }) => {
      setPullDragging(false);
      setPullDy(0);
      if (!dragged) return;

      let actionTaken = false;
      if (typeof onPullRelease === "function") {
        actionTaken = Boolean(onPullRelease({ dy, dragged }));
      }
      if (
        !actionTaken &&
        dy >= PULL_DISMISS_PX &&
        typeof onDismiss === "function"
      ) {
        onDismiss();
        actionTaken = true;
      }
      if (actionTaken) {
        suppressHeaderClickRef.current = true;
      }
    },
    [onDismiss, onPullRelease]
  );

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const el = sheetChromeRef.current;
    if (!(el instanceof HTMLElement)) return undefined;
    return bindSheetDragNode(el, { isAiSearching, onDrag, onEnd });
  }, [enabled, isAiSearching, onDrag, onEnd]);

  const consumeHeaderClick = useCallback(() => {
    if (suppressHeaderClickRef.current) {
      suppressHeaderClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  const visualDy = pullDy > 0 ? pullDy : 0;
  const clusterStyle = {
    width: "100%",
    pointerEvents: "auto",
    transform: pullDy !== 0 ? `translateY(${pullDy}px)` : undefined,
    opacity:
      visualDy > 0 ? Math.max(0.35, 1 - visualDy / 160) : 1,
    transition: pullDragging
      ? "none"
      : "transform 0.26s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.26s ease",
  };

  return {
    sheetChromeRef,
    clusterStyle,
    pullDragging,
    consumeHeaderClick,
  };
}
