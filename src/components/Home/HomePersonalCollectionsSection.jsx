import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLLECTION_INTERACTION_EVENT,
  COLLECTION_INTERACTION_SOURCE_SECTION,
  logCollectionInteraction,
} from "../../api/collectionInteractionLogs";
import { fetchMyTasteCollectionRecommendations } from "../../api/collectionPersonalRecommendations";
import { useAuth } from "../../context/AuthContext";
import CollectionCoverMedia from "../Collections/CollectionCoverMedia";
import CollectionVibeCaption from "../Collections/CollectionVibeCaption";

const STEP_LABEL_VISIBLE = 3;

/**
 * 최근 저장 시그널 trending hint 를 한 줄 contextual copy 로 변환.
 *
 * @param {{ kind: 'tag'|'step', label: string } | null | undefined} trending
 * @param {'saves'|'likes'|'preference'|null} [signalSource]
 * @returns {string | null}
 */
function formatTrendingCopy(trending, signalSource = null) {
  if (!trending || typeof trending !== "object") return null;
  const label =
    typeof trending.label === "string" ? trending.label.trim() : "";
  if (!label) return null;
  const like = signalSource === "likes";
  if (trending.kind === "tag") {
    return like
      ? `요즘 ${label} 코스를 자주 좋아요하고 있어요`
      : `요즘 ${label} 코스를 자주 저장하고 있어요`;
  }
  if (trending.kind === "step") {
    return like
      ? `요즘 ${label} 흐름을 자주 좋아요하고 있어요`
      : `요즘 ${label} 흐름을 자주 저장하고 있어요`;
  }
  return null;
}

/**
 * 홈「당신 취향의 코스」— 로그인 유저의 저장 행동(태그·step_label·장소 겹침)
 * 기반 lightweight 추천 레일.
 *
 * - 비로그인이면 자체적으로 렌더하지 않고 `null` 을 반환 → 기존 hot/public
 *   레일이 그대로 fallback 으로 살아있음.
 * - 추천 결과가 0건이어도 마찬가지로 `null` 만 노출(빈 섹션 noise 방지).
 * - 검색·지도·`useCourseSearch` 와 무관하게 단독으로 fetch 한다.
 */
