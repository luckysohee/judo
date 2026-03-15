export default function SearchBar({
  query,
  setQuery,
  onExampleClick,
  suggestions = [],
  placeholder = "검색어를 입력해 주세요",
}) {
  const visibleSuggestions = Array.isArray(suggestions)
    ? suggestions.slice(0, 3)
    : [];

  return (
    <section style={styles.section}>
      <div style={styles.searchWrap}>
        <span style={styles.icon}>🔎</span>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          style={styles.input}
        />

        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            style={styles.clearButton}
            aria-label="검색어 지우기"
          >
            ✕
          </button>
        ) : null}
      </div>

      {!query.trim() ? (
        <div style={styles.exampleRow}>
          <button
            type="button"
            onClick={() => onExampleClick?.("을지로 2차 노포")}
            style={styles.exampleChip}
          >
            을지로 2차 노포
          </button>

          <button
            type="button"
            onClick={() => onExampleClick?.("도보로 가까운 2차")}
            style={styles.exampleChip}
          >
            도보로 가까운 2차
          </button>
        </div>
      ) : null}

      {query.trim() && visibleSuggestions.length > 0 ? (
        <div style={styles.suggestionBox}>
          {visibleSuggestions.map((item) => (
            <button
              key={`${item.type}-${item.label}`}
              type="button"
              onClick={() => setQuery(item.actualName || item.label)}
              style={styles.suggestionItem}
            >
              <span style={styles.suggestionType}>{item.type}</span>
              <span style={styles.suggestionLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

const styles = {
  section: {
    width: "100%",
  },

  searchWrap: {
    height: "50px",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(18,18,18,0.94)",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 12px",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
  },

  icon: {
    fontSize: "14px",
    opacity: 0.9,
    flexShrink: 0,
  },

  input: {
    flex: 1,
    height: "100%",
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "#ffffff",
    fontSize: "14px",
  },

  clearButton: {
    width: "28px",
    height: "28px",
    border: "none",
    borderRadius: "999px",
    backgroundColor: "#2a2a2a",
    color: "#ffffff",
    fontSize: "12px",
    flexShrink: 0,
  },

  exampleRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "8px",
  },

  exampleChip: {
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(18,18,18,0.92)",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "7px 10px",
    fontSize: "11px",
    fontWeight: 600,
    backdropFilter: "blur(8px)",
  },

  suggestionBox: {
    marginTop: "8px",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(17,17,17,0.96)",
    borderRadius: "16px",
    overflow: "hidden",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 26px rgba(0,0,0,0.28)",
  },

  suggestionItem: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    backgroundColor: "transparent",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px",
    textAlign: "left",
  },

  suggestionType: {
    fontSize: "11px",
    color: "#9f9f9f",
    flexShrink: 0,
  },

  suggestionLabel: {
    fontSize: "13px",
    color: "#ffffff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};