import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_HISTORY_STATE_KEY = "judoHomeSearchMode";

/**
 * 홈 검색 모드 — 포커스 시 전체 화면 오버레이, 뒤로가기·popstate로 복귀.
 *
 * @param {{
 *   shouldForceClose?: boolean,
 *   onOpen?: () => void,
 *   onClose?: () => void,
 *   historyStateKey?: string,
 * }} [opts]
 */
export function useHomeSearchMode({
  shouldForceClose = false,
  onOpen,
  onClose,
  historyStateKey = DEFAULT_HISTORY_STATE_KEY,
} = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const pushedHistoryRef = useRef(false);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;

  const open = useCallback(() => {
    if (isOpenRef.current) return;
    setIsOpen(true);
    onOpen?.();
    if (typeof window !== "undefined" && !pushedHistoryRef.current) {
      window.history.pushState({ [historyStateKey]: 1 }, "");
      pushedHistoryRef.current = true;
    }
  }, [historyStateKey, onOpen]);

  const close = useCallback(() => {
    if (!isOpenRef.current) return;
    setIsOpen(false);
    onClose?.();
    if (
      typeof window !== "undefined" &&
      pushedHistoryRef.current &&
      window.history.state?.[historyStateKey]
    ) {
      pushedHistoryRef.current = false;
      window.history.back();
      return;
    }
    pushedHistoryRef.current = false;
  }, [historyStateKey, onClose]);

  useEffect(() => {
    if (!shouldForceClose) return;
    if (isOpenRef.current) close();
  }, [shouldForceClose, close]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    const onPopState = () => {
      if (isOpenRef.current) {
        pushedHistoryRef.current = false;
        setIsOpen(false);
        onClose?.();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  return {
    isOpen,
    open,
    close,
  };
}
