import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLLECTION_INTERACTION_EVENT,
  COLLECTION_INTERACTION_SOURCE_SECTION,
  logCollectionInteraction,
} from "../../api/collectionInteractionLogs";
import {
  fetchHomeCollectionsByTag,
  isFeaturedActive,
} from "../../api/collections";
import { normalizeCollectionTag } from "../../utils/collectionTags";
import CollectionCoverMedia from "../Collections/CollectionCoverMedia";
import CollectionVibeCaption from "../Collections/CollectionVibeCaption";

/**
 * 태그 기반 홈 컬렉션 레일 — groundwork.
 *
 * 외부에서 `<HomeCollectionTagRail tag="데이트" />` 처럼 꽂아 쓰면 해당 상황 태그를
 * 가진 공개 컬렉션을 가로 스크롤로 노출한다. 비어 있으면 섹션 자체를 숨긴다.
 *
 * - 검색·지도·추천 score 로직과 무관 (자체적으로 `fetchHomeCollectionsByTag` 만 호출).
 * - 클릭 시 `home_tag_rail` source 로 interaction 로그를 남긴다.
 *
 * @param {{
 *   tag: string,
 *   limit?: number,
 *   headline?: string,
 *   sub?: string,
 *   embedded?: boolean,
 *   onItemCount?: (n: number) => void,
 *   experimentBucket?: string | null,
 * }} props
 *   `embedded`: 부모 섹션(`HomeSituationCollectionsSection`)이 헤더·테두리를 담당할 때
 *   제목/설명 행을 생략하고 가로 스크롤 레일만 렌더링한다.
 */
export default function HomeCollectionTagRail({
  tag,
  limit = 8,
  headline,
  sub,
  embedded = false,
  onItemCount,
  experimentBucket = null,
}) {
  const navigate = useNavigate();
  const cleanTag = normalizeCollectionTag(tag) || "";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!cleanTag) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    (async () => {
      try {
        const rows = await fetchHomeCollectionsByTag(cleanTag, { limit });
        if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.warn("HomeCollectionTagRail:", e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cleanTag, limit]);

  useEffect(() => {
    if (typeof onItemCount !== "function") return;
    if (loading) return;
    onItemCount(items.length);
  }, [items.length, loading, onItemCount]);

  if (!cleanTag) return null;

  const rail = (
    <div style={styles.scroller}>
      {loading ? (
        <div style={styles.loadingChip}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={styles.emptyCard}>
          <div style={styles.emptyTitle}>지금 막 새로운 코스들이 올라오고 있어요</div>
          <div style={styles.emptySub}>
            #{cleanTag} 대신 다른 분위기 태그도 둘러보며 시작해보세요.
          </div>
        </div>
      ) : (
        items.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              navigate(`/collection/${c.id}`);
              logCollectionInteraction({
                eventType: COLLECTION_INTERACTION_EVENT.COLLECTION_OPEN,
                sourceSection:
                  COLLECTION_INTERACTION_SOURCE_SECTION.HOME_TAG_RAIL,
                collectionId: c.id,
                clickedRank: idx + 1,
                experimentBucket,
              });
            }}
            style={styles.card}
          >
            <CollectionCoverMedia
              url={c.cover_image_url}
              collectionId={c.id}
              letter={String(c.title || "").trim().charAt(0) || "·"}
              tags={c.tags}
              wrapperStyle={styles.cardCover}
              letterTextStyle={styles.cardCoverLetter}
            />
            <div style={styles.cardBody}>
              {isFeaturedActive(c) ? (
                <span
                  style={styles.editorPickBadge}
                  title="운영자가 추천하는 코스"
                >
                  ★ EDITOR PICK
                </span>
              ) : null}
              <div style={styles.cardTitle}>
                {c.title || "(제목 없음)"}
              </div>
              <CollectionVibeCaption value={c.vibe_caption} variant="rail" />
              <div style={styles.cardMeta}>
                <span style={styles.metaChip}>
                  장소 {Number(c.place_count) || 0}
                </span>
                <span style={styles.socialMuted}>
                  📁 {Number(c.save_count) || 0}
                </span>
                <span style={styles.socialMuted}>
                  ❤️ {Number(c.like_count) || 0}
                </span>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );

  if (embedded) {
    return (
      <div
        style={styles.embeddedWrap}
        aria-label={`${cleanTag} 태그 컬렉션 레일`}
      >
        {rail}
      </div>
    );
  }

  const headlineText = headline || `#${cleanTag}`;
  const subText = sub || `“${cleanTag}” 분위기에 어울리는 코스 모음`;

  return (
    <section style={styles.section} aria-label={`${cleanTag} 태그 컬렉션 레일`}>
      <div style={styles.headRow}>
        <div style={styles.headText}>
          <div style={styles.title}>{headlineText}</div>
          <div style={styles.sub}>{subText}</div>
        </div>
      </div>

      {rail}
    </section>
  );
}

const styles = {
  embeddedWrap: {
    width: "100%",
    marginTop: 0,
  },
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
  headText: { minWidth: 0 },
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
  emptyCard: {
    flexShrink: 0,
    width: "min(280px, 86vw)",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(255,255,255,0.9)",
  },
  emptySub: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.62)",
    lineHeight: 1.4,
  },
  card: {
    flex: "0 0 auto",
    width: "min(240px, 76vw)",
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
  },
  cardCover: {
    width: 52,
    flexShrink: 0,
    alignSelf: "stretch",
    minHeight: 72,
  },
  cardCoverLetter: {
    fontSize: 18,
    fontWeight: 900,
    color: "rgba(255,255,255,0.88)",
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
    color: "#dcc6ff",
    background: "rgba(155,89,182,0.16)",
    border: "1px solid rgba(155,89,182,0.4)",
    borderRadius: 999,
    padding: "2px 8px",
  },
  socialMuted: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.48)",
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
};
