import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHomePublicCollections } from "../../api/collections";

/**
 * 홈 검색바 위 레일 — 공개 컬렉션 가로 스크롤 카드.
 *
 * 지도·검색 fetch 로직과 무관하게 마운트 시 단독으로 목록만 불러온다.
 */
export default function HomePublicCollectionsRail() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchHomePublicCollections({ limit: 8 });
        if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.warn("HomePublicCollectionsRail:", e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <section style={styles.section} aria-label="공개 컬렉션 코스">
      <div style={styles.headRow}>
        <div style={styles.headText}>
          <div style={styles.title}>컬렉션 코스</div>
          <div style={styles.sub}>저장·좋아요가 많은 코스부터 · 최근 공개 반영</div>
        </div>
      </div>

      <div style={styles.scroller}>
        {loading ? (
          <div style={styles.loadingChip}>컬렉션 불러오는 중…</div>
        ) : (
          items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/collection/${c.id}`)}
              style={styles.card}
            >
              <div style={styles.cardCover} aria-hidden="true">
                {(String(c.title || "").trim().charAt(0) || "·").toUpperCase()}
              </div>
              <div style={styles.cardBody}>
                <div style={styles.cardTitle}>
                  {c.title || "(제목 없음)"}
                </div>
                {typeof c.description === "string" && c.description.trim() ? (
                  <div style={styles.cardDesc}>{c.description.trim()}</div>
                ) : (
                  <div style={styles.cardDescMuted}>설명 없음</div>
                )}
                <div style={styles.cardMeta}>
                  <span style={styles.metaChip}>장소 {Number(c.place_count) || 0}</span>
                  <span style={styles.socialMuted}>❤️ {Number(c.like_count) || 0}</span>
                  <span style={styles.socialMuted}>📁 {Number(c.save_count) || 0}</span>
                </div>
              </div>
            </button>
          ))
        )}
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
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },
  headRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  headText: {
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
  },
  scroller: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 10,
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    paddingBottom: 4,
    marginInline: -2,
    scrollbarWidth: "thin",
  },
  loadingChip: {
    flexShrink: 0,
    padding: "14px 18px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: 600,
  },
  card: {
    flex: "0 0 auto",
    width: "min(260px, 78vw)",
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
    padding: 0,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(14,14,14,0.96)",
    color: "#eee",
    cursor: "pointer",
    textAlign: "left",
    overflow: "hidden",
    transition: "border-color 0.15s ease, transform 0.15s ease",
  },
  cardCover: {
    width: 52,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 900,
    color: "rgba(255,255,255,0.88)",
    background:
      "linear-gradient(160deg, rgba(46,204,113,0.35), rgba(52,152,219,0.28))",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px 10px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.25,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  cardDesc: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.62)",
    lineHeight: 1.35,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  cardDescMuted: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.28)",
    fontStyle: "italic",
  },
  cardMeta: {
    marginTop: 4,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  metaChip: {
    fontSize: 10,
    fontWeight: 800,
    color: "#c8f7dc",
    background: "rgba(46,204,113,0.14)",
    border: "1px solid rgba(46,204,113,0.35)",
    borderRadius: 999,
    padding: "2px 8px",
  },
  socialMuted: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.48)",
  },
};
