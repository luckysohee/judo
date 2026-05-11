import { memo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLLECTION_INTERACTION_EVENT,
  COLLECTION_INTERACTION_SOURCE_SECTION,
  logCollectionInteraction,
} from "../../api/collectionInteractionLogs";
import {
  HOME_SECTION_NAME,
  logHomeSectionImpression,
} from "../../api/homeSectionImpressions";
import {
  fetchHotCollectionsNow,
  isFeaturedActive,
} from "../../api/collections";
import CollectionCoverMedia from "../Collections/CollectionCoverMedia";
import CollectionVibeCaption from "../Collections/CollectionVibeCaption";
import { useAuth } from "../../context/AuthContext";
import { useIntersectionOnce } from "../../hooks/useIntersectionOnce";

const STEP_LABEL_VISIBLE = 3;
const CACHE_TTL_MS = 45_000;
let cachedAt = 0;
let cachedRows = null;
let cachedPromise = null;

/**
 * 홈「지금 뜨는 코스」 — 최근 24h 체크인 + 현재 불꽃 장소 합산 점수로 정렬된
 * 공개 컬렉션 가로 레일.
 *
 * - 검색·지도 fetch 와 별도 lightweight fetch (`fetchHotCollectionsNow`).
 * - 점수 0 이어도 최근 생성된 공개 컬렉션을 fallback 으로 채워 비어 보이지 않게 한다.
 */
function HomeHotCollectionsSection({ experimentBucket = null } = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const loggedIn = Boolean(user?.id);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ref: sectionRef, seen: inViewOnce } = useIntersectionOnce({
    rootMargin: "0px",
    threshold: 0.15,
  });
  const impressionLoggedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    if (cachedRows && now - cachedAt < CACHE_TTL_MS) {
      setItems(cachedRows);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        if (!cachedPromise || now - cachedAt >= CACHE_TTL_MS) {
          cachedPromise = fetchHotCollectionsNow({ limit: 6 });
        }
        const rows = await cachedPromise;
        cachedRows = Array.isArray(rows) ? rows : [];
        cachedAt = Date.now();
        if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.warn("HomeHotCollectionsSection:", e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (impressionLoggedRef.current) return;
    if (!inViewOnce) return;
    if (loading) return;
    if (items.length === 0) return;
    impressionLoggedRef.current = true;
    logHomeSectionImpression({
      sectionName: HOME_SECTION_NAME.HOME_HOT_COLLECTIONS,
      itemCount: items.length,
      loggedIn,
      followedOnly: false,
      userId: user?.id ?? null,
      experimentBucket,
    });
  }, [experimentBucket, inViewOnce, items.length, loading, loggedIn, user?.id]);

  if (!loading && items.length === 0) return null;

  return (
    <section ref={sectionRef} style={styles.section} aria-label="지금 뜨는 코스">
      <div style={styles.headRow}>
        <div style={styles.headText}>
          <div style={styles.titleRow}>
            <span aria-hidden="true">🔥</span>
            <span>지금 뜨는 코스</span>
          </div>
          <div style={styles.sub}>
            최근 24시간 체크인 + 실시간 불꽃 장소 합산
          </div>
        </div>
      </div>

      <div style={styles.scroller}>
        {loading ? (
          <div style={styles.loadingChip}>지금 뜨는 코스 모으는 중…</div>
        ) : (
          items.map((c, idx) => {
            const fire = Number(c.fire_place_count) > 0;
            const recent = Number(c.recent_checkin_count) || 0;
            const isLive = fire || recent > 0;
            const liveLabel = fire
              ? `🔥 LIVE${
                  c.fire_place_count > 1 ? ` ×${c.fire_place_count}` : ""
                }`
              : recent > 0
                ? `오늘 +${recent}잔`
                : "🆕 새 코스";
            const stepsAll = Array.isArray(c.step_labels) ? c.step_labels : [];
            const stepsVisible = stepsAll.slice(0, STEP_LABEL_VISIBLE);
            const stepsRemainder = Math.max(
              0,
              stepsAll.length - stepsVisible.length,
            );
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  navigate(`/collection/${c.id}`);
                  logCollectionInteraction({
                    eventType: COLLECTION_INTERACTION_EVENT.COLLECTION_OPEN,
                    sourceSection:
                      COLLECTION_INTERACTION_SOURCE_SECTION.HOME_HOT_COLLECTIONS,
                    collectionId: c.id,
                    clickedRank: idx + 1,
                    experimentBucket,
                  });
                }}
                style={styles.card}
                aria-label={`${c.title || "컬렉션"} 코스 보기`}
              >
                <CollectionCoverMedia
                  url={c.cover_image_url}
                  collectionId={c.id}
                  letter={String(c.title || "").trim().charAt(0) || "·"}
                  tags={c.tags}
                  stepLabels={stepsAll}
                  gradientBackground={
                    isLive
                      ? "linear-gradient(160deg, rgba(225,29,72,0.55), rgba(234,88,12,0.45))"
                      : undefined
                  }
                  wrapperStyle={styles.cardCover}
                  letterTextStyle={styles.cardCoverLetter}
                />
                <div style={styles.cardBody}>
                  <div style={styles.cardTopRow}>
                    {isFeaturedActive(c) ? (
                      <span
                        style={styles.editorPickBadge}
                        title="운영자가 추천하는 코스"
                      >
                        ★ EDITOR PICK
                      </span>
                    ) : null}
                    <span
                      style={
                        isLive ? styles.liveBadgeLive : styles.liveBadgeQuiet
                      }
                      aria-hidden="true"
                    >
                      {liveLabel}
                    </span>
                    {Number(c.place_count) > 0 ? (
                      <span style={styles.metaChip}>
                        장소 {Number(c.place_count) || 0}
                      </span>
                    ) : null}
                  </div>
                  <div style={styles.cardTitle}>
                    {c.title || "(제목 없음)"}
                  </div>
                  <CollectionVibeCaption value={c.vibe_caption} variant="rail" />
                  {stepsVisible.length > 0 ? (
                    <div style={styles.stepRow}>
                      {stepsVisible.map((label, idx) => (
                        <span
                          key={`${idx}-${label}`}
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
                  ) : (
                    <div style={styles.stepRowMuted}>
                      코스 흐름 라벨이 아직 없어요
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

export default memo(HomeHotCollectionsSection);

const styles = {
  section: {
    width: "100%",
    marginBottom: 8,
    padding: "10px 12px 12px",
    borderRadius: 16,
    background: "rgba(22,22,22,0.92)",
    border: "1px solid rgba(225,29,72,0.18)",
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
  },
  cardCover: {
    width: 64,
    flexShrink: 0,
    alignSelf: "stretch",
    minHeight: 92,
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
  liveBadgeLive: {
    fontSize: 10,
    fontWeight: 900,
    color: "#fee2e2",
    background: "linear-gradient(135deg, #be123c 0%, #ea580c 100%)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 999,
    padding: "2px 8px",
    letterSpacing: "0.02em",
    boxShadow: "0 2px 6px rgba(225,29,72,0.4)",
  },
  liveBadgeQuiet: {
    fontSize: 10,
    fontWeight: 800,
    color: "rgba(255,255,255,0.62)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 999,
    padding: "2px 8px",
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
  stepRowMuted: {
    fontSize: 10,
    fontWeight: 600,
    color: "rgba(255,255,255,0.32)",
    fontStyle: "italic",
  },
};
