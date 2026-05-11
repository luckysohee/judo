import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { fetchSimilarTasteUsers } from "../../api/userTasteSimilarity";
import PickUserButton from "../PickUserButton/PickUserButton";
import {
  HOME_SECTION_NAME,
  logHomeSectionImpression,
} from "../../api/homeSectionImpressions";
import { useIntersectionOnce } from "../../hooks/useIntersectionOnce";

const CACHE_TTL_MS = 60_000;
const cacheByViewerId = new Map();

/**
 * 홈「취향이 비슷한 사람」 — 내가 저장한 컬렉션과 겹침이 큰 사용자 가로 레일.
 *
 * - 비로그인이면 자체 `null` 렌더 → 기존 큐레이터 활동 / 공개 레일이 fallback 으로 살아있음.
 * - 0건이거나 시그널 없을 때도 `null`.
 * - 카드는 avatar · display_name · 공통 tag · reason 한 줄 + 픽 버튼.
 * - 검색·지도·`useCourseSearch` 와 무관하게 단독 fetch.
 */
function HomeSimilarUsersSection({
  experimentBucket = null,
  hideHeader = false,
} = {}) {
  const { user, loading: authLoading } = useAuth();
  const viewerId = user?.id || null;
  const loggedIn = Boolean(viewerId);
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ref: sectionRef, seen: inViewOnce } = useIntersectionOnce({
    rootMargin: "0px",
    threshold: 0.15,
  });
  const impressionLoggedRef = useRef(false);
  /** uid → true (이번 세션에서 픽한 카드 — UI 에서만 즉시 dim 처리) */
  const [pickedSet, setPickedSet] = useState(() => new Set());

  useEffect(() => {
    if (authLoading) return undefined;
    if (!viewerId) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const now = Date.now();
        const cached = cacheByViewerId.get(viewerId);
        if (cached?.data && now - cached.at < CACHE_TTL_MS) {
          if (!cancelled) setItems(cached.data);
          return;
        }
        const rows = await fetchSimilarTasteUsers(viewerId, { limit: 8 });
        const safe = Array.isArray(rows) ? rows : [];
        cacheByViewerId.set(viewerId, { at: Date.now(), data: safe });
        if (!cancelled) setItems(safe);
      } catch (e) {
        if (import.meta?.env?.DEV) {
          console.warn("HomeSimilarUsersSection:", e?.message || e);
        }
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, viewerId]);

  const goToProfile = useCallback(
    (uid) => {
      if (!uid) return;
      navigate(`/u/${uid}`);
    },
    [navigate],
  );

  const onBecomePickingForUser = useCallback((uid) => {
    setPickedSet((prev) => {
      const next = new Set(prev);
      next.add(uid);
      return next;
    });
  }, []);

  useEffect(() => {
    if (impressionLoggedRef.current) return;
    if (!inViewOnce) return;
    if (loading) return;
    if (items.length === 0) return;
    impressionLoggedRef.current = true;
    logHomeSectionImpression({
      sectionName: HOME_SECTION_NAME.HOME_SIMILAR_USERS,
      itemCount: items.length,
      loggedIn,
      followedOnly: false,
      userId: viewerId,
      experimentBucket,
    });
  }, [experimentBucket, inViewOnce, items.length, loading, loggedIn, viewerId]);

  if (authLoading) return null;
  if (!viewerId) return null;

  return (
    <section ref={sectionRef} style={styles.section} aria-label="취향이 비슷한 사람">
      {!hideHeader ? (
        <div style={styles.headRow}>
          <div style={styles.headText}>
            <div style={styles.titleRow}>
              <span aria-hidden="true">🤝</span>
              <span>취향이 비슷한 사람</span>
            </div>
            <div style={styles.sub}>
              내가 저장한 코스를 같이 저장한 사람들 · 픽해두면 활동 피드에 빠르게
              올라와요
            </div>
          </div>
        </div>
      ) : null}

      <div style={styles.scroller}>
        {loading ? (
          <div style={styles.loadingChip}>불러오는 중…</div>
        ) : items.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyTitle}>첫 코스를 저장하면 취향 추천이 시작돼요</div>
            <div style={styles.emptySub}>
              저장이 쌓이면 비슷한 취향 사용자와 큐레이터를 더 잘 찾아줘요.
            </div>
          </div>
        ) : (
          items.map((u) => {
            const justPicked = pickedSet.has(u.user_id);
            const nameLabel =
              u.display_name ||
              (u.username ? `@${u.username}` : "이름 미정 사용자");
            const initialChar = computeInitial(u.display_name, u.username);
            return (
              <div
                key={u.user_id}
                style={{
                  ...styles.card,
                  ...(justPicked ? styles.cardPicked : null),
                }}
              >
                <button
                  type="button"
                  onClick={() => goToProfile(u.user_id)}
                  style={styles.identityBtn}
                  aria-label={`${nameLabel} 프로필 열기`}
                >
                  <UserAvatar
                    url={u.avatar_url}
                    initial={initialChar}
                  />
                  <div style={styles.identityBody}>
                    <div style={styles.nameLine} title={nameLabel}>
                      {nameLabel}
                    </div>
                    {u.username && u.display_name ? (
                      <div style={styles.handleLine} title={`@${u.username}`}>
                        @{u.username}
                      </div>
                    ) : null}
                  </div>
                </button>

                <div style={styles.metaCol}>
                  {u.common_top_tag ? (
                    <div
                      style={styles.tagChip}
                      title="자주 같이 저장한 태그"
                    >
                      #{u.common_top_tag}
                    </div>
                  ) : u.common_top_step_label ? (
                    <div
                      style={styles.tagChip}
                      title="자주 같이 저장한 흐름"
                    >
                      {u.common_top_step_label}
                    </div>
                  ) : null}
                  <div style={styles.reasonLine} title={u.reason}>
                    {u.reason}
                  </div>
                  <div style={styles.overlapLine}>
                    공통 저장 {u.overlap_collection_count}코스
                  </div>
                </div>

                <div style={styles.ctaCol}>
                  <PickUserButton
                    profileUserId={u.user_id}
                    loginPromptMessage="로그인 후 픽할 수 있습니다."
                    onBecomePicking={() => onBecomePickingForUser(u.user_id)}
                    buttonStyle={styles.pickBtnOverride}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default memo(HomeSimilarUsersSection);

function computeInitial(displayName, username) {
  const src = String(displayName || username || "·").trim();
  const ch = src.replace(/^@\s*/, "").charAt(0);
  return ch ? ch.toUpperCase() : "·";
}

function UserAvatar({ url, initial }) {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (trimmed) {
    return (
      <img
        src={trimmed}
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

const styles = {
  section: {
    width: "100%",
    marginBottom: 8,
    padding: "10px 12px 12px",
    borderRadius: 16,
    background: "rgba(22,22,22,0.92)",
    border: "1px solid rgba(52,152,219,0.24)",
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
    lineHeight: 1.4,
    wordBreak: "keep-all",
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
    width: "min(320px, 92vw)",
    padding: "14px 16px",
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
    width: "min(280px, 86vw)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "10px 12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(14,14,14,0.96)",
    color: "#eee",
    transition: "border-color 0.15s ease, background 0.15s ease",
  },
  cardPicked: {
    border: "1px solid rgba(46,204,113,0.45)",
    background:
      "linear-gradient(140deg, rgba(46,204,113,0.08), rgba(14,14,14,0.96) 70%)",
  },
  identityBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 0,
    margin: 0,
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    minWidth: 0,
    WebkitTapHighlightColor: "transparent",
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
    border: "1px solid rgba(255,255,255,0.12)",
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(160deg, rgba(52,152,219,0.45), rgba(155,89,182,0.32))",
    fontSize: 18,
    fontWeight: 900,
    color: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  identityBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  nameLine: {
    fontSize: 13,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.02em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  handleLine: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  metaCol: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  tagChip: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: 800,
    color: "#d4f4dd",
    background: "rgba(46,204,113,0.14)",
    border: "1px solid rgba(46,204,113,0.42)",
    borderRadius: 999,
    padding: "2px 10px",
    letterSpacing: "-0.01em",
    maxWidth: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  reasonLine: {
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    lineHeight: 1.35,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    wordBreak: "keep-all",
  },
  overlapLine: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.5)",
  },
  ctaCol: {
    display: "flex",
    justifyContent: "flex-end",
  },
  // PickUserButton 의 기본 buttonStyle 을 카드용 컴팩트 형태로 override.
  pickBtnOverride: {
    marginTop: 0,
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 800,
    minHeight: 36,
    borderRadius: 999,
  },
};
