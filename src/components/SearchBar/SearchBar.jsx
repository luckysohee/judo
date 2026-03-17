export default function SearchBar({
  query,
  setQuery,
  onSubmit,
  onClear,
  onExampleClick,
  suggestions = [],
  placeholder = "검색어를 입력해 주세요",
  isLoading = false,
  rightActions = null,
}) {
  const visibleSuggestions = Array.isArray(suggestions)
    ? suggestions.slice(0, 3)
    : [];

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;
    onSubmit?.(trimmed);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleClear = () => {
    setQuery("");
    onClear?.();
  };

  return (
    <section style={styles.section}>
      <div style={styles.searchWrap}>
        <button
          type="button"
          onClick={handleSubmit}
          style={styles.iconButton}
          aria-label="검색"
          disabled={isLoading}
        >
          <span style={styles.icon}>{isLoading ? "…" : "🔎"}</span>
        </button>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            ...styles.input,
            ...(rightActions ? styles.inputWithRightActions : {}),
          }}
          disabled={isLoading}
        />

        {query ? (
          <button
            type="button"
            onClick={handleClear}
            style={styles.clearButton}
            aria-label="검색어 지우기"
          >
            ✕
          </button>
        ) : null}

        {rightActions ? (
          <div style={styles.rightActions}>{rightActions}</div>
        ) : null}
      </div>

      {!query.trim() ? (
        <div style={styles.exampleRow}>
          {/* <button
            type="button"
            onClick={() => onExampleClick?.("을지로 조용한 노포 2차")}
            style={styles.exampleChip}
          >
            을지로 조용한 노포 2차
          </button> */}
        </div>
      ) : null}

      {query.trim() && visibleSuggestions.length > 0 ? (
        <div style={styles.suggestionBox}>
          {visibleSuggestions.map((item) => (
            <button
              key={`${item.type}-${item.label}`}
              type="button"
              onClick={() => {
                const nextValue = item.actualName || item.label;
                setQuery(nextValue);
                onSubmit?.(nextValue);
              }}
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
    backgroundColor: "rgba(18, 19, 18, 0.94)",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 12px",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
  },

  iconButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    fontSize: "14px",
    opacity: 0.9,
    flexShrink: 0,
    color: "#ffffff",
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

  inputWithRightActions: {
    paddingRight: "120px",
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
    cursor: "pointer",
  },

  rightActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
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
    cursor: "pointer",
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
    cursor: "pointer",
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