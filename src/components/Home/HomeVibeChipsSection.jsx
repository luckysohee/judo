import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchActiveHomeVibeChips } from "../../api/collectionVibeChips";

/**
 * 홈 vibe chip 섹션 — "🌧 비 오는 날", "🌙 새벽 감성" 같은 큐레이티드 분위기 진입로.
 *
 *  - 각 칩은 `/collections-search?q=keyword` 로 이동.
 *  - 실제 매칭(공개 컬렉션 vibe_caption ILIKE) 이 있는 칩만 노출. 0건이면 칩 자체가 빠짐.
 *  - 활성 칩이 하나도 없으면 섹션 자체가 렌더링되지 않음(빈 잔향 0).
 *  - 추천/검색/`useCourseSearch` 와 별도 lightweight fetch.
 */
export default function HomeVibeChipsSection() {
  const navigate = useNavigate();
  const [chips, setChips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchActiveHomeVibeChips();
        if (!cancelled) setChips(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (import.meta?.env?.DEV) {
          console.warn("HomeVibeChipsSection:", e?.message || e);
        }
        if (!cancelled) setChips([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;
  if (chips.length === 0) return null;

  return (
    <section style={styles.section} aria-label="분위기로 코스 찾기">
      <div style={styles.head}>
        <span style={styles.headEmoji} aria-hidden="true">
          🎚
        </span>
        <div style={styles.headText}>
          <div style={styles.title}>분위기로 코스 찾기</div>
          <div style={styles.sub}>
            한 줄 무드 검색 — 누군가 그렇게 적어둔 코스만 보여줍니다.
          </div>
        </div>
      </div>
      <div style={styles.chipRow}>
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              navigate(
                `/collections/search?q=${encodeURIComponent(c.keyword)}`,
              );
            }}
            style={styles.chip}
            title={`${c.label} 무드 검색 (${c.match_count})`}
          >
            <span aria-hidden="true" style={styles.chipEmoji}>
              {c.emoji}
            </span>
            <span style={styles.chipLabel}>{c.label}</span>
            <span style={styles.chipCount}>{c.match_count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const styles = {
  section: {
    width: "100%",
    marginBottom: 8,
    padding: "10px 12px 12px",
    borderRadius: 16,
    background: "rgba(22,22,22,0.92)",
    border: "1px solid rgba(46,204,113,0.22)",
    boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },
  head: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  headEmoji: {
    fontSize: 16,
    lineHeight: 1.2,
    flexShrink: 0,
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.02em",
  },
  sub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.4,
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(46,204,113,0.4)",
    background: "rgba(46,204,113,0.12)",
    color: "#d4f4dd",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: "-0.01em",
    minHeight: 36,
    WebkitTapHighlightColor: "transparent",
  },
  chipEmoji: {
    fontSize: 14,
    lineHeight: 1,
    flexShrink: 0,
  },
  chipLabel: {
    whiteSpace: "nowrap",
  },
  chipCount: {
    marginLeft: 2,
    fontSize: 10,
    fontWeight: 700,
    color: "#9ad3a4",
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.32)",
    borderRadius: 999,
    padding: "1px 6px",
  },
};
