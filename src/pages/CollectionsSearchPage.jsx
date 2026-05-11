import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  COLLECTION_INTERACTION_EVENT,
  COLLECTION_INTERACTION_SOURCE_SECTION,
  logCollectionInteraction,
} from "../api/collectionInteractionLogs";
import { isFeaturedActive } from "../api/collections";
import { fetchPopularCollectionSearchTags } from "../api/collectionPopularSearches";
import { searchCollections, tokenizeCollectionSearchQuery } from "../api/collectionSearch";
import CollectionCoverMedia from "../components/Collections/CollectionCoverMedia";
import CollectionSearchCardSocial from "../components/Collections/CollectionSearchCardSocial";
import CollectionVibeCaption from "../components/Collections/CollectionVibeCaption";
import {
  COLLECTION_TAG_PRESETS,
  dedupeAndNormalizeCollectionTags,
} from "../utils/collectionTags";
import {
  clearRecentCollectionSearches,
  pushRecentCollectionSearch,
  readRecentCollectionSearches,
  removeRecentCollectionSearch,
} from "../utils/collectionRecentSearches";

const QUERY_PARAM = "q";
const DEBOUNCE_MS = 280;

/**
 * `searchCollections` 가중치와 동일한 순위로 primary 그룹을 고른다.
 * presentation 전용 — API 로직은 수정하지 않는다.
 */
const MATCH_SOURCE_WEIGHT = Object.freeze({
  title: 5,
  tags: 3,
  vibe: 2,
  step_label: 1,
});

const MATCH_GROUP_ORDER = /** @type {const} */ ([
  "title",
  "tags",
  "vibe",
  "step_label",
]);

/** 태그 그룹 헤더용 — 프리셋 외 자주 쓰는 검색어. */
const TAG_HEADING_EXTRA = Object.freeze(["카페", "와인"]);

/**
 * 한 행이 여러 소스에 매칭되면 가중치가 가장 큰 소스 그룹 하나에만 넣는다.
 *
 * @param {string[] | undefined} matchSources
 * @returns {"title"|"tags"|"vibe"|"step_label"}
 */
function primaryMatchGroup(matchSources) {
  const src = Array.isArray(matchSources) ? matchSources : [];
  let bestKey = "title";
  let bestW = -1;
  for (const key of MATCH_GROUP_ORDER) {
    if (!src.includes(key)) continue;
    const w = MATCH_SOURCE_WEIGHT[key];
    if (w > bestW) {
      bestW = w;
      bestKey = key;
    }
  }
  return bestKey;
}

/**
 * @param {string} query
 * @returns {string}
 */
function titleGroupHeading(query) {
  const q = String(query ?? "").trim();
  if (q.length > 0 && q.length <= 20) {
    return `「${q}」 제목에 가까운 코스`;
  }
  return "제목에 잘 맞는 코스";
}

/**
 * @param {string} query
 * @returns {string}
 */
function tagGroupHeading(query) {
  const tokens = tokenizeCollectionSearchQuery(query);
  const presetSet = new Set(
    [...COLLECTION_TAG_PRESETS, ...TAG_HEADING_EXTRA].map((p) =>
      String(p).toLowerCase(),
    ),
  );
  for (const t of tokens) {
    const key = t.trim().toLowerCase();
    if (presetSet.has(key)) {
      const fromPreset = COLLECTION_TAG_PRESETS.find(
        (p) => p.toLowerCase() === key,
      );
      const label = fromPreset || t.trim();
      return `"${label}" 태그와 잘 맞는 코스`;
    }
  }
  return "상황 태그와 잘 맞는 코스";
}

/**
 * @param {string} query
 * @returns {string}
 */
function stepGroupHeading(query) {
  const q = String(query ?? "");
  const m = q.match(/([1-9])\s*차/);
  if (m) {
    return `${m[1]}차 흐름이 포함된 코스`;
  }
  return "코스 흐름(단계 라벨)에 맞는 코스";
}

/**
 * @param {string} query
 * @returns {string}
 */
