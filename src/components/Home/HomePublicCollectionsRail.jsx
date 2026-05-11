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
  fetchHomePublicCollections,
  fetchHomePublicCollectionsByFollowed,
  isFeaturedActive,
} from "../../api/collections";
import { useAuth } from "../../context/AuthContext";
import CollectionCoverMedia from "../Collections/CollectionCoverMedia";
import CollectionVibeCaption from "../Collections/CollectionVibeCaption";
import { useIntersectionOnce } from "../../hooks/useIntersectionOnce";

const RAIL_LIMIT = 8;
/** followed 모드에서 followed 결과만으로 레일을 채울 최소 건수. 미만이면 전체 풀로 보강. */
const FOLLOWED_KEEP_THRESHOLD = 4;
const CACHE_TTL_MS = 60_000;
const cacheByKey = new Map();

function cacheKey({ useFollowed, viewerId }) {
  return useFollowed ? `followed:${viewerId}` : "all";
}

/**
 * 홈 검색바 위 레일 — 공개 컬렉션 가로 스크롤 카드.
 *
 * 지도·검색 fetch 로직과 무관하게 마운트 시 단독으로 목록만 불러온다.
 *
 * @param {{ followedOnly?: boolean }} [props]
 *   `followedOnly` 가 true 이고 viewer 가 로그인 상태이면 픽한 사용자들이 만든
 *   공개 컬렉션만 우선 노출. 결과가 적으면(`< FOLLOWED_KEEP_THRESHOLD`) 전체
 *   공개 컬렉션 풀에서 자연 보강하고 sub 텍스트로 안내한다.
 */