export default function HomePersonalCollectionsSection() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [trending, setTrending] = useState(null);
  const [signalSource, setSignalSource] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return undefined;
    const uid = user?.id;
    if (!uid) {
      setItems([]);
      setTrending(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await fetchMyTasteCollectionRecommendations(uid, {
          limit: 8,
        });
        if (cancelled) return;
        const nextItems = Array.isArray(result?.items) ? result.items : [];
        setItems(nextItems);
        setTrending(result?.trending ?? null);
        setSignalSource(result?.signal_source ?? null);
      } catch (e) {
        if (import.meta?.env?.DEV) {
          console.warn("HomePersonalCollectionsSection:", e?.message || e);
        }
        if (!cancelled) {
          setItems([]);
          setTrending(null);
          setSignalSource(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  if (authLoading) return null;
  if (!user?.id) return null;
  if (!loading && items.length === 0) return null;

  const trendingCopy = formatTrendingCopy(trending, signalSource);
  const subCopy =
    signalSource === "preference"
      ? "처음 고른 취향 태그와 맞는 공개 코스"
      : signalSource === "likes"
        ? "좋아요한 코스와 비슷한 태그·흐름·장소의 코스"
        : "저장한 코스의 태그·흐름·장소가 비슷한 코스";

  return (
    <section style={styles.section} aria-label="당신 취향의 코스">
      <div style={styles.headRow}>
        <div style={styles.headText}>
          <div style={styles.titleRow}>
            <span aria-hidden="true">✨</span>
            <span>당신 취향의 코스</span>
          </div>
          <div style={styles.sub}>{subCopy}</div>
          {trendingCopy ? (
            <div style={styles.trendingChip} role="status" title={trendingCopy}>
              <span aria-hidden="true" style={styles.trendingDot}>
                •
              </span>
              <span style={styles.trendingText}>{trendingCopy}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div style={styles.scroller}>
        {loading ? (
          <div style={styles.loadingChip}>취향 분석하는 중…</div>
        ) : (
          items.map((c, idx) => {
            const stepsAll = Array.isArray(c.step_labels) ? c.step_labels : [];
            const stepsVisible = stepsAll.slice(0, STEP_LABEL_VISIBLE);
            const stepsRemainder = Math.max(
              0,
              stepsAll.length - stepsVisible.length,
            );
            const reason =
              typeof c.reason === "string" && c.reason.trim()
                ? c.reason.trim()
                : "취향과 비슷한 흐름이에요";
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  navigate(`/collection/${c.id}`);
                  logCollectionInteraction({
                    eventType: COLLECTION_INTERACTION_EVENT.COLLECTION_OPEN,
                    sourceSection:
                      COLLECTION_INTERACTION_SOURCE_SECTION.HOME_PERSONAL_RECOMMENDATIONS,
                    collectionId: c.id,
                    clickedRank: idx + 1,
                  });
                }}
                style={styles.card}
                aria-label={`${c.title || "컬렉션"} — ${reason}`}
              >
                <CollectionCoverMedia
                  url={c.cover_image_url}
                  collectionId={c.id}
                  letter={String(c.title || "").trim().charAt(0) || "·"}
                  tags={c.tags}
                  stepLabels={stepsAll}
                  wrapperStyle={styles.cardCover}
                  letterTextStyle={styles.cardCoverLetter}
                />
                <div style={styles.cardBody}>
                  <div style={styles.cardTopRow}>
                    {c.is_featured_active ? (
                      <span
                        style={styles.editorPickBadge}
                        title="운영자가 추천하는 코스"
                      >
                        ★ EDITOR PICK
                      </span>
                    ) : null}
                    <span
                      style={styles.reasonBadge}
                      aria-hidden="true"
                      title={reason}
                    >
                      {reason}
                    </span>
                  </div>
                  <div style={styles.cardTitle}>
                    {c.title || "(제목 없음)"}
                  </div>
                  <CollectionVibeCaption value={c.vibe_caption} variant="rail" />
                  {stepsVisible.length > 0 ? (
                    <div style={styles.stepRow}>
                      {stepsVisible.map((label, i) => (
                        <span
                          key={`${i}-${label}`}
                          style={styles.stepChip}
                          title={label}
                        >
                          {label}
                        </span>
                      ))}
                      {stepsRemainder > 0 ? (
                        <span style={styles.stepMore}>+{stepsRemainder}</span>
                      ) : null}
                    </div>
                  ) : null}
                  <div style={styles.metaRow}>
                    {Number(c.place_count) > 0 ? (
                      <span style={styles.metaChip}>
                        장소 {Number(c.place_count) || 0}
                      </span>
                    ) : null}
                    {Number(c.save_count) > 0 ? (
                      <span style={styles.socialMuted}>
                        📁 {Number(c.save_count) || 0}
                      </span>
                    ) : null}
                    {Number(c.like_count) > 0 ? (
                      <span style={styles.socialMuted}>
                        ❤️ {Number(c.like_count) || 0}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
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
    border: "1px solid rgba(155,89,182,0.28)",
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
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
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
  trendingChip: {
    marginTop: 6,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(155,89,182,0.18)",
    border: "1px solid rgba(155,89,182,0.5)",
    color: "#ead9ff",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "-0.01em",
    maxWidth: "100%",
  },
  trendingDot: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 1,
    color: "#c7a3ff",
  },
  trendingText: {
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
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
    width: "min(280px, 82vw)",
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
    WebkitTapHighlightColor: "transparent",
  },
  cardCover: {
    width: 64,
    flexShrink: 0,
    alignSelf: "stretch",
    minHeight: 100,
  },
  cardCoverLetter: {
    fontSize: 20,
    fontWeight: 900,
    color: "rgba(255,255,255,0.92)",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    padding: "8px 12px 10px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  cardTopRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  reasonBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: "#ead9ff",
    background: "rgba(155,89,182,0.18)",
    border: "1px solid rgba(155,89,182,0.5)",
    borderRadius: 999,
    padding: "2px 8px",
    letterSpacing: "-0.01em",
    maxWidth: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  editorPickBadge: {
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
    fontSize: 13,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.25,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  stepRow: {
    marginTop: 2,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  stepChip: {
    fontSize: 10,
    fontWeight: 700,
    color: "#9ad3a4",
    background: "rgba(46,204,113,0.12)",
    border: "1px solid rgba(46,204,113,0.45)",
    borderRadius: 6,
    padding: "1px 6px",
    maxWidth: 88,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  stepMore: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.55)",
  },
  metaRow: {
    marginTop: 2,
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
