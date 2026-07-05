import { useEffect, useRef } from "react";
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
  hideLoadingPlaceholder = false,
  dismissing = false,
  onDismissAnimationEnd,
  selectedItemKey = null,
}) {
  const shellRef = useRef(null);
  const shouldRender = open || dismissing;

  useEffect(() => {
    if (!dismissing) return undefined;
    const node = shellRef.current;
    if (!node) return undefined;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onDismissAnimationEnd?.();
    };

    const handleAnimationEnd = (event) => {
      if (event.target !== node) return;
      finish();
    };

    node.addEventListener("animationend", handleAnimationEnd);
    const fallbackTimer = window.setTimeout(finish, 210);

    return () => {
      node.removeEventListener("animationend", handleAnimationEnd);
      window.clearTimeout(fallbackTimer);
    };
  }, [dismissing, onDismissAnimationEnd]);

  if (!shouldRender) return null;

  const q = items.length;
  if (loading && q === 0 && !hideLoadingPlaceholder) {
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

  const shellClassName = dismissing
    ? "studio-map-suggest-shell studio-map-suggest-shell--absorb"
    : open
      ? "studio-map-suggest-shell studio-map-suggest-shell--reveal"
      : "studio-map-suggest-shell";

  return (
    <div ref={shellRef} className={shellClassName} style={{ marginBottom: "10px" }}>
      <div style={{ ...studioMapSearchSuggestList, marginBottom: 0 }}>
        {items.map((item, index) => {
          const key = getItemKey ? getItemKey(item, index) : index;
          const active = index === selectedIndex;
          const picked =
            selectedItemKey != null &&
            String(getItemKey ? getItemKey(item, index) : key) ===
              String(selectedItemKey);
          const trailing = renderTrailing ? renderTrailing(item, index) : null;
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (dismissing) return;
                onSelect?.(item, index);
              }}
              onMouseEnter={() => onHoverIndex?.(index)}
              className={picked ? "studio-map-suggest-item--picked" : undefined}
              style={studioMapSearchSuggestItem(active || picked)}
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
    </div>
  );
}
