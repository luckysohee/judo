import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLLECTION_INTERACTION_EVENT,
  COLLECTION_INTERACTION_SOURCE_SECTION,
  logCollectionInteraction,
} from "../../api/collectionInteractionLogs";
import { fetchCollectionRemixChildren } from "../../api/collections";
import { dedupeAndNormalizeCollectionTags } from "../../utils/collectionTags";
import CollectionCoverMedia from "./CollectionCoverMedia";
import CollectionVibeCaption from "./CollectionVibeCaption";

const TAG_PREVIEW_MAX = 3;

/**
 * "이 흐름을 바탕으로 한 코스" — 현재 컬렉션을 부모로 갖는 공개 자식 lightweight 카드.
 *
 *  - 0건이면 자체 렌더링 안 함.
 *  - 정렬은 fetch 내부(`save_count desc → like_count desc → created_at desc`).
 *  - 카드: cover, title, creator, tags(최대 3개) — 추천/검색 score 와는 무관.
 *
 * @param {{ collectionId: string }} props
 */
export default function CollectionRemixChildrenSection({ collectionId }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cid = String(collectionId ?? "").trim();
      if (!cid) {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const rows = await fetchCollectionRemixChildren(cid, { limit: 8 });
        if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancelled) setItems([]);
        if (import.meta?.env?.DEV) {
          console.warn("CollectionRemixChildrenSection load:", e?.message || e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section style={styles.wrap} aria-label="이 흐름을 바탕으로 한 코스">
      <div style={styles.heading}>
        <span style={styles.headingIcon} aria-hidden="true">
          🌱
        </span>
        <span>이 흐름을 바탕으로 한 코스</span>
        <span style={styles.headingCount}>{items.length}</span>
      </div>
      <div style={styles.grid}>
        {items.map((row, idx) => (
          <RemixChildCard
            key={row.id}
            row={row}
            onClick={() => {
              navigate(`/collection/${row.id}`);
              logCollectionInteraction({
                eventType: COLLECTION_INTERACTION_EVENT.COLLECTION_OPEN,
                sourceSection:
                  COLLECTION_INTERACTION_SOURCE_SECTION.COLLECTION_DETAIL_REMIX_CHILDREN,
                collectionId: row.id,
                clickedRank: idx + 1,
              });
            }}
          />
        ))}
      </div>
    </section>
  );
}

function RemixChildCard({ row, onClick }) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  const title = typeof row?.title === "string" && row.title.trim()
    ? row.title.trim()
    : "(제목 없음)";
  const creator = typeof row?.creator_label === "string" && row.creator_label.trim()
    ? row.creator_label.trim()
    : null;
  const tags = dedupeAndNormalizeCollectionTags(row?.tags).slice(
    0,
    TAG_PREVIEW_MAX,
  );

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
        url={row?.cover_image_url}
        collectionId={row?.id}
        letter={(row?.title || "").trim().charAt(0) || "·"}
        tags={row?.tags}
        wrapperStyle={styles.cover}
        letterTextStyle={styles.coverInitial}
      />
      <div style={styles.body}>
        <div style={styles.title}>{title}</div>
        <CollectionVibeCaption value={row?.vibe_caption} variant="compact" />
        {creator ? (
          <div style={styles.creator}>{creator}님의 리믹스</div>
        ) : (
          <div style={styles.creatorMuted}>다른 사용자의 리믹스</div>
        )}
        {tags.length > 0 ? (
          <div style={styles.tagRow}>
            {tags.map((t) => (
              <span key={t.toLowerCase()} style={styles.tagChip}>
                #{t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

const styles = {
  wrap: {
    width: "100%",
    margin: "20px 0 8px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  heading: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    fontSize: 15,
    fontWeight: 800,
    color: "#fff",
  },
  headingIcon: {
    fontSize: 14,
  },
  headingCount: {
    fontSize: 12,
    color: "#9ad3a4",
    fontWeight: 700,
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
    borderColor: "rgba(46,204,113,0.3)",
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
    fontSize: 26,
    fontWeight: 800,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: "-0.02em",
  },
  body: {
    padding: "10px 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.3,
    color: "#fff",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  creator: {
    fontSize: 12,
    color: "#9ad3a4",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  creatorMuted: {
    fontSize: 12,
    color: "#888",
    fontWeight: 600,
  },
  tagRow: {
    marginTop: 4,
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
  },
  tagChip: {
    fontSize: 11,
    fontWeight: 700,
    color: "#d4f4dd",
    background: "rgba(46,204,113,0.12)",
    border: "1px solid rgba(46,204,113,0.35)",
    borderRadius: 999,
    padding: "1px 8px",
    letterSpacing: "-0.01em",
  },
};
