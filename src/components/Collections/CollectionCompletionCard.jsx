import { useEffect, useMemo, useState } from "react";
import {
  computeCollectionCompletionScore,
  getCompletionLevelCopy,
} from "../../utils/collectionCompletionScore";
import { fetchCollectionSocialState } from "../../api/collectionSocial";

/**
 * 코스 완성도 카드 — `MyCollectionManagePage` 등 본인 편집 화면에서만 노출.
 *
 * - `computeCollectionCompletionScore` 결과를 progress bar + 부족 항목 리스트로 표시.
 * - public 컬렉션 정렬·추천·검색 점수와는 무관(UX 용도).
 * - `fetchCollectionSocialState` 로 like/save 카운트를 한 번 가져와 반응 점수에 반영(실패해도 graceful degrade).
 * - 부족 요소 클릭 시 `onSuggestionClick(key)` 가 있으면 호출 — 부모가 해당 입력으로 스크롤·포커싱.
 *
 * @param {{
 *   collection: {
 *     id?: string | null,
 *     title?: string | null,
 *     description?: string | null,
 *     cover_image_url?: string | null,
 *     tags?: string[] | null,
 *     visibility?: 'public' | 'private',
 *     collection_places?: Array<{ step_label?: string | null }> | null,
 *   },
 *   onSuggestionClick?: (key: 'cover'|'tags'|'step'|'place'|'desc'|'title') => void,
 *   style?: object,
 * }} props
 */