function vibeGroupHeading(query) {
  const q = String(query ?? "").trim();
  if (q.length > 0 && q.length <= 24) {
    return `“${q}” 무드와 잘 맞는 코스`;
  }
  return "한 줄 무드(분위기)에 맞는 코스";
}

const GROUP_HEADING_FN = Object.freeze({
  title: titleGroupHeading,
  tags: tagGroupHeading,
  vibe: vibeGroupHeading,
  step_label: stepGroupHeading,
});

/**
 * 자주 쓰는 검색어 — `fetchPopularCollectionSearchTags` 결과가 비어있을 때 fallback.
 * 운영 데이터가 쌓이기 전 lightweight quality floor 역할.
 */
const SUGGESTED_QUERIES = [
  "성수 데이트",
  "을지로 2차",
  "야장",
  "노포",
  "혼술",
  "새벽",
];

/**
 * `/collections/search` — 컬렉션(코스) 검색 전용 페이지.
 *
 * 장소 검색 / `useCourseSearch` 와 완전히 별개로 동작한다. 데이터 소스는
 * `searchCollections` 한 함수, 결과는 cover · title · 대표 step labels · 저장 수.
 * 카드 클릭 시 `collection_open` 이벤트를 `collection_search` source 로 남긴다.
 */
export default function CollectionsSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQuery = searchParams.get(QUERY_PARAM) ?? "";
  const [input, setInput] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery.trim());
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [recentQueries, setRecentQueries] = useState(() =>
    readRecentCollectionSearches(),
  );
  const [popularQueries, setPopularQueries] = useState([]);

  const debounceRef = useRef(null);

  /** 인기 검색어(태그 빈도 heuristic) — 마운트 시 1회. 실패해도 fallback 으로 폴백. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tags = await fetchPopularCollectionSearchTags({ limit: 6 });
        if (!cancelled) setPopularQueries(Array.isArray(tags) ? tags : []);
      } catch {
        if (!cancelled) setPopularQueries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** active query 가 결정되면 (≥1자) localStorage 최근 검색어에 push. */
  useEffect(() => {
    if (!activeQuery) return;
    const next = pushRecentCollectionSearch(activeQuery);
    setRecentQueries(next);
  }, [activeQuery]);

  /** URL `?q=` 변화 감지 — 외부 링크로 들어온 경우에도 입력/active 동기화. */
  useEffect(() => {
    const fromUrl = searchParams.get(QUERY_PARAM) ?? "";
    setInput((prev) => (prev === fromUrl ? prev : fromUrl));
    setActiveQuery((prev) => {
      const trimmed = fromUrl.trim();
      return prev === trimmed ? prev : trimmed;
    });
  }, [searchParams]);

  /** active query 변화 → fetch. 빈 쿼리는 초기 hint 만 노출하고 fetch 생략. */
  useEffect(() => {
    let cancelled = false;
    if (!activeQuery) {
      setResults([]);
      setErrorMsg("");
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setErrorMsg("");
    (async () => {
      try {
        const rows = await searchCollections(activeQuery, { limit: 30 });
        if (!cancelled) setResults(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e?.message || "검색 중 오류가 발생했어요.");
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeQuery]);

  /** 입력 → 디바운스 → URL 동기화. URL 변화가 active 갱신을 트리거. */
  const onInputChange = useCallback(
    (e) => {
      const next = e.target.value;
      setInput(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const trimmed = next.trim();
        setSearchParams(
          (prev) => {
            const np = new URLSearchParams(prev);
            if (trimmed) np.set(QUERY_PARAM, trimmed);
            else np.delete(QUERY_PARAM);
            return np;
          },
          { replace: true },
        );
      }, DEBOUNCE_MS);
    },
    [setSearchParams],
  );

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const trimmed = input.trim();
      setSearchParams(
        (prev) => {
          const np = new URLSearchParams(prev);
          if (trimmed) np.set(QUERY_PARAM, trimmed);
          else np.delete(QUERY_PARAM);
          return np;
        },
        { replace: true },
      );
    },
    [input, setSearchParams],
  );

  const onSuggested = useCallback(
    (s) => {
      setInput(s);
      setSearchParams(
        (prev) => {
          const np = new URLSearchParams(prev);
          np.set(QUERY_PARAM, s);
          return np;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const onClear = useCallback(() => {
    setInput("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchParams(
      (prev) => {
        const np = new URLSearchParams(prev);
        np.delete(QUERY_PARAM);
        return np;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const onRemoveRecent = useCallback((q) => {
    setRecentQueries(removeRecentCollectionSearch(q));
  }, []);

  const onClearRecent = useCallback(() => {
    setRecentQueries(clearRecentCollectionSearches());
  }, []);

  /** fallback 포함 — 인기 fetch 가 비어있으면 기존 SUGGESTED_QUERIES 그대로 노출. */
  const popularDisplay = useMemo(() => {
    if (popularQueries.length > 0) return popularQueries;
    return SUGGESTED_QUERIES;
  }, [popularQueries]);

  const groupedResults = useMemo(() => {
    /**
     * @type {{
     *   title: object[],
     *   tags: object[],
     *   vibe: object[],
     *   step_label: object[],
     * }}
     */
    const buckets = { title: [], tags: [], vibe: [], step_label: [] };
    results.forEach((row, globalIdx) => {
      const key = primaryMatchGroup(row?.match_sources);
      buckets[key].push({ row, globalIdx });
    });
    return buckets;
  }, [results]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button
          type="button"
          style={styles.backBtn}
          onClick={() => navigate(-1)}
        >
          ← 뒤로
        </button>
        <h1 style={styles.title}>코스 검색</h1>
        <p style={styles.subtitle}>
          공개된 코스의 제목·태그·한 줄 무드·단계 라벨을 한 번에 검색해요.
          <br />
          예) “성수 데이트”, “야장”, “을지로 2차”, “비 오는 날”, “새벽 감성”
        </p>
      </header>

      <form style={styles.form} onSubmit={onSubmit} role="search">
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={input}
          onChange={onInputChange}
          placeholder="코스 키워드를 입력하세요"
          style={styles.input}
          aria-label="코스 검색어"
        />
        {input ? (
          <button
            type="button"
            onClick={onClear}
            style={styles.clearBtn}
            aria-label="검색어 지우기"
          >
            ×
          </button>
        ) : null}
      </form>

      {!activeQuery ? (
        <div style={styles.idleStack}>
          {recentQueries.length > 0 ? (
            <section style={styles.suggestions} aria-label="최근 검색어">
              <div style={styles.suggestionHead}>
                <div style={styles.suggestionTitle}>최근 검색</div>
                <button
                  type="button"
                  onClick={onClearRecent}
                  style={styles.clearAllBtn}
                  aria-label="최근 검색어 전체 삭제"
                >
                  전체 삭제
                </button>
              </div>
              <div style={styles.suggestionRow}>
                {recentQueries.map((q) => (
                  <span
                    key={`recent-${q.toLowerCase()}`}
                    style={styles.recentChipWrap}
                  >
                    <button
                      type="button"
                      onClick={() => onSuggested(q)}
                      style={styles.recentChip}
                      title={`"${q}" 다시 검색`}
                    >
                      <span style={styles.recentChipIcon} aria-hidden="true">
                        ⏱
                      </span>
                      {q}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveRecent(q)}
                      style={styles.recentRemoveBtn}
                      aria-label={`${q} 최근 검색에서 삭제`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section style={styles.suggestions} aria-label="인기 검색어">
            <div style={styles.suggestionHead}>
              <div style={styles.suggestionTitle}>
                {popularQueries.length > 0
                  ? "지금 사람들이 자주 보는 키워드"
                  : "이런 키워드 어때요?"}
              </div>
            </div>
            <div style={styles.suggestionRow}>
              {popularDisplay.map((s) => (
                <button
                  key={`popular-${s.toLowerCase()}`}
                  type="button"
                  onClick={() => onSuggested(s)}
                  style={styles.suggestionChip}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : loading ? (
        <div style={styles.helper}>검색 중…</div>
      ) : errorMsg ? (
        <div style={{ ...styles.helper, color: "#e74c3c" }}>{errorMsg}</div>
      ) : results.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyTitle}>
            “{activeQuery}” 와 매칭되는 공개 코스가 없어요.
          </div>
          <div style={styles.emptySub}>
            다른 단어로 검색해 보거나, 비슷한 흐름의 코스를 직접 만들어 볼 수
            있어요.
          </div>
          <Link to="/my-collections" style={styles.emptyCta}>
            내 컬렉션 만들기 →
          </Link>
        </div>
      ) : (
        <div style={styles.groupedResults} aria-label="검색 결과 그룹">
          {MATCH_GROUP_ORDER.map((groupKey) => {
            const entries = groupedResults[groupKey];
            if (!entries.length) return null;
            const headingFn = GROUP_HEADING_FN[groupKey];
            const heading =
              typeof headingFn === "function"
                ? headingFn(activeQuery)
                : "";
            return (
              <section
                key={groupKey}
                style={styles.groupSection}
                aria-labelledby={`collection-search-group-${groupKey}`}
              >
                <h2
                  id={`collection-search-group-${groupKey}`}
                  style={styles.groupHeading}
                >
                  {heading}
                </h2>
                <div style={styles.groupCardList}>
                  {entries.map(({ row, globalIdx }) => (
                    <SearchResultCard
                      key={row.id}
                      row={row}
                      query={activeQuery}
                      primaryGroup={groupKey}
                      onClick={() => {
                        navigate(`/collection/${row.id}`);
                        logCollectionInteraction({
                          eventType:
                            COLLECTION_INTERACTION_EVENT.COLLECTION_OPEN,
                          sourceSection:
                            COLLECTION_INTERACTION_SOURCE_SECTION.COLLECTION_SEARCH,
                          collectionId: row.id,
                          clickedRank: globalIdx + 1,
                        });
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ row, query, primaryGroup, onClick }) {
  const [hover, setHover] = useState(false);
  const tags = useMemo(
    () => dedupeAndNormalizeCollectionTags(row?.tags),
    [row?.tags],
  );
  const featured = isFeaturedActive(row);
  const placeCount = Number.isFinite(Number(row?.place_count))
    ? Number(row.place_count)
    : 0;
  const stepLabels = Array.isArray(row?.step_labels) ? row.step_labels : [];

  const lowerQuery = String(query ?? "").toLowerCase();

  const matchSources = Array.isArray(row?.match_sources)
    ? row.match_sources
    : [];

  const secondarySources = matchSources.filter((s) => s !== primaryGroup);

  return (
    <div
      style={{
        ...styles.cardOuter,
        ...(hover ? styles.cardOuterHover : null),
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button type="button" onClick={onClick} style={styles.cardMain}>
        <CollectionCoverMedia
          url={row?.cover_image_url}
          collectionId={row?.id}
          letter={(row?.title || "").trim().charAt(0) || "·"}
          tags={row?.tags}
          stepLabels={row?.step_labels}
          wrapperStyle={styles.cardCover}
          letterTextStyle={styles.cardCoverLetter}
        />
        <div style={styles.cardBody}>
          <div style={styles.cardTitleRow}>
            {featured ? (
              <span style={styles.editorPickBadge} title="운영자가 추천하는 코스">
                ★
              </span>
            ) : null}
            <div style={styles.cardTitle}>
              {row?.title || "(제목 없음)"}
            </div>
          </div>

          <CollectionVibeCaption
            value={row?.vibe_caption}
            variant="card"
            highlighted={matchSources.includes("vibe")}
          />

          {stepLabels.length > 0 ? (
            <div style={styles.stepRow}>
              {stepLabels.map((lbl, i) => {
                const active =
                  lowerQuery.length > 0 &&
                  lbl.toLowerCase().includes(lowerQuery);
                return (
                  <span
                    key={`${i}-${lbl}`}
                    style={{
                      ...styles.stepChip,
                      ...(active ? styles.stepChipActive : null),
                    }}
                  >
                    {lbl}
                  </span>
                );
              })}
            </div>
          ) : null}

          {tags.length > 0 ? (
            <div style={styles.tagRow}>
              {tags.slice(0, 4).map((t) => {
                const active =
                  lowerQuery.length > 0 &&
                  t.toLowerCase().includes(lowerQuery);
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

          <div style={styles.metaRow}>
            <span style={styles.placeChip}>장소 {placeCount}</span>
            {secondarySources.length > 0 ? (
              <span style={styles.matchHint} title="추가로 걸린 매칭">
                +{" "}
                {[
                  secondarySources.includes("title") ? "제목" : null,
                  secondarySources.includes("tags") ? "태그" : null,
                  secondarySources.includes("vibe") ? "무드" : null,
                  secondarySources.includes("step_label") ? "흐름" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {" 도 매칭"}
              </span>
            ) : null}
          </div>
        </div>
      </button>
      <CollectionSearchCardSocial
        collectionId={row.id}
        initialLikeCount={row.like_count}
        initialSaveCount={row.save_count}
      />
    </div>
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
    gap: 14,
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
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.5,
    wordBreak: "keep-all",
  },
  form: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    padding: "0 14px",
    fontSize: 14,
    fontWeight: 700,
    outline: "none",
  },
  clearBtn: {
    position: "absolute",
    right: 6,
    top: 6,
    bottom: 6,
    width: 32,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  idleStack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  suggestions: {
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.02)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  suggestionHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(255,255,255,0.7)",
  },
  clearAllBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
  },
  suggestionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  suggestionChip: {
    border: "1px solid rgba(155,89,182,0.32)",
    background: "rgba(155,89,182,0.08)",
    color: "#dcc6ff",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  recentChipWrap: {
    display: "inline-flex",
    alignItems: "stretch",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    overflow: "hidden",
  },
  recentChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.85)",
    padding: "6px 8px 6px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  recentChipIcon: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
  recentRemoveBtn: {
    width: 26,
    background: "rgba(0,0,0,0.25)",
    border: "none",
    borderLeft: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
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
  groupedResults: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },
  groupSection: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  groupHeading: {
    margin: 0,
    fontSize: 13,
    fontWeight: 800,
    color: "rgba(255,255,255,0.88)",
    letterSpacing: "-0.02em",
    paddingBottom: 2,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    wordBreak: "keep-all",
  },
  groupCardList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  cardOuter: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(14,14,14,0.96)",
    color: "#eee",
    overflow: "hidden",
    transition: "border-color 0.15s ease, transform 0.15s ease",
  },
  cardOuterHover: {
    borderColor: "rgba(255,255,255,0.22)",
    transform: "translateY(-1px)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
    padding: 0,
    margin: 0,
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    WebkitTapHighlightColor: "transparent",
  },
  cardCover: {
    width: 96,
    flexShrink: 0,
    alignSelf: "stretch",
    minHeight: 96,
  },
  cardCoverLetter: {
    fontSize: 22,
    fontWeight: 900,
    color: "rgba(255,255,255,0.88)",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px 10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  editorPickBadge: {
    fontSize: 11,
    fontWeight: 900,
    color: "#0c1410",
    background: "linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)",
    border: "1px solid rgba(217,119,6,0.55)",
    borderRadius: 999,
    padding: "1px 6px",
    letterSpacing: "0.02em",
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.3,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    flex: 1,
    minWidth: 0,
  },
  stepRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
  },
  stepChip: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.78)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 999,
    padding: "2px 8px",
  },
  stepChipActive: {
    color: "#ead9ff",
    background: "rgba(155,89,182,0.22)",
    border: "1px solid rgba(155,89,182,0.55)",
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
  metaRow: {
    marginTop: 2,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  placeChip: {
    fontSize: 11,
    fontWeight: 800,
    color: "#fff",
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.4)",
    borderRadius: 999,
    padding: "2px 8px",
  },
  matchHint: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.45)",
    fontStyle: "italic",
    marginLeft: "auto",
  },
};
