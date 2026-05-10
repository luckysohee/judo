import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPublicCollectionsByUser } from "../../api/collections";

/**
 * 특정 사용자의 공개 컬렉션을 카드 그리드로 노출.
 *
 * 클릭 시 `/collection/:id` 로 이동한다. 비공개 컬렉션은 RLS 가 자동으로 가려 주므로
 * 별도 필터를 두지 않아도 된다.
 *
 * @param {{ userId: string, headingLabel?: string, style?: object }} props
 */
export default function PublicCollectionsGrid({
  userId,
  headingLabel = "컬렉션",
  style,
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        if (!cancelled) {
          setItems([]);
          setErrorMsg("");
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setErrorMsg("");
      try {
        const rows = await fetchPublicCollectionsByUser(userId);
        if (cancelled) return;
        setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (cancelled) return;
        console.error("PublicCollectionsGrid load:", e);
        setErrorMsg(e?.message || "컬렉션을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div style={{ ...styles.wrap, ...style }}>
        <div style={styles.heading}>{headingLabel}</div>
        <div style={styles.helper}>불러오는 중…</div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ ...styles.wrap, ...style }}>
        <div style={styles.heading}>{headingLabel}</div>
        <div style={{ ...styles.helper, color: "#e74c3c" }}>{errorMsg}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ ...styles.wrap, ...style }}>
        <div style={styles.heading}>{headingLabel}</div>
        <div style={styles.helper}>공개된 컬렉션이 아직 없습니다.</div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.wrap, ...style }}>
      <div style={styles.heading}>
        {headingLabel}
        <span style={styles.headingCount}>{items.length}</span>
      </div>
      <div style={styles.grid}>
        {items.map((c) => (
          <CollectionCard
            key={c.id}
            collection={c}
            onClick={() => navigate(`/collection/${c.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function CollectionCard({ collection, onClick }) {
  const placeCount = Number.isFinite(collection?.place_count)
    ? collection.place_count
    : 0;
  const description =
    typeof collection?.description === "string"
      ? collection.description.trim()
      : "";

  return (
    <button type="button" onClick={onClick} style={styles.card}>
      <div style={styles.cover} aria-hidden="true">
        <span style={styles.coverInitial}>
          {(collection?.title || "").trim().charAt(0) || "·"}
        </span>
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardTitle}>{collection?.title || "(제목 없음)"}</div>
        {description ? (
          <div style={styles.cardDesc}>{description}</div>
        ) : null}
        <div style={styles.cardMetaRow}>
          <span style={styles.cardCountChip}>장소 {placeCount}</span>
          <span style={styles.cardPublicChip}>공개</span>
        </div>
      </div>
    </button>
  );
}

const styles = {
  wrap: {
    width: "100%",
    margin: "24px 0 8px",
  },
  heading: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    fontSize: 16,
    fontWeight: 700,
    color: "#fff",
    marginBottom: 12,
  },
  headingCount: {
    fontSize: 12,
    color: "#bdbdbd",
    fontWeight: 600,
  },
  helper: {
    fontSize: 13,
    color: "#888",
    padding: "6px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    textAlign: "left",
    background: "#1a1a1a",
    border: "1px solid #262626",
    borderRadius: 12,
    padding: 0,
    overflow: "hidden",
    cursor: "pointer",
    color: "#fff",
    transition: "border-color 0.15s ease, transform 0.15s ease",
  },
  cover: {
    position: "relative",
    aspectRatio: "16 / 10",
    background:
      "linear-gradient(135deg, rgba(46,204,113,0.35) 0%, rgba(52,152,219,0.35) 50%, rgba(155,89,182,0.35) 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  coverInitial: {
    fontSize: 28,
    fontWeight: 800,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: "-0.02em",
  },
  cardBody: {
    padding: "10px 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.3,
    color: "#fff",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  cardDesc: {
    fontSize: 12,
    color: "#bdbdbd",
    lineHeight: 1.4,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  cardMetaRow: {
    marginTop: 2,
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  cardCountChip: {
    fontSize: 11,
    fontWeight: 700,
    color: "#fff",
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.4)",
    borderRadius: 999,
    padding: "2px 8px",
  },
  cardPublicChip: {
    fontSize: 11,
    fontWeight: 700,
    color: "#bdbdbd",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 999,
    padding: "2px 8px",
  },
};
