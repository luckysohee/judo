import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { homeSearchOverlayStyles as s } from "./homeSearchOverlayStyles";

/**
 * 코스 칩 패널 검색 — 홈 `HomeSearchOverlay`와 동일한 전체 화면 UX.
 *
 * @param {{
 *   open: boolean,
 *   query: string,
 *   onQueryChange: (q: string) => void,
 *   onClose: () => void,
 *   placeholder?: string,
 *   inputRef?: import('react').RefObject<HTMLInputElement | null>,
 *   tabLabel?: string,
 *   showLeadingSearchIcon?: boolean,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function HomeCourseSearchOverlay({
  open,
  query,
  onQueryChange,
  onClose,
  placeholder = "제목·지역·태그·큐레이터 검색",
  inputRef: inputRefProp,
  tabLabel = "",
  showLeadingSearchIcon = false,
  children = null,
}) {
  const localInputRef = useRef(null);
  const inputRef = inputRefProp || localInputRef;

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => {
      try {
        inputRef.current?.focus?.();
      } catch {
        /* ignore */
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [open, inputRef]);

  if (!open || typeof document === "undefined") return null;

  const trimmedQuery = String(query || "").trim();
  const showEmpty = !trimmedQuery && !children;

  return createPortal(
    <>
      <div style={s.mapDim} aria-hidden />
      <div
        style={s.root}
        role="dialog"
        aria-modal="true"
        aria-label="코스 검색"
      >
        <header style={s.header}>
          <button
            type="button"
            style={s.backBtn}
            onClick={onClose}
            aria-label="검색 닫기"
          >
            ←
          </button>
          <div style={s.inputWrap}>
            <style>{`
              .judoCourseSearchOverlayInput::placeholder {
                color: rgba(255, 255, 255, 0.38);
                opacity: 1;
              }
            `}</style>
            {showLeadingSearchIcon ? (
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  fontSize: 16,
                  lineHeight: 1,
                  opacity: 0.55,
                }}
              >
                🔍
              </span>
            ) : null}
            <input
              ref={inputRef}
              className="judoCourseSearchOverlayInput"
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={placeholder}
              style={s.input}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {trimmedQuery ? (
              <button
                type="button"
                style={s.deleteBtn}
                aria-label="검색어 지우기"
                onClick={() => {
                  onQueryChange("");
                  inputRef.current?.focus?.();
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        </header>

        {tabLabel ? (
          <p style={s.chipHint}>
            {tabLabel}
            {!trimmedQuery ? " · 검색어를 입력하면 결과가 나와요." : null}
          </p>
        ) : null}

        <div style={s.list} role="listbox">
          {showEmpty ? (
            <div style={s.empty}>
              제목, 지역, 태그, 큐레이터 이름으로
              <br />
              코스를 찾아보세요.
            </div>
          ) : (
            children
          )}
        </div>

        <div style={s.footerHint}>
          뒤로 가기 · 아래로 스와이프 시 코스 목록으로 돌아가요
        </div>
      </div>
    </>,
    document.body
  );
}
