import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLLECTION_INTERACTION_EVENT,
  COLLECTION_INTERACTION_SOURCE_SECTION,
  logCollectionInteraction,
} from "../../api/collectionInteractionLogs";
import { fetchPublicCollectionsByUser } from "../../api/collections";
import { fetchCollectionSocialState } from "../../api/collectionSocial";
import CollectionCoverMedia from "./CollectionCoverMedia";
import CollectionVibeCaption from "./CollectionVibeCaption";

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
  const [socialById, setSocialById] = useState({});

  const itemIdsKey = useMemo(
    () =>
      items
        .map((c) => String(c?.id ?? "").trim())
        .filter(Boolean)
        .sort()
        .join("|"),
    [items],
  );

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!itemIdsKey) {
        if (!cancelled) setSocialById({});
        return;
      }
      const ids = itemIdsKey.split("|").filter(Boolean);
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const s = await fetchCollectionSocialState(id);
            return [
              id,
              {
                like_count: s.like_count,
                save_count: s.save_count,
              },
            ];
          } catch {
            return [id, { like_count: 0, save_count: 0 }];
          }
        }),
      );
      if (!cancelled) {
        setSocialById(Object.fromEntries(results));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemIdsKey]);

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
        {items.map((c, idx) => (
          <CollectionCard
            key={c.id}
            collection={c}
            socialSummary={
              socialById[c.id] ?? { like_count: 0, save_count: 0 }
            }
            onClick={() => {
              navigate(`/collection/${c.id}`);
              logCollectionInteraction({
                eventType: COLLECTION_INTERACTION_EVENT.COLLECTION_OPEN,
                sourceSection:
                  COLLECTION_INTERACTION_SOURCE_SECTION.PUBLIC_COLLECTIONS_GRID,
                collectionId: c.id,
                clickedRank: idx + 1,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CollectionCard({ collection, socialSummary, onClick }) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  const placeCount = Number.isFinite(collection?.place_count)
    ? collection.place_count
    : 0;
  const description =
    typeof collection?.description === "string"
      ? collection.description.trim()
      : "";

  const likes = Number.isFinite(socialSummary?.like_count)
    ? socialSummary.like_count
    : 0;
  const saves = Number.isFinite(socialSummary?.save_count)
    ? socialSummary.save_count
    : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        ...styles.card,
        ...(hover ? styles.cardHover : null),
        ...(pressed ? styles.cardPressed : null),
      }}
    >
      <CollectionCoverMedia
        url={collection?.cover_image_url}
        collectionId={collection?.id}
        letter={(collection?.title || "").trim().charAt(0) || "·"}
        tags={collection?.tags}
        wrapperStyle={styles.cover}
        letterTextStyle={styles.coverInitial}
      />
      <div style={styles.cardBody}>
        <div style={styles.cardTitle}>{collection?.title || "(제목 없음)"}</div>
        <CollectionVibeCaption
          value={collection?.vibe_caption}
          variant="card"
        />
        {description ? (
          <div style={styles.cardDesc}>{description}</div>
        ) : null}
        <div style={styles.cardMetaRow}>
          <span style={styles.cardCountChip}>장소 {placeCount}</span>
          <span style={styles.cardPublicChip}>공개</span>
        </div>
        <div style={styles.cardSocialSummary} aria-hidden="true">
          <span style={styles.cardSocialItem}>❤️ {likes}</span>
          <span style={styles.cardSocialItem}>📁 {saves}</span>
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
    transition:
      "border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
  },
  cardHover: {
    borderColor: "rgba(255,255,255,0.14)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
    transform: "translateY(-1px)",
  },
  cardPressed: {
    transform: "translateY(0) scale(0.985)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.28)",
  },
  cover: {
    width: "100%",
    aspectRatio: "16 / 10",
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
  cardSocialSummary: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 11,
    fontWeight: 700,
    color: "#bdbdbd",
  },
  cardSocialItem: {
    letterSpacing: "-0.02em",
  },
};
