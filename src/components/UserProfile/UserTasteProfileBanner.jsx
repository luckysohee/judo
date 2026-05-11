import { useEffect, useState } from "react";
import { fetchUserTasteProfile } from "../../api/userTasteProfile";

/**
 * 프로필 상단의 "취향 요약" 배너.
 *
 * - `fetchUserTasteProfile` 결과로 한 줄 요약(`"야장 · 노포 · 을지로 러버"`)과
 *   tag · 분위기(step_label) · 지역 chip 그룹을 노출.
 * - 시그널 자체가 0건이면 자체적으로 `null` 렌더 → 빈 배너 noise 방지.
 * - 비로그인 사용자도 공개 프로필을 볼 때 함께 노출(공개 컬렉션·공개 좋아요·공개 저장만 RLS 통과).
 * - 본인 프로필일 때만 "내 취향이 자동 반영되고 있어요" 보조 copy 추가.
 *
 * @param {{ targetUserId: string, isSelf?: boolean, style?: object }} props
 */
export default function UserTasteProfileBanner({
  targetUserId,
  isSelf = false,
  style,
}) {
  const [taste, setTaste] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetUserId) {
      setTaste(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await fetchUserTasteProfile(targetUserId);
        if (!cancelled) setTaste(result);
      } catch (e) {
        if (import.meta?.env?.DEV) {
          console.warn("UserTasteProfileBanner:", e?.message || e);
        }
        if (!cancelled) setTaste(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  if (loading) {
    return (
      <section style={{ ...styles.section, ...(style || null) }}>
        <div style={styles.loadingChip}>취향 분석 중…</div>
      </section>
    );
  }
  if (!taste || !taste.has_signal) return null;

  const showSummary = Boolean(taste.summary);
  const tags = Array.isArray(taste.top_tags) ? taste.top_tags : [];
  const steps = Array.isArray(taste.top_step_labels)
    ? taste.top_step_labels
    : [];
  const regions = Array.isArray(taste.top_regions) ? taste.top_regions : [];

  return (
    <section
      style={{ ...styles.section, ...(style || null) }}
      aria-label="취향 요약"
    >
      <div style={styles.headRow}>
        <span aria-hidden="true" style={styles.headEmoji}>
          🍶
        </span>
        <div style={styles.headBody}>
          {showSummary ? (
            <div style={styles.summary}>{taste.summary}</div>
          ) : (
            <div style={styles.summaryMuted}>이 사람의 술 취향</div>
          )}
          {isSelf ? (
            <div style={styles.selfNote}>
              내 컬렉션·저장·좋아요로 자동 반영되고 있어요
            </div>
          ) : (
            <div style={styles.subNote}>
              공개 컬렉션·저장·좋아요 기준 — 공개된 행동만 집계돼요
            </div>
          )}
        </div>
      </div>

      {tags.length > 0 ? (
        <div style={styles.chipRow} aria-label="자주 저장하는 태그">
          {tags.map((t) => (
            <span
              key={`tag-${t.raw.toLowerCase()}`}
              style={styles.tagChip}
              title={`태그 · ${t.count}회`}
            >
              #{t.raw}
            </span>
          ))}
        </div>
      ) : null}

      {regions.length > 0 ? (
        <div style={styles.chipRow} aria-label="자주 가는 지역">
          {regions.map((r) => (
            <span
              key={`region-${r.raw.toLowerCase()}`}
              style={styles.regionChip}
              title={`지역 · ${r.count}회`}
            >
              <span aria-hidden="true" style={styles.regionPin}>
                📍
              </span>
              {r.raw}
            </span>
          ))}
        </div>
      ) : null}

      {steps.length > 0 ? (
        <div style={styles.chipRow} aria-label="자주 쓰는 코스 흐름">
          {steps.map((s) => (
            <span
              key={`step-${s.raw.toLowerCase()}`}
              style={styles.stepChip}
              title={`코스 흐름 · ${s.count}회`}
            >
              {s.raw}
            </span>
          ))}
        </div>
      ) : null}

      <div style={styles.footnote}>
        ※ 컬렉션 공개 범위·태그·코스 흐름이 바뀌면 취향 요약도 자연스럽게 갱신돼요
      </div>
    </section>
  );
}

const styles = {
  section: {
    width: "100%",
    margin: "16px 0 4px",
    padding: "14px 16px 14px",
    borderRadius: 16,
    background:
      "linear-gradient(160deg, rgba(155,89,182,0.18), rgba(52,152,219,0.12))",
    border: "1px solid rgba(155,89,182,0.36)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.32)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  loadingChip: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: "-0.01em",
  },
  headRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },
  headEmoji: {
    fontSize: 22,
    lineHeight: 1,
    flexShrink: 0,
    marginTop: 2,
  },
  headBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  summary: {
    fontSize: 16,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: "-0.02em",
    lineHeight: 1.3,
    wordBreak: "keep-all",
  },
  summaryMuted: {
    fontSize: 14,
    fontWeight: 800,
    color: "rgba(255,255,255,0.78)",
    letterSpacing: "-0.02em",
  },
  selfNote: {
    fontSize: 11,
    fontWeight: 700,
    color: "#cfe6f7",
    lineHeight: 1.4,
    letterSpacing: "-0.01em",
  },
  subNote: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.4,
    letterSpacing: "-0.01em",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    fontSize: 11,
    fontWeight: 800,
    color: "#d4f4dd",
    background: "rgba(46,204,113,0.14)",
    border: "1px solid rgba(46,204,113,0.42)",
    borderRadius: 999,
    padding: "3px 10px",
    letterSpacing: "-0.01em",
    maxWidth: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  regionChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    fontWeight: 800,
    color: "#fde68a",
    background: "rgba(251,191,36,0.14)",
    border: "1px solid rgba(251,191,36,0.42)",
    borderRadius: 999,
    padding: "3px 10px",
    letterSpacing: "-0.01em",
    maxWidth: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  regionPin: {
    fontSize: 10,
    lineHeight: 1,
  },
  stepChip: {
    fontSize: 11,
    fontWeight: 800,
    color: "#ead9ff",
    background: "rgba(155,89,182,0.18)",
    border: "1px solid rgba(155,89,182,0.5)",
    borderRadius: 6,
    padding: "2px 8px",
    letterSpacing: "-0.01em",
    maxWidth: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  footnote: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: 600,
    color: "rgba(255,255,255,0.42)",
    lineHeight: 1.4,
    letterSpacing: "-0.01em",
  },
};
