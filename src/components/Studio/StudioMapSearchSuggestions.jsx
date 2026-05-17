import {
  studioMapSearchSuggestItem,
  studioMapSearchSuggestList,
  studioMapSearchSuggestMeta,
  studioMapSearchSuggestName,
  studioMapSearchSuggestStatus,
} from "../../pages/Studio/studioCoursesSharedStyles";

/**
 * 검색바 바로 아래 펼쳐지는 자동완성 목록
 */
export default function StudioMapSearchSuggestions({
  open = false,
  loading = false,
  items = [],
  selectedIndex = -1,
  onSelect,
  onHoverIndex,
  getItemKey,
  renderTrailing,
  emptyMessage = null,
  loadingMessage = "검색 중…",
}) {
  if (!open) return null;

  const q = items.length;
  if (loading && q === 0) {
    return (
      <div style={studioMapSearchSuggestList}>
        <div style={studioMapSearchSuggestStatus}>{loadingMessage}</div>
      </div>
    );
  }

  if (!loading && q === 0 && emptyMessage) {
    return (
      <div style={studioMapSearchSuggestList}>
        <div style={studioMapSearchSuggestStatus}>{emptyMessage}</div>
      </div>
    );
  }

  if (q === 0) return null;

  return (
    <div style={studioMapSearchSuggestList}>
      {items.map((item, index) => {
        const key = getItemKey ? getItemKey(item, index) : index;
        const active = index === selectedIndex;
        const trailing = renderTrailing ? renderTrailing(item, index) : null;
        return (
          <div
            key={key}
            role="button"
            tabIndex={0}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect?.(item, index)}
            onMouseEnter={() => onHoverIndex?.(index)}
            style={studioMapSearchSuggestItem(active)}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={studioMapSearchSuggestName}>
                  {item.name || item.place_name || "이름 없음"}
                </div>
                {(item.address || item.address_name) ? (
                  <div style={studioMapSearchSuggestMeta}>
                    {item.address || item.address_name}
                  </div>
                ) : null}
                {item.inCourse ? (
                  <div
                    style={{
                      ...studioMapSearchSuggestMeta,
                      color: "#7ee787",
                      marginTop: "4px",
                    }}
                  >
                    이미 추가됨
                  </div>
                ) : null}
              </div>
              {trailing}
            </div>
          </div>
        );
      })}
    </div>
  );
}
