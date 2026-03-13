import normalizeText from "../../utils/normalizeText";

const QUICK_EXAMPLES = [
  "을지로 2차 노포",
  "성수 데이트 와인",
  "강남 해산물 안주",
  "도보로 가까운 2차",
];

export default function SearchBar({
  query,
  setQuery,
  onExampleClick,
  suggestions = [],
  placeholder = "지역 / 술집 / 큐레이터 검색",
}) {
  const handleSubmit = (event) => {
    event.preventDefault();
  };

  const handleClear = () => {
    setQuery("");
  };

  const safeSuggestions = Array.isArray(suggestions)
    ? suggestions.filter((item) => item && item.label)
    : [];

  const showSuggestions = query.trim().length > 0 && safeSuggestions.length > 0;

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputWrap}>
          <span style={styles.icon}>🔍</span>

          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            style={styles.input}
          />

          {query ? (
            <button
              type="button"
              onClick={handleClear}
              style={styles.clearButton}
              aria-label="검색어 지우기"
            >
              ×
            </button>
          ) : null}
        </div>
      </form>

      {showSuggestions ? (
        <div style={styles.suggestionBox}>
          <div style={styles.suggestionTitle}>추천 검색어</div>
          <div style={styles.suggestionList}>
            {safeSuggestions.map((item) => {
              const exactVisualMatch =
                normalizeText(item.label) === normalizeText(query);

              return (
                <button
                  key={`${item.type}-${item.label}`}
                  type="button"
                  onClick={() => setQuery(item.actualName || item.label)}
                  style={{
                    ...styles.suggestionItem,
                    borderColor: exactVisualMatch ? "#2ECC71" : "#333333",
                  }}
                >
                  <span style={styles.suggestionType}>{item.type}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={styles.exampleRow}>
        {QUICK_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onExampleClick(example)}
            style={styles.exampleChip}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    marginBottom: "16px",
  },
  form: {
    marginBottom: "10px",
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "14px",
    padding: "0 12px",
    height: "48px",
  },
  icon: {
    fontSize: "16px",
    marginRight: "8px",
    color: "#bdbdbd",
  },
  input: {
    flex: 1,
    height: "100%",
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "#ffffff",
    fontSize: "15px",
  },
  clearButton: {
    border: "none",
    backgroundColor: "transparent",
    color: "#bdbdbd",
    fontSize: "22px",
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
    marginLeft: "8px",
  },
  suggestionBox: {
    marginBottom: "10px",
    border: "1px solid #2a2a2a",
    backgroundColor: "#161616",
    borderRadius: "14px",
    padding: "10px",
  },
  suggestionTitle: {
    fontSize: "12px",
    color: "#bdbdbd",
    marginBottom: "8px",
  },
  suggestionList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  suggestionItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textAlign: "left",
    border: "1px solid #333333",
    backgroundColor: "#1d1d1d",
    color: "#ffffff",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
  },
  suggestionType: {
    fontSize: "11px",
    color: "#2ECC71",
    fontWeight: 700,
    minWidth: "48px",
  },
  exampleRow: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    paddingBottom: "2px",
  },
  exampleChip: {
    whiteSpace: "nowrap",
    border: "1px solid #333333",
    backgroundColor: "#151515",
    color: "#e9e9e9",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
  },
};