function HomePublicCollectionsRail({
  followedOnly = false,
  experimentBucket = null,
} = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const viewerId = user?.id || null;
  const useFollowed = Boolean(followedOnly && viewerId);
  const loggedIn = Boolean(viewerId);
  const { ref: sectionRef, seen: inViewOnce } = useIntersectionOnce({
    rootMargin: "0px",
    threshold: 0.15,
  });
  const impressionLoggedRef = useRef(false);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [augmentedFromAll, setAugmentedFromAll] = useState(false);
  const [followedExclusiveCount, setFollowedExclusiveCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const key = cacheKey({ useFollowed, viewerId });
    const now = Date.now();
    const cached = cacheByKey.get(key);
    if (cached && cached.data && now - cached.at < CACHE_TTL_MS) {
      setItems(cached.data.items);
      setAugmentedFromAll(Boolean(cached.data.augmentedFromAll));
      setFollowedExclusiveCount(Number(cached.data.followedExclusiveCount) || 0);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        if (useFollowed) {
          let followed = [];
          try {
            const followedKey = cacheKey({ useFollowed: true, viewerId });
            const entry = cacheByKey.get(followedKey);
            if (entry?.promise && now - entry.at < CACHE_TTL_MS) {
              followed = await entry.promise;
            } else {
              const p = fetchHomePublicCollectionsByFollowed(viewerId, {
                limit: RAIL_LIMIT,
              });
              cacheByKey.set(followedKey, { at: Date.now(), promise: p, data: null });
              followed = await p;
            }
          } catch (e) {
            if (import.meta?.env?.DEV) {
              console.warn(
                "HomePublicCollectionsRail followed:",
                e?.message || e,
              );
            }
            followed = [];
          }
          if (cancelled) return;
          if (followed.length >= FOLLOWED_KEEP_THRESHOLD) {
            setItems(followed);
            setAugmentedFromAll(false);
            setFollowedExclusiveCount(followed.length);
            cacheByKey.set(key, {
              at: Date.now(),
              promise: null,
              data: {
                items: followed,
                augmentedFromAll: false,
                followedExclusiveCount: followed.length,
              },
            });
          } else {
            // 부족 → 전체 공개 컬렉션 풀에서 보강 (followed-first dedup).
            let all = [];
            try {
              const allKey = "all";
              const entry = cacheByKey.get(allKey);
              if (entry?.promise && now - entry.at < CACHE_TTL_MS) {
                all = await entry.promise;
              } else {
                const p = fetchHomePublicCollections({ limit: RAIL_LIMIT });
                cacheByKey.set(allKey, { at: Date.now(), promise: p, data: null });
                all = await p;
              }
            } catch (e) {
              if (import.meta?.env?.DEV) {
                console.warn(
                  "HomePublicCollectionsRail fallback all:",
                  e?.message || e,
                );
              }
              all = [];
            }
            if (cancelled) return;
            const seen = new Set();
            const merged = [];
            for (const row of [...followed, ...all]) {
              const id = row?.id;
              if (!id || seen.has(id)) continue;
              seen.add(id);
              merged.push(row);
              if (merged.length >= RAIL_LIMIT) break;
            }
            setItems(merged);
            setAugmentedFromAll(merged.length > followed.length);
            setFollowedExclusiveCount(followed.length);
            cacheByKey.set(key, {
              at: Date.now(),
              promise: null,
              data: {
                items: merged,
                augmentedFromAll: merged.length > followed.length,
                followedExclusiveCount: followed.length,
              },
            });
          }
        } else {
          const allKey = "all";
          const entry = cacheByKey.get(allKey);
          let rows;
          if (entry?.data && now - entry.at < CACHE_TTL_MS) {
            rows = entry.data.items;
          } else if (entry?.promise && now - entry.at < CACHE_TTL_MS) {
            rows = await entry.promise;
          } else {
            const p = fetchHomePublicCollections({ limit: RAIL_LIMIT });
            cacheByKey.set(allKey, { at: Date.now(), promise: p, data: null });
            rows = await p;
          }
          if (cancelled) return;
          const safe = Array.isArray(rows) ? rows : [];
          setItems(safe);
          setAugmentedFromAll(false);
          setFollowedExclusiveCount(0);
          cacheByKey.set(key, {
            at: Date.now(),
            promise: null,
            data: { items: safe, augmentedFromAll: false, followedExclusiveCount: 0 },
          });
        }
      } catch (e) {
        if (import.meta?.env?.DEV) {
          console.warn("HomePublicCollectionsRail:", e?.message || e);
        }
        if (!cancelled) {
          setItems([]);
          setAugmentedFromAll(false);
          setFollowedExclusiveCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useFollowed, viewerId]);

  useEffect(() => {
    if (impressionLoggedRef.current) return;
    if (!inViewOnce) return;
    if (loading) return;
    if (items.length === 0) return;
    impressionLoggedRef.current = true;
    logHomeSectionImpression({
      sectionName: HOME_SECTION_NAME.HOME_PUBLIC_COLLECTIONS_RAIL,
      itemCount: items.length,
      loggedIn,
      followedOnly: useFollowed,
      userId: viewerId,
      experimentBucket,
    });
  }, [
    experimentBucket,
    inViewOnce,
    items.length,
    loading,
    loggedIn,
    useFollowed,
    viewerId,
  ]);

  if (!loading && items.length === 0) return null;

  const railTitle = useFollowed
    ? augmentedFromAll
      ? "픽한 사람의 코스 + α"
      : "픽한 사람의 코스"
    : "컬렉션 코스";
  const railSub = useFollowed
    ? augmentedFromAll
      ? `픽한 사람 코스 ${followedExclusiveCount}건 · 부족분은 전체 공개 코스로 보강`
      : "내가 픽한 사람들이 만든 공개 코스"
    : "저장·좋아요가 많은 코스부터 · 최근 공개 반영";

  return (
    <section ref={sectionRef} style={styles.section} aria-label="공개 컬렉션 코스">
      <div style={styles.headRow}>
        <div style={styles.headText}>
          <div style={styles.title}>{railTitle}</div>
          <div style={styles.sub}>{railSub}</div>
        </div>
      </div>

      <div style={styles.scroller}>
        {loading ? (
          <div style={styles.loadingChip}>컬렉션 불러오는 중…</div>
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
                    COLLECTION_INTERACTION_SOURCE_SECTION.HOME_PUBLIC_COLLECTIONS_RAIL,
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
                {typeof c.description === "string" && c.description.trim() ? (
                  <div style={styles.cardDesc}>{c.description.trim()}</div>
                ) : !c.vibe_caption || !String(c.vibe_caption).trim() ? (
                  <div style={styles.cardDescMuted}>설명 없음</div>
                ) : null}
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

export default memo(HomePublicCollectionsRail);

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
