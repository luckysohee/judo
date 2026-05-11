/**
 * 컬렉션 한 줄 무드(`vibe_caption`) 카드용 표시 컴포넌트.
 *
 *  - 입력이 비어있거나 문자열이 아니면 `null` (레이아웃 빈 공간 없음).
 *  - 카드 컨텍스트에서 title 아래 한 줄에 배치, 2줄 clamp.
 *  - 색·이탤릭·letter-spacing 으로 description 과 시각적으로 분리해 "무드"임을 드러낸다.
 *  - `highlighted` 옵션이 켜지면 검색어 매칭을 강조 — 따옴표 + 라이트 배경 + 좌측 강조선.
 *
 * 추천/검색/`useCourseSearch` score 와 무관 — 순수 표시용.
 *
 * @param {{
 *   value: string | null | undefined,
 *   variant?: 'card' | 'compact' | 'rail',
 *   highlighted?: boolean,
 *   style?: object,
 * }} props
 */
export default function CollectionVibeCaption({
  value,
  variant = "card",
  highlighted = false,
  style,
}) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const base = styles.base;
  const variantStyle =
    variant === "rail"
      ? styles.rail
      : variant === "compact"
        ? styles.compact
        : styles.card;

  if (highlighted) {
    return (
      <div
        style={{
          ...base,
          ...variantStyle,
          ...styles.highlighted,
          ...(style || null),
        }}
        aria-label={`검색 무드와 매칭: ${trimmed}`}
        title={trimmed}
      >
        <span aria-hidden="true" style={styles.highlightedIcon}>
          ✨
        </span>
        <span style={styles.highlightedText}>“{trimmed}”</span>
      </div>
    );
  }

  return (
    <div style={{ ...base, ...variantStyle, ...(style || null) }}>
      {trimmed}
    </div>
  );
}

const styles = {
  base: {
    color: "#9ad3a4",
    fontWeight: 700,
    fontStyle: "italic",
    letterSpacing: "-0.01em",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  card: {
    fontSize: 12,
    lineHeight: 1.4,
  },
  compact: {
    fontSize: 11,
    lineHeight: 1.35,
  },
  rail: {
    fontSize: 11,
    lineHeight: 1.3,
  },
  highlighted: {
    display: "flex",
    alignItems: "flex-start",
    gap: 6,
    color: "#cfeeda",
    fontStyle: "normal",
    background: "rgba(46,204,113,0.12)",
    border: "1px solid rgba(46,204,113,0.45)",
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: "6px 10px",
    WebkitLineClamp: "unset",
    overflow: "visible",
  },
  highlightedIcon: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 1.3,
  },
  highlightedText: {
    flex: 1,
    minWidth: 0,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
};