export default function CollectionCompletionCard({
  collection,
  onSuggestionClick,
  style,
}) {
  const [reactions, setReactions] = useState({ likeCount: 0, saveCount: 0 });
  const [reactionsLoaded, setReactionsLoaded] = useState(false);

  const id = String(collection?.id ?? "").trim();

  useEffect(() => {
    if (!id) {
      setReactions({ likeCount: 0, saveCount: 0 });
      setReactionsLoaded(true);
      return undefined;
    }
    let cancelled = false;
    setReactionsLoaded(false);
    (async () => {
      try {
        const s = await fetchCollectionSocialState(id);
        if (cancelled) return;
        setReactions({
          likeCount: Number(s?.like_count) || 0,
          saveCount: Number(s?.save_count) || 0,
        });
      } catch (e) {
        if (import.meta?.env?.DEV) {
          console.warn(
            "CollectionCompletionCard reactions:",
            e?.message || e,
          );
        }
        if (!cancelled) setReactions({ likeCount: 0, saveCount: 0 });
      } finally {
        if (!cancelled) setReactionsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const result = useMemo(
    () =>
      computeCollectionCompletionScore(collection, {
        likeCount: reactions.likeCount,
        saveCount: reactions.saveCount,
      }),
    [collection, reactions.likeCount, reactions.saveCount],
  );

  if (!collection) return null;

  const { score, level, components, suggestions, stats } = result;
  const levelCopy = getCompletionLevelCopy(level);
  const barColor = barColorForLevel(level);
  const isPublic = collection?.visibility === "public";

  const summaryBits = [
    `장소 ${stats.place_count}`,
    `라벨 ${stats.step_label_count}`,
    `태그 ${stats.tag_count}`,
    stats.has_cover
      ? "커버 있음"
      : stats.has_auto_mood
        ? "자동 무드 커버"
        : "커버 없음",
  ];
  if (reactionsLoaded && stats.reaction_total > 0) {
    summaryBits.push(`반응 ${stats.reaction_total}`);
  }

  return (
    <section
      style={{ ...styles.section, ...(style || null) }}
      aria-label="코스 완성도"
    >
      <div style={styles.headRow}>
        <div style={styles.headLeft}>
          <span aria-hidden="true" style={styles.emoji}>
            🧭
          </span>
          <div style={styles.headBody}>
            <div style={styles.titleRow}>
              <span style={styles.title}>코스 완성도</span>
              <span style={{ ...styles.levelBadge, ...badgeStyleFor(level) }}>
                {levelCopy}
              </span>
            </div>
            <div style={styles.sub}>
              {isPublic
                ? "공개된 코스 — 정성을 들이면 추천 카드에서도 더 잘 보여요"
                : "공개 전이라도 완성도를 올려두면 첫 노출이 자연스러워져요"}
            </div>
          </div>
        </div>
        <div style={styles.scoreWrap} aria-label={`완성도 ${score}%`}>
          <div style={styles.scoreNum}>{score}%</div>
        </div>
      </div>

      <div
        style={styles.barTrack}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            ...styles.barFill,
            width: `${score}%`,
            background: barColor,
          }}
        />
      </div>

      <div style={styles.summaryRow}>
        {summaryBits.map((b, i) => (
          <span key={`s-${i}`} style={styles.summaryChip}>
            {b}
          </span>
        ))}
      </div>

      {suggestions.length > 0 ? (
        <ul style={styles.suggList} aria-label="완성도를 올릴 수 있는 항목">
          {suggestions.slice(0, 4).map((s) => (
            <li key={s.key} style={styles.suggItem}>
              <button
                type="button"
                onClick={() => {
                  if (typeof onSuggestionClick === "function") {
                    onSuggestionClick(s.key);
                  }
                }}
                style={{
                  ...styles.suggBtn,
                  ...(typeof onSuggestionClick === "function"
                    ? styles.suggBtnClickable
                    : null),
                }}
              >
                <span aria-hidden="true" style={styles.suggDot}>
                  +
                </span>
                <span style={styles.suggText}>{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div style={styles.allDone}>모든 기본 항목이 채워졌어요</div>
      )}

      <details style={styles.details}>
        <summary style={styles.summaryToggle}>점수 구성 자세히</summary>
        <ul style={styles.componentList}>
          {components.map((c) => (
            <li key={c.key} style={styles.componentItem}>
              <span style={styles.componentLabel}>{c.label}</span>
              <span style={styles.componentScore}>
                {c.score} <span style={styles.componentMax}>/ {c.weight}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function barColorForLevel(level) {
  if (level === "showcase")
    return "linear-gradient(90deg, #f6d365 0%, #fda085 100%)";
  if (level === "polished")
    return "linear-gradient(90deg, #2ecc71 0%, #27ae60 100%)";
  if (level === "building")
    return "linear-gradient(90deg, #3498db 0%, #2980b9 100%)";
  return "linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.35) 100%)";
}

function badgeStyleFor(level) {
  if (level === "showcase") {
    return {
      background: "linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)",
      border: "1px solid rgba(217,119,6,0.55)",
      color: "#0c1410",
    };
  }
  if (level === "polished") {
    return {
      background: "rgba(46,204,113,0.18)",
      border: "1px solid rgba(46,204,113,0.55)",
      color: "#c8f7dc",
    };
  }
  if (level === "building") {
    return {
      background: "rgba(52,152,219,0.18)",
      border: "1px solid rgba(52,152,219,0.55)",
      color: "#cfe6f7",
    };
  }
  return {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.7)",
  };
}

const styles = {
  section: {
    margin: "0 0 16px",
    padding: "14px 16px 14px",
    borderRadius: 14,
    background: "rgba(22,22,22,0.94)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.32)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  headRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    justifyContent: "space-between",
  },
  headLeft: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
  },
  emoji: {
    fontSize: 20,
    lineHeight: 1,
    flexShrink: 0,
    marginTop: 2,
  },
  headBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 14,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: "-0.02em",
  },
  levelBadge: {
    fontSize: 10,
    fontWeight: 900,
    borderRadius: 999,
    padding: "2px 8px",
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
  },
  sub: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.4,
    wordBreak: "keep-all",
  },
  scoreWrap: {
    flexShrink: 0,
    minWidth: 56,
    textAlign: "right",
  },
  scoreNum: {
    fontSize: 22,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  barTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    transition: "width 0.4s ease",
  },
  summaryRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  summaryChip: {
    fontSize: 10,
    fontWeight: 800,
    color: "rgba(255,255,255,0.72)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 999,
    padding: "2px 8px",
    letterSpacing: "-0.01em",
  },
  suggList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  suggItem: { margin: 0, padding: 0 },
  suggBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(46,204,113,0.32)",
    background: "rgba(46,204,113,0.08)",
    color: "#d4f4dd",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    textAlign: "left",
    cursor: "default",
    WebkitTapHighlightColor: "transparent",
  },
  suggBtnClickable: {
    cursor: "pointer",
  },
  suggDot: {
    flexShrink: 0,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "rgba(46,204,113,0.22)",
    border: "1px solid rgba(46,204,113,0.55)",
    color: "#d4f4dd",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1,
  },
  suggText: {
    flex: 1,
    minWidth: 0,
    lineHeight: 1.4,
  },
  allDone: {
    fontSize: 12,
    fontWeight: 800,
    color: "#9ad3a4",
    background: "rgba(46,204,113,0.1)",
    border: "1px solid rgba(46,204,113,0.32)",
    borderRadius: 10,
    padding: "8px 10px",
  },
  details: {
    marginTop: 4,
  },
  summaryToggle: {
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: "-0.01em",
  },
  componentList: {
    listStyle: "none",
    margin: "8px 0 0",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  componentItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 8px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  componentLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.78)",
  },
  componentScore: {
    fontSize: 11,
    fontWeight: 800,
    color: "#fff",
  },
  componentMax: {
    fontSize: 10,
    fontWeight: 600,
    color: "rgba(255,255,255,0.45)",
  },
};
