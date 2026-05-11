import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchHomeCollectionsByTag } from "../../api/collections";
import { fetchProfileTastePreferences } from "../../api/userPreferenceTags";
import { useAuth } from "../../context/AuthContext";
import HomeCollectionTagRail from "./HomeCollectionTagRail";
import {
  HOME_SECTION_NAME,
  logHomeSectionImpression,
} from "../../api/homeSectionImpressions";
import { useIntersectionOnce } from "../../hooks/useIntersectionOnce";

/** 우선 노출 상황 탭 (순서 = fallback 기본 선택 순서). 온보딩 태그와 동일 집합 유지. */
const SITUATION_TAGS = [
  "데이트",
  "야장",
  "노포",
  "혼술",
  "소개팅",
  "새벽",
  "가성비",
  "분위기",
];

/**
 * 시간대별 우선 태그 — 검색·추천 score 와 무관한 단순 contextual hint.
 *
 * 시간대 버킷:
 * - 오후(12–17): 데이트·카페·와인 흐름
 * - 저녁(17–22): 야장·노포
 * - 늦은 밤(22–04): 새벽·혼술·2차
 * - 그 외(04–12): 기본 fallback
 *
 * `availableTags` 와 교집합을 잡아 첫 매칭을 초기 선택으로 사용한다.
 *
 * @param {number} hour — 0~23 시(현지 시간)
 * @returns {{ bucket: "afternoon"|"evening"|"latenight"|"morning", priority: string[] }}
 */
function timeContextForHour(hour) {
  if (hour >= 12 && hour < 17) {
    return {
      bucket: "afternoon",
      priority: ["데이트", "카페", "와인", "분위기", "소개팅"],
    };
  }
  if (hour >= 17 && hour < 22) {
    return {
      bucket: "evening",
      priority: ["야장", "노포", "데이트", "분위기"],
    };
  }
  if (hour >= 22 || hour < 4) {
    return {
      bucket: "latenight",
      priority: ["새벽", "혼술", "노포", "야장"],
    };
  }
  return {
    bucket: "morning",
    priority: ["데이트", "소개팅", "분위기"],
  };
}

const TIME_CONTEXT_COPY = {
  afternoon: "오후엔 데이트·카페·와인이 잘 어울려요",
  evening: "저녁엔 야장·노포가 잘 어울려요",
  latenight: "늦은 밤엔 새벽·혼술·2차가 잘 어울려요",
  morning: "지금 시간엔 데이트·소개팅이 무난해요",
};

/**
 * 온보딩·프로필 `preference_tags` 와 시간대 우선순위를 합쳐 초기 탭 결정.
 *
 * @param {string[]} priority
 * @param {string[]} available
 * @param {string[]} preferenceTags
 * @returns {string | null}
 */
function pickInitialSituationTag(priority, available, preferenceTags) {
  if (!Array.isArray(available) || available.length === 0) return null;
  const prefs = Array.isArray(preferenceTags) ? preferenceTags : [];
  for (const p of prefs) {
    const t = typeof p === "string" ? p.trim() : "";
    if (t && available.includes(t)) return t;
  }
  return pickInitialTag(priority, available);
}

/**
 * `priority` 안에서 `available` 에 첫 매칭되는 태그. 없으면 `available[0]`.
 *
 * @param {string[]} priority
 * @param {string[]} available
 * @returns {string | null}
 */
function pickInitialTag(priority, available) {
  if (!Array.isArray(available) || available.length === 0) return null;
  for (const t of priority) {
    if (available.includes(t)) return t;
  }
  return available[0];
}

/**
 * 홈 상단 — 상황 태그 칩 + 단일 `HomeCollectionTagRail`.
 *
 * - 결과 0개 태그는 칩에서 제외(숨김).
 * - 기본 선택: 로그인 시 `preference_tags`(온보딩) 와 겹치는 탭 우선,
 *   없으면 시간대 우선순위 → `availableTags[0]`.
 * - 유저가 직접 칩을 누른 뒤에는 시간대 변경에 의한 자동 변경 금지.
 * - 정렬·featured 우선: `fetchHomeCollectionsByTag` 그대로.
 * - 카드 클릭 로그: `home_tag_rail` (`HomeCollectionTagRail` 내부).
 *
 * @param {{ railLimit?: number }} [props]
 */
