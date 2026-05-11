import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  COLLECTION_INTERACTION_EVENT,
  COLLECTION_INTERACTION_SOURCE_SECTION,
  logCollectionInteraction,
} from "../api/collectionInteractionLogs";
import {
  fetchHomeCollectionsByTag,
  isFeaturedActive,
} from "../api/collections";
import CollectionCoverMedia from "../components/Collections/CollectionCoverMedia";
import CollectionVibeCaption from "../components/Collections/CollectionVibeCaption";
import {
  dedupeAndNormalizeCollectionTags,
  normalizeCollectionTag,
} from "../utils/collectionTags";

const PAGE_LIMIT = 48;

/**
 * `/collections/tag/:tag` — 특정 상황 태그를 가진 공개 컬렉션 전체 목록.
 *
 * - 데이터 소스는 `fetchHomeCollectionsByTag` 그대로 재사용 (featured 우선 정렬도 그대로 유지).
 * - 카드 클릭 로그는 `collection_tag_list` source 로 기존 `collection_open` 이벤트 사용.
 * - 검색·지도·추천 score 로직은 일절 건드리지 않는다.
 */
export default function CollectionsByTagPage() {
  const { tag: rawTag } = useParams();
  const navigate = useNavigate();

  const tag = useMemo(() => {
    const decoded = (() => {
      try {
        return decodeURIComponent(String(rawTag ?? ""));
      } catch {
        return String(rawTag ?? "");
      }
    })();
    return normalizeCollectionTag(decoded) || "";
  }, [rawTag]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tag) {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
          setErrorMsg("");
        }
        return;
      }
      setLoading(true);
      setErrorMsg("");
      try {
        const rows = await fetchHomeCollectionsByTag(tag, { limit: PAGE_LIMIT });
        if (cancelled) return;
        setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (cancelled) return;
        console.warn("CollectionsByTagPage:", e);
        setErrorMsg(e?.message || "컬렉션을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tag]);

  if (!tag) {
    return (
      <div style={styles.page}>
        <header style={styles.header}>
          <button type="button" style={styles.backBtn} onClick={() => navigate(-1)}>
            ← 뒤로
          </button>
          <h1 style={styles.title}>태그가 지정되지 않았습니다</h1>
        </header>
        <p style={styles.empty}>
          올바른 상황 태그로 다시 접근해 주세요. 예: <code>/collections/tag/데이트</code>
        </p>
        <Link to="/" style={styles.homeLink}>홈으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button type="button" style={styles.backBtn} onClick={() => navigate(-1)}>
          ← 뒤로
        </button>
        <div style={styles.titleRow}>
          <h1 style={styles.title}>
            <span style={styles.titleHash}>#</span>
            {tag}
            <span style={styles.titleSuffix}> 코스</span>
          </h1>
          {!loading && items.length > 0 ? (
            <span style={styles.countChip}>{items.length}</span>
          ) : null}
        </div>
        <p style={styles.subtitle}>
          “{tag}” 태그가 달린 공개 컬렉션을 한 번에 모았어요. EDITOR PICK 코스가 위에 먼저 보여요.
        </p>
      </header>

      {loading ? (
        <div style={styles.helper}>불러오는 중…</div>
      ) : errorMsg ? (
        <div style={{ ...styles.helper, color: "#e74c3c" }}>{errorMsg}</div>
      ) : items.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyTitle}>
            아직 “{tag}” 태그가 달린 공개 코스가 없어요.
          </div>
          <div style={styles.emptySub}>
            나만의 “{tag}” 1차 → 2차 루트를 먼저 만들어 볼까요?
          </div>
          <Link to="/my-collections" style={styles.emptyCta}>
            내 컬렉션 만들기 →
          </Link>
        </div>
      ) : (
        <div style={styles.grid}>
          {items.map((c, idx) => (
            <CollectionTagCard
              key={c.id}
              collection={c}
              currentTag={tag}
              onClick={() => {
                navigate(`/collection/${c.id}`);
                logCollectionInteraction({
                  eventType: COLLECTION_INTERACTION_EVENT.COLLECTION_OPEN,
                  sourceSection:
                    COLLECTION_INTERACTION_SOURCE_SECTION.COLLECTION_TAG_LIST,
                  collectionId: c.id,
                  clickedRank: idx + 1,
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionTagCard({ collection, currentTag, onClick }) {
  const [hover, setHover] = useState(false);

  const placeCount = Number.isFinite(Number(collection?.place_count))
    ? Number(collection.place_count)
    : 0;
  const saveCount = Number.isFinite(Number(collection?.save_count))
    ? Number(collection.save_count)
    : 0;
  const likeCount = Number.isFinite(Number(collection?.like_count))
    ? Number(collection.like_count)
    : 0;

  const tags = useMemo(
    () => dedupeAndNormalizeCollectionTags(collection?.tags),
    [collection?.tags],
  );
  const featured = isFeaturedActive(collection);
  const cleanCurrent = currentTag ? currentTag.toLowerCase() : "";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...styles.card,
        ...(hover ? styles.cardHover : null),
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
        {featured ? (
          <span style={styles.editorPickBadge} title="운영자가 추천하는 코스">
            ★ EDITOR PICK
          </span>
        ) : null}
        <div style={styles.cardTitle}>
          {collection?.title || "(제목 없음)"}
        </div>
        <CollectionVibeCaption
          value={collection?.vibe_caption}
          variant="card"
        />
        {tags.length > 0 ? (
          <div style={styles.tagRow}>
            {tags.slice(0, 4).map((t) => {
              const active = t.toLowerCase() === cleanCurrent;
              return (
                <span
                  key={t.toLowerCase()}
                  style={{
                    ...styles.tagChip,
                    ...(active ? styles.tagChipActive : null),
                  }}
                >
                  #{t}
                </span>
              );
            })}
            {tags.length > 4 ? (
              <span style={styles.tagMore}>외 {tags.length - 4}</span>
            ) : null}
          </div>
        ) : null}
        <div style={styles.cardMetaRow}>
          <span style={styles.cardCountChip}>장소 {placeCount}</span>
          <span style={styles.socialMuted}>📁 {saveCount}</span>
          <span style={styles.socialMuted}>❤️ {likeCount}</span>
        </div>
      </div>
    </button>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f0f10",
    color: "#fff",
    padding: "20px 16px 60px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  backBtn: {
    alignSelf: "flex-start",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.82)",
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  titleRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    color: "#fff",
  },
  titleHash: {
    color: "rgba(155,89,182,0.95)",
    marginRight: 2,
  },
  titleSuffix: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: 700,
    fontSize: 18,
  },
  countChip: {
    fontSize: 11,
    fontWeight: 800,
    color: "#d4f4dd",
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.42)",
    borderRadius: 999,
    padding: "2px 10px",
  },
  subtitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },
  helper: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    padding: "12px 0",
  },
  empty: {
    border: "1px dashed rgba(255,255,255,0.2)",
    borderRadius: 14,
    padding: 20,
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    color: "rgba(255,255,255,0.78)",
    background: "rgba(255,255,255,0.02)",
  },
  emptyTitle: { fontSize: 14, fontWeight: 800, color: "#fff" },
  emptySub: { fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.55)" },
  emptyCta: {
    alignSelf: "center",
    fontSize: 12,
    fontWeight: 800,
    color: "#d4f4dd",
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.4)",
    borderRadius: 999,
    padding: "8px 16px",
    textDecoration: "none",
  },
  homeLink: {
    color: "#7cb4ff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
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
    borderColor: "rgba(255,255,255,0.18)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
    transform: "translateY(-1px)",
  },
  cover: {
    width: "100%",
    aspectRatio: "16 / 10",
  },
  coverInitial: {
    fontSize: 28,
    fontWeight: 900,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: "-0.02em",
  },
  cardBody: {
    padding: "10px 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  editorPickBadge: {
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: 900,
    color: "#0c1410",
    background: "linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)",
    border: "1px solid rgba(217,119,6,0.55)",
    borderRadius: 999,
    padding: "2px 8px",
    letterSpacing: "0.04em",
    boxShadow: "0 2px 6px rgba(217,119,6,0.35)",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.3,
    color: "#fff",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
  },
  tagChip: {
    fontSize: 10,
    fontWeight: 800,
    color: "#d4f4dd",
    background: "rgba(46,204,113,0.14)",
    border: "1px solid rgba(46,204,113,0.42)",
    borderRadius: 999,
    padding: "1px 8px",
    letterSpacing: "-0.01em",
  },
  tagChipActive: {
    color: "#ead9ff",
    background: "rgba(155,89,182,0.22)",
    border: "1px solid rgba(155,89,182,0.55)",
  },
  tagMore: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.6)",
  },
  cardMetaRow: {
    marginTop: 4,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
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
  socialMuted: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.55)",
  },
};
