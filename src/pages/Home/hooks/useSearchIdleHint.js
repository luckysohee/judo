import { useCallback, useEffect, useRef, useState } from "react";

import {
  HOME_SEARCH_IDLE_HINTS_KEY,
  SEARCH_IDLE_HINT_MESSAGES,
} from "../homeModule.js";

const SHOW_DELAY_MS = 2600;
const AUTO_HIDE_MS = 6500;
const MAX_SHOW_PER_SESSION = 2;

/**
 * 검색바가 idle 상태일 때 잠시 노출되는 보조 힌트.
 *
 * - 입력/선택/검색 진행 중이면 띄우지 않음
 * - 인트로(`homeDustIntroDismissed`) 종료 후만 활성화
 * - prefers-reduced-motion 사용자는 표시 생략
 * - 세션당 최대 2회까지만 노출 (sessionStorage)
 *
 * @param {{
 *   query: string,
 *   selectedPlace: any,
 *   isAiSearching: boolean,
 *   homeDustIntroDismissed: boolean,
 * }} args
 */
export function useSearchIdleHint({
  query,
  selectedPlace,
  isAiSearching,
  homeDustIntroDismissed,
}) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const autoHideRef = useRef(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (autoHideRef.current != null) {
      window.clearTimeout(autoHideRef.current);
      autoHideRef.current = null;
    }
  }, []);

  /** 비입력 ~2.6초 후 보조 힌트(세션 최대 2회) — 검색바가 주, 이건 보조 */
  useEffect(() => {
    /** deps 변화 시 즉시 hide — 의도된 setState */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    dismiss();
    if (selectedPlace || String(query || "").trim() || isAiSearching) {
      return undefined;
    }
    if (!homeDustIntroDismissed) {
      return undefined;
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      return undefined;
    }
    let shownCount = 0;
    try {
      shownCount = parseInt(
        sessionStorage.getItem(HOME_SEARCH_IDLE_HINTS_KEY) || "0",
        10,
      );
    } catch {
      shownCount = 0;
    }
    if (shownCount >= MAX_SHOW_PER_SESSION) {
      return undefined;
    }

    const showTimer = window.setTimeout(() => {
      const idx = Math.min(
        shownCount,
        Math.max(0, SEARCH_IDLE_HINT_MESSAGES.length - 1),
      );
      setText(SEARCH_IDLE_HINT_MESSAGES[idx] ?? "");
      try {
        sessionStorage.setItem(
          HOME_SEARCH_IDLE_HINTS_KEY,
          String(shownCount + 1),
        );
      } catch {
        /* ignore */
      }
      setVisible(true);
      autoHideRef.current = window.setTimeout(() => {
        setVisible(false);
        autoHideRef.current = null;
      }, AUTO_HIDE_MS);
    }, SHOW_DELAY_MS);

    return () => {
      window.clearTimeout(showTimer);
      if (autoHideRef.current != null) {
        window.clearTimeout(autoHideRef.current);
        autoHideRef.current = null;
      }
    };
  }, [query, selectedPlace, isAiSearching, homeDustIntroDismissed, dismiss]);

  return { visible, text, dismiss };
}