function HomeSituationCollectionsSection({
  railLimit = 6,
  experimentBucket = null,
} = {}) {
  const { user, loading: authLoading } = useAuth();
  const loggedIn = Boolean(user?.id);
  const [preferenceTags, setPreferenceTags] = useState([]);
  const [probing, setProbing] = useState(true);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const userTouchedRef = useRef(false);
  const [railItemCount, setRailItemCount] = useState(0);
  const { ref: sectionRef, seen: inViewOnce } = useIntersectionOnce({
    rootMargin: "0px",
    threshold: 0.15,
  });
  const impressionLoggedRef = useRef(false);

  const timeContext = useMemo(() => {
    const now = new Date();
    return timeContextForHour(now.getHours());
  }, []);

  useEffect(() => {
    if (authLoading || !user?.id) {
      setPreferenceTags([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchProfileTastePreferences(user.id);
        if (!cancelled)
          setPreferenceTags(
            Array.isArray(row?.preference_tags) ? row.preference_tags : [],
          );
      } catch {
        if (!cancelled) setPreferenceTags([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProbing(true);
      try {
        // 동시 8개 fetch를 한 번에 쏘지 않고, 첫 진입 페인트 이후로 미루기.
        // (intersection mount 와 함께 동작하면 초기 체감이 훨씬 가벼워진다.)
        await new Promise((r) => setTimeout(r, 0));
        const resolved = await Promise.all(
          SITUATION_TAGS.map(async (tag) => {
            try {
              const rows = await fetchHomeCollectionsByTag(tag, {
                limit: 1,
              });
              return Array.isArray(rows) && rows.length > 0 ? tag : null;
            } catch {
              return null;
            }
          }),
        );
        const available = resolved.filter((t) => t != null);
        if (cancelled) return;
        setAvailableTags(available);
      } finally {
        if (!cancelled) setProbing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [timeContext]);

  useEffect(() => {
    if (probing || availableTags.length === 0) return;
    if (userTouchedRef.current) return;
    setSelectedTag(
      pickInitialSituationTag(
        timeContext.priority,
        availableTags,
        preferenceTags,
      ),
    );
  }, [probing, availableTags, timeContext.priority, preferenceTags]);

  const onSelectTag = useCallback((tag) => {
    userTouchedRef.current = true;
    setSelectedTag(tag);
  }, []);

  useEffect(() => {
    if (impressionLoggedRef.current) return;
    if (!inViewOnce) return;
    if (probing) return;
    if (!selectedTag) return;
    if (railItemCount <= 0) return;
    impressionLoggedRef.current = true;
    // 클릭 로그의 source_section 과 맞추기 위해 HOME_TAG_RAIL 키를 사용한다.
    logHomeSectionImpression({
      sectionName: HOME_SECTION_NAME.HOME_TAG_RAIL,
      itemCount: railItemCount,
      loggedIn,
      followedOnly: false,
      userId: user?.id ?? null,
      experimentBucket,
    });
  }, [
    experimentBucket,
    inViewOnce,
    probing,
    selectedTag,
    railItemCount,
    loggedIn,
    user?.id,
  ]);

  if (!probing && availableTags.length === 0) return null;

  const subCopy =
    TIME_CONTEXT_COPY[timeContext.bucket] ||
    "탭을 골라 같은 높이에서 코스만 바꿔 볼 수 있어요";

  return (
    <section
      ref={sectionRef}
      style={styles.section}
      aria-label="오늘 어울리는 컬렉션 코스"
    >
      <div style={styles.headRow}>
        <div style={styles.headText}>
          <div style={styles.title}>오늘 어울리는 코스</div>
          <div style={styles.sub}>{subCopy}</div>
        </div>
        <div style={styles.headLinks}>
          <Link
            to="/collections/search"
            style={styles.searchLink}
            aria-label="코스 검색"
          >
            🔍 검색
          </Link>
          {selectedTag ? (
            <Link
              to={`/collections/tag/${encodeURIComponent(selectedTag)}`}
              style={styles.moreLink}
              aria-label={`${selectedTag} 코스 더보기`}
            >
              더보기 →
            </Link>
          ) : null}
        </div>
      </div>

      {probing ? (
        <div style={styles.probeLoading}>상황 코스 확인 중…</div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="상황 탭"
            style={styles.chipRow}
          >
            {availableTags.map((tag) => {
              const selected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onSelectTag(tag)}
                  style={{
                    ...styles.chip,
                    ...(selected ? styles.chipSelected : null),
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          {selectedTag ? (
            <HomeCollectionTagRail
              key={selectedTag}
              embedded
              tag={selectedTag}
              limit={railLimit}
              onItemCount={setRailItemCount}
              experimentBucket={experimentBucket}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

export default memo(HomeSituationCollectionsSection);

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
    lineHeight: 1.35,
    wordBreak: "keep-all",
  },
  probeLoading: {
    padding: "12px 8px",
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.45)",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.78)",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  chipSelected: {
    background: "rgba(155,89,182,0.22)",
    border: "1px solid rgba(155,89,182,0.55)",
    color: "#ead9ff",
    boxShadow: "0 0 0 1px rgba(155,89,182,0.15)",
  },
  headLinks: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  searchLink: {
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(255,255,255,0.85)",
    textDecoration: "none",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    whiteSpace: "nowrap",
  },
  moreLink: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(155,89,182,0.95)",
    textDecoration: "none",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(155,89,182,0.32)",
    background: "rgba(155,89,182,0.08)",
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
  },
};
