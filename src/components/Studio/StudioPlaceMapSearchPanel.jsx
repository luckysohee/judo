import {
  studioCoursesLabel,
  studioMapSearchBlock,
  studioMapSearchClearBtn,
  studioMapSearchField,
  studioMapSearchInput,
  studioMapSearchMapShell,
  studioMapSearchRow,
  studioMapSearchSubmitBtn,
} from "../../pages/Studio/studioCoursesSharedStyles";

/**
 * 스튜디오 잔 올리기 · 잔 코스 공통 — 검색바 + 지도 레이아웃
 */
export default function StudioPlaceMapSearchPanel({
  label = "장소 검색",
  query,
  onQueryChange,
  onSearch,
  onClear,
  onKeyDown,
  onFocus,
  onBlur,
  placeholder = "가게 이름 또는 주소",
  searchLoading = false,
  searchDisabled = false,
  isMobile = false,
  suggestionsDropdown = null,
  mapSlot,
  footerSlot = null,
}) {
  const trimmed = String(query || "").trim();
  const disabled = searchDisabled || searchLoading;

  return (
    <div style={studioMapSearchBlock}>
      <div style={studioCoursesLabel}>{label}</div>
      <div style={studioMapSearchRow}>
        <div style={studioMapSearchField}>
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            enterKeyHint="search"
            style={studioMapSearchInput}
            disabled={searchDisabled}
          />
          {trimmed && onClear ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={onClear}
              style={studioMapSearchClearBtn}
              disabled={searchDisabled}
            >
              ✕
            </button>
          ) : null}
        </div>
        <button
          type="button"
          style={{
            ...studioMapSearchSubmitBtn,
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
            boxShadow: disabled ? "none" : studioMapSearchSubmitBtn.boxShadow,
          }}
          onClick={onSearch}
          disabled={disabled}
        >
          {searchLoading ? "…" : "검색"}
        </button>
      </div>

      {suggestionsDropdown}

      <div style={studioMapSearchMapShell(isMobile)}>{mapSlot}</div>

      {footerSlot}
    </div>
  );
}
