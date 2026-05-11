import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  COLLECTION_INTERACTION_EVENT,
  COLLECTION_INTERACTION_SOURCE_SECTION,
  logCollectionInteraction,
} from "../../api/collectionInteractionLogs";
import {
  HOME_SECTION_NAME,
  logHomeSectionImpression,
} from "../../api/homeSectionImpressions";
import { fetchRecentCuratorActivity } from "../../api/collectionActivity";
import { useIntersectionOnce } from "../../hooks/useIntersectionOnce";

const MAX_ITEMS = 8;
const MIN_FOLLOWED_KEEP = 3;
const CACHE_TTL_MS = 45_000;
const cacheByKey = new Map();

const TAB_FOLLOWED = "followed";
const TAB_ALL = "all";

function timeAgoKo(iso) {
  const t = new Date(iso || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "방금";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}주 전`;
  const mo = Math.floor(d / 30);
  return `${mo}개월 전`;
}

function actorLabel(actor) {
  const name = actor?.display_name?.trim();
  const handle = actor?.username?.trim();
  if (name) return name;
  if (handle) return `@${handle}`;
  return "누군가";
}

function eventTypeBadge(type) {
  switch (type) {
    case "collection_created":
      return {
        text: "새 컬렉션",
        color: "#9ad3a4",
        border: "rgba(46,204,113,0.5)",
        bg: "rgba(46,204,113,0.12)",
      };
    case "collection_updated":
      return {
        text: "업데이트",
        color: "#fcd34d",
        border: "rgba(252,211,77,0.45)",
        bg: "rgba(252,211,77,0.12)",
      };
    case "place_added":
      return {
        text: "장소 추가",
        color: "#93c5fd",
        border: "rgba(147,197,253,0.45)",
        bg: "rgba(147,197,253,0.12)",
      };
    case "collection_saved_trending":
      return {
        text: "🔥 인기",
        color: "#fda4af",
        border: "rgba(225,29,72,0.45)",
        bg: "rgba(225,29,72,0.14)",
      };
    default:
      return {
        text: "활동",
        color: "#bdbdbd",
        border: "rgba(255,255,255,0.16)",
        bg: "rgba(255,255,255,0.06)",
      };
  }
}

function eventSentenceParts(item) {
  const actor = actorLabel(item.actor);
  const title = String(item.collection?.title || "").trim() || "(제목 없음)";
  switch (item.type) {
    case "collection_created":
      return [`${actor}님이 새 컬렉션 「${title}」을 만들었어요`];
    case "collection_updated":
      return [`${actor}님이 「${title}」을 업데이트했어요`];
    case "place_added": {
      const placeName = String(item.place?.name || "").trim();
      const stepLabel = String(item.place?.step_label || "").trim();
      if (placeName && stepLabel) {
        return [
          `${actor}님이 「${title}」에 ${stepLabel}로 「${placeName}」을(를) 담았어요`,
        ];
      }
      if (placeName) {
        return [`${actor}님이 「${title}」에 「${placeName}」을(를) 담았어요`];
      }
      return [`${actor}님이 「${title}」에 새 장소를 담았어요`];
    }
    case "collection_saved_trending": {
      const n = Number(item.save_recent_count) || 0;
      if (n >= 1) {
        return [`「${title}」이 최근 ${n}명에게 저장되고 있어요`];
      }
      return [`「${title}」이 지금 저장되고 있어요`];
    }
    default:
      return [`${actor}님이 「${title}」 활동을 했어요`];
  }
}

function ActivityAvatar({ actor }) {
  const url = String(actor?.avatar_url || "").trim();
  const initial =
    String(actor?.display_name || actor?.username || "·")
      .trim()
      .charAt(0)
      .toUpperCase() || "·";
  if (url) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        style={styles.avatarImg}
      />
    );
  }
  return (
    <div style={styles.avatarFallback} aria-hidden="true">
      {initial}
    </div>
  );
}

function mergeUniqueByKey(primary, secondary, max) {
  const seen = new Set();
  const out = [];
  const push = (e) => {
    if (!e?.key || seen.has(e.key)) return;
    seen.add(e.key);
    out.push(e);
  };
  (Array.isArray(primary) ? primary : []).forEach(push);
  (Array.isArray(secondary) ? secondary : []).forEach(push);
  return out.slice(0, max);
}

/**
 * 홈「큐레이터 활동」 — 공개 컬렉션의 최근 변경 이벤트를 한 줄 카드 리스트로 노출.
 *
 * - 검색·지도 fetch 와 별도 lightweight fetch (`fetchRecentCuratorActivity`).
 * - 로그인 사용자: **내가 픽한 사람들** 활동 우선, 부족하면(< 3건) **전체 공개 활동** 으로 자연 보강.
 * - 비로그인: 전체 공개 활동만 노출(토글 비표시).
 * - 클릭 시 해당 공개 컬렉션 페이지로 이동.
 *
 * @param {{ forcedScope?: 'followed' | 'all' | null }} [props]
 *   부모(예: 홈 상단 「전체 / 내가 픽한 사람」 토글)가 scope 을 외부에서 주입할 때 사용한다.
 *   값이 주어지면 내부 탭 UI 는 숨기고 해당 scope 으로 강제 잠금. 비로그인이면 어떤 값이든
 *   `all` 로 다운그레이드된다.
 */
function HomeCuratorActivityFeed({
  forcedScope = null,
  experimentBucket = null,
} = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const viewerId = user?.id || null;
  const loggedIn = Boolean(viewerId);
  const { ref: sectionRef, seen: inViewOnce } = useIntersectionOnce({
    rootMargin: "0px",
    threshold: 0.15,
  });
  const impressionLoggedRef = useRef(false);

  const [tab, setTab] = useState(TAB_FOLLOWED);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [augmentedFromAll, setAugmentedFromAll] = useState(false);

  // 부모에서 scope 을 강제하면 내부 탭 UI 는 숨기고 그 값으로 잠근다.
  const isExternallyControlled =
    forcedScope === "followed" || forcedScope === "all";
  const showTabs = Boolean(viewerId) && !isExternallyControlled;
  let effectiveTab;
  if (isExternallyControlled) {
    effectiveTab =
      forcedScope === "followed" && viewerId ? TAB_FOLLOWED : TAB_ALL;
  } else {
    effectiveTab = viewerId ? tab : TAB_ALL;
  }

  const loadActivity = useCallback(
    async (signal) => {
      setLoading(true);
      setAugmentedFromAll(false);
      try {
        const key =
          effectiveTab === TAB_FOLLOWED && viewerId
            ? `followed:${viewerId}`
            : "all";
        const cached = cacheByKey.get(key);
        const now = Date.now();
        if (cached?.data && now - cached.at < CACHE_TTL_MS) {
          if (signal?.cancelled) return;
          setItems(cached.data.items);
          setAugmentedFromAll(Boolean(cached.data.augmentedFromAll));
          setLoading(false);
          return;
        }
        if (effectiveTab === TAB_FOLLOWED && viewerId) {
          const followed = await fetchRecentCuratorActivity({
            limit: MAX_ITEMS,
            sinceDays: 14,
            followedOnly: true,
            viewerUserId: viewerId,
          });
          if (signal?.cancelled) return;
          if ((followed?.length || 0) >= MIN_FOLLOWED_KEEP) {
            setItems(followed);
            setAugmentedFromAll(false);
            cacheByKey.set(key, {
              at: Date.now(),
              data: { items: followed, augmentedFromAll: false },
            });
          } else {
            // 팔로우 활동이 적을 때 전체 활동으로 자연 보강 (followed 우선 노출).
            const all = await fetchRecentCuratorActivity({
              limit: MAX_ITEMS,
              sinceDays: 14,
            });
            if (signal?.cancelled) return;
            const merged = mergeUniqueByKey(followed, all, MAX_ITEMS);
            setItems(merged);
            setAugmentedFromAll(merged.length > (followed?.length || 0));
            cacheByKey.set(key, {
              at: Date.now(),
              data: {
                items: merged,
                augmentedFromAll: merged.length > (followed?.length || 0),
              },
            });
          }
        } else {
          const all = await fetchRecentCuratorActivity({
            limit: MAX_ITEMS,
            sinceDays: 14,
          });
          if (signal?.cancelled) return;
          const safe = Array.isArray(all) ? all : [];
          setItems(safe);
          cacheByKey.set("all", { at: Date.now(), data: { items: safe, augmentedFromAll: false } });
        }
      } catch (e) {
        if (signal?.cancelled) return;
        console.warn("HomeCuratorActivityFeed:", e);
        setItems([]);
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [effectiveTab, viewerId],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    loadActivity(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadActivity]);

  // 로그아웃 시 전체 탭으로 정렬
  useEffect(() => {
    if (!viewerId && tab !== TAB_ALL) setTab(TAB_ALL);
    if (viewerId && tab !== TAB_FOLLOWED && tab !== TAB_ALL) {
      setTab(TAB_FOLLOWED);
    }
  }, [viewerId, tab]);

  const list = useMemo(() => items.slice(0, MAX_ITEMS), [items]);

  useEffect(() => {
    if (impressionLoggedRef.current) return;
    if (!inViewOnce) return;
    if (loading) return;
    if (list.length === 0) return;
    impressionLoggedRef.current = true;
    logHomeSectionImpression({
      sectionName: HOME_SECTION_NAME.HOME_CURATOR_ACTIVITY_FEED,
      itemCount: list.length,
      loggedIn,
      followedOnly: effectiveTab === TAB_FOLLOWED && Boolean(viewerId),
      userId: viewerId,
      experimentBucket,
    });
  }, [
    effectiveTab,
    experimentBucket,
    inViewOnce,
    list.length,
    loading,
    loggedIn,
    viewerId,
  ]);

  if (!loading && list.length === 0) return null;

  return (
    <section ref={sectionRef} style={styles.section} aria-label="큐레이터 활동 피드">
      <div style={styles.headRow}>
        <div style={styles.headText}>
          <div style={styles.titleRow}>
            <span aria-hidden="true">✨</span>
            <span>지금 큐레이터들 활동</span>
          </div>
          <div style={styles.sub}>
            {effectiveTab === TAB_FOLLOWED
              ? augmentedFromAll
                ? "내가 픽한 사람들 활동이 적어서 전체 공개 활동도 함께 보여드려요"
                : "내가 픽한 사람들 우선 · 최근 컬렉션 만들기·업데이트·인기 저장"
              : "최근 컬렉션 만들기·업데이트·인기 저장 라이브"}
          </div>
        </div>
        {showTabs ? (
          <div style={styles.tabs} role="tablist" aria-label="활동 범위">
            <button
              type="button"
              role="tab"
              aria-selected={effectiveTab === TAB_FOLLOWED}
              onClick={() => setTab(TAB_FOLLOWED)}
              style={{
                ...styles.tabBtn,
                ...(effectiveTab === TAB_FOLLOWED
                  ? styles.tabBtnActive
                  : null),
              }}
            >
              내가 픽한 사람들
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={effectiveTab === TAB_ALL}
              onClick={() => setTab(TAB_ALL)}
              style={{
                ...styles.tabBtn,
                ...(effectiveTab === TAB_ALL ? styles.tabBtnActive : null),
              }}
            >
              전체 활동
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div style={styles.loadingChip}>활동 모으는 중…</div>
      ) : (
        <ul style={styles.list}>
          {list.map((item, idx) => {
            const badge = eventTypeBadge(item.type);
            const lines = eventSentenceParts(item);
            const ago = timeAgoKo(item.occurred_at);
            const cid = item.collection?.id;
            return (
              <li key={item.key} style={styles.li}>
                <button
                  type="button"
                  onClick={() => {
                    if (!cid) return;
                    navigate(`/collection/${cid}`);
                    logCollectionInteraction({
                      eventType: COLLECTION_INTERACTION_EVENT.COLLECTION_OPEN,
                      sourceSection:
                        COLLECTION_INTERACTION_SOURCE_SECTION.HOME_CURATOR_ACTIVITY_FEED,
                      collectionId: cid,
                      clickedRank: idx + 1,
                      experimentBucket,
                    });
                  }}
                  disabled={!cid}
                  style={styles.row}
                  aria-label={`컬렉션 ${item.collection?.title || ""} 열기`}
                >
                  <div style={styles.avatarWrap}>
                    <ActivityAvatar actor={item.actor} />
                  </div>
                  <div style={styles.body}>
                    <div style={styles.topRow}>
                      <span
                        style={{
                          ...styles.typeBadge,
                          color: badge.color,
                          borderColor: badge.border,
                          background: badge.bg,
                        }}
                      >
                        {badge.text}
                      </span>
                      {ago ? <span style={styles.ago}>{ago}</span> : null}
                    </div>
                    <div style={styles.sentence}>{lines[0]}</div>
                  </div>
                  <span aria-hidden="true" style={styles.arrow}>
                    →
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default memo(HomeCuratorActivityFeed);

const styles = {
  section: {
    width: "100%",
    marginBottom: 8,
    padding: "10px 12px 10px",
    borderRadius: 16,
    background: "rgba(22,22,22,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },
  headRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  headText: {
    minWidth: 0,
    flex: "1 1 auto",
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
  tabs: {
    display: "flex",
    gap: 4,
    flexShrink: 0,
    padding: 2,
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  tabBtn: {
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 800,
    border: "1px solid transparent",
    background: "transparent",
    color: "rgba(255,255,255,0.55)",
    borderRadius: 999,
    cursor: "pointer",
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  },
  tabBtnActive: {
    background: "linear-gradient(135deg, #fff1f2 0%, #fff7ed 100%)",
    borderColor: "rgba(225,29,72,0.35)",
    color: "#9f1239",
  },
  loadingChip: {
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: 600,
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  li: { margin: 0 },
  row: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(14,14,14,0.94)",
    color: "#eee",
    cursor: "pointer",
    textAlign: "left",
  },
  avatarWrap: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: "50%",
    overflow: "hidden",
    background:
      "linear-gradient(160deg, rgba(46,204,113,0.35), rgba(52,152,219,0.28))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover" },
  avatarFallback: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(255,255,255,0.92)",
  },
  body: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  typeBadge: {
    fontSize: 10,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 999,
    padding: "1px 8px",
    letterSpacing: "0.02em",
  },
  ago: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.5)",
  },
  sentence: {
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    lineHeight: 1.35,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  arrow: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(255,255,255,0.45)",
  },
};
