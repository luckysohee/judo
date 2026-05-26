import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { homeSearchOverlayStyles as s } from "./homeSearchOverlayStyles";
import {
  filterHomeSearchHistoryByChip,
  formatHomeSearchHistoryDate,
} from "../../utils/homeSearchHistory";

/** @typedef {import('../../utils/homeSearchHistory').HomeSearchHistoryChip} HomeSearchHistoryChip */
/** @typedef {import('../../utils/homeSearchHistory').HomeSearchHistoryEntry} HomeSearchHistoryEntry */

const CHIPS = [
  { id: "recent", label: "최근검색" },
  { id: "place", label: "장소" },
  { id: "sentence", label: "문장" },
];

function rowIcon(kind) {
  if (kind === "place_kakao") return "📍";
  if (kind === "sentence") return "💬";
  return "🕐";
}

/**
 * 네이버 지도식 검색 모드 — 포커스 시 전체 화면.
 * 와이어: 상단 입력 · 칩 · 히스토리/제안 리스트 · (키보드는 OS).
 *
 * @param {{
 *   open: boolean,
 *   query: string,
 *   onQueryChange: (q: string) => void,
 *   onClose: () => void,
 *   onSubmit: (q: string) => void,
 *   placeholder?: string,
 *   historyEntries?: HomeSearchHistoryEntry[],
 *   historyChip?: HomeSearchHistoryChip,
 *   onHistoryChipChange?: (chip: HomeSearchHistoryChip) => void,
 *   onPickHistory?: (entry: HomeSearchHistoryEntry) => void,
 *   onDeleteHistory?: (entryId: string) => void,
 *   onClearAllHistory?: () => void,
 *   isLoading?: boolean,
 *   inputRef?: import('react').RefObject<HTMLInputElement | null>,
 *   headerRight?: import('react').ReactNode,
 *   suggestPanel?: import('react').ReactNode,
 *   showSuggestPanel?: boolean,
 * }} props
 */
export default function HomeSearchOverlay({
  open,
  query,
  onQueryChange,
  onClose,
  onSubmit,
  placeholder = "동네, 분위기, 메뉴로 검색해 보세요",
  historyEntries = [],
  historyChip = "recent",
  onHistoryChipChange,
  onPickHistory,
  onDeleteHistory,
  onClearAllHistory,
  isLoading = false,
  inputRef: inputRefProp,
  headerRight = null,
  suggestPanel = null,
  showSuggestPanel = false,
}) {
  const localInputRef = useRef(null);
  const inputRef = inputRefProp || localInputRef;

  const filteredHistory = useMemo(
    () => filterHomeSearchHistoryByChip(historyEntries, historyChip),
    [historyEntries, historyChip]
  );

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

  const showHistory = !showSuggestPanel && !String(query || "").trim();

  const listContent = showSuggestPanel ? (
    suggestPanel
  ) : showHistory ? (
    filteredHistory.length === 0 ? (
      <div style={s.empty}>
        최근 검색이 없어요.
        <br />
        예: 이태원 와인바, 조용한 포차
      </div>
    ) : (
      <>
        {filteredHistory.map((entry) => (
          <div key={entry.id} style={{ display: "flex", alignItems: "stretch" }}>
            <button
              type="button"
              style={s.row}
              onClick={() => onPickHistory?.(entry)}
            >
              <span style={s.rowIcon} aria-hidden>
                {rowIcon(entry.kind)}
              </span>
              <span style={s.rowMain}>{entry.query}</span>
              <span style={s.rowDate}>
                {formatHomeSearchHistoryDate(entry.searchedAt)}
              </span>
            </button>
            <button
              type="button"
              style={s.deleteBtn}
              aria-label={`${entry.query} 검색 기록 삭제`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteHistory?.(entry.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        {typeof onClearAllHistory === "function" &&
        filteredHistory.length > 0 ? (
          <button
            type="button"
            style={{
              ...s.row,
              justifyContent: "center",
              color: "#888",
              fontSize: "13px",
            }}
            onClick={onClearAllHistory}
          >
            전체 삭제
          </button>
        ) : null}
      </>
    )
  ) : (
    <>
      {suggestPanel || (
        <div style={s.empty}>
          입력하면 장소 제안이 나와요.
          <br />
          엔터로 주도 검색을 실행합니다.
        </div>
      )}
    </>
  );

  return createPortal(
    <>
      <div style={s.mapDim} aria-hidden />
      <div
        style={s.root}
        role="dialog"
        aria-modal="true"
        aria-label="장소 검색"
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
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={placeholder}
              style={s.input}
              disabled={isLoading}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.nativeEvent?.isComposing) return;
                e.preventDefault();
                const q = String(query || "").trim();
                if (q) onSubmit(q);
              }}
            />
          </div>
          <div style={s.headerRight}>{headerRight}</div>
        </header>

        <div style={s.chipRow} role="tablist" aria-label="검색 기록 필터">
          {CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={historyChip === chip.id}
              style={s.chip(historyChip === chip.id)}
              onClick={() => onHistoryChipChange?.(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {!showSuggestPanel && !showHistory && suggestPanel ? (
          <div style={s.suggestSectionLabel}>제안</div>
        ) : null}

        <div style={s.list} role="listbox">
          {listContent}
        </div>

        <div style={s.footerHint}>
          뒤로 가기 · 아래로 스와이프 시 지도로 돌아가요
        </div>
      </div>
    </>,
    document.body
  );
}
