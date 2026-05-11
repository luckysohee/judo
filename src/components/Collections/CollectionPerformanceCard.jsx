import { useEffect, useState } from "react";
import { fetchCollectionPerformance } from "../../api/collectionPerformance";

const RECENT_WINDOW_DAYS = 7;
const CLICK_WINDOW_DAYS = 30;

/**
 * 공개 컬렉션 성과 요약 카드.
 *
 * - `❤️ 좋아요`, `📁 저장`, `👀 클릭(30일)`, `📈 최근 7일 저장 증가` 4 타일.
 * - 클릭 집계가 RLS/테이블 부재로 실패하면 해당 타일만 숨기고 패널은 살아남음.
 * - 숫자가 0 이어도 lightweight wording 으로 비어 보이지 않게 한다.
 *
 * @param {{ collectionId: string }} props
 */
export default function CollectionPerformanceCard({ collectionId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const id = String(collectionId ?? "").trim();
    if (!id) {
      setStats(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    (async () => {
      try {
        const next = await fetchCollectionPerformance(id);
        if (!cancelled) setStats(next);
      } catch (e) {
        if (import.meta?.env?.DEV) {
          console.warn("CollectionPerformanceCard:", e);
        }
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  if (loading) {
    return (
      <div style={styles.wrap} aria-live="polite">
        <div style={styles.title}>코스 성과</div>
        <div style={styles.helper}>집계하는 중…</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={styles.wrap}>
        <div style={styles.title}>코스 성과</div>
        <div style={styles.helper}>지금은 집계를 가져오지 못했어요.</div>
      </div>
    );
  }

  const headline = buildHeadline(stats);
  const showClick = typeof stats.click_count === "number";

  return (
    <div style={styles.wrap}>
      <div style={styles.titleRow}>
        <div style={styles.title}>코스 성과</div>
        <div style={styles.windowNote}>
          최근 {RECENT_WINDOW_DAYS}·{CLICK_WINDOW_DAYS}일 기준
        </div>
      </div>

      <div style={styles.tiles}>
        <Tile emoji="❤️" label="좋아요" value={stats.like_count} />
        <Tile emoji="📁" label="저장" value={stats.save_count} />
        {showClick ? (
          <Tile
            emoji="👀"
            label={`클릭 (${CLICK_WINDOW_DAYS}d)`}
            value={stats.click_count}
          />
        ) : null}
        <Tile
          emoji="📈"
          label={`+저장 (${RECENT_WINDOW_DAYS}d)`}
          value={stats.recent_save_count}
        />
      </div>

      <div style={styles.headline}>{headline}</div>
    </div>
  );
}

function Tile({ emoji, label, value }) {
  return (
    <div style={styles.tile}>
      <div style={styles.tileTop}>
        <span style={styles.tileEmoji} aria-hidden="true">
          {emoji}
        </span>
        <span style={styles.tileValue}>{Number(value) || 0}</span>
      </div>
      <div style={styles.tileLabel}>{label}</div>
    </div>
  );
}

/**
 * 우선순위:
 *  1) 최근 저장 증가 → "저장하고 있어요"
 *  2) 최근 클릭 증가 → "보는 사람들이 늘고 있어요"
 *  3) 누적 반응 존재 → "반응이 쌓이고 있어요"
 *  4) 모두 0       → "이제 막 공개됐어요. 사람들이 발견하면 알려드릴게요."
 */
function buildHeadline(stats) {
  const recentSave = Number(stats?.recent_save_count) || 0;
  const recentClick = Number(stats?.recent_click_count) || 0;
  const totalSocial =
    (Number(stats?.like_count) || 0) +
    (Number(stats?.save_count) || 0) +
    (Number(stats?.click_count) || 0);

  if (recentSave > 0) {
    return `최근 ${RECENT_WINDOW_DAYS}일 동안 ${recentSave}명이 이 코스를 저장하고 있어요.`;
  }
  if (recentClick > 0) {
    return `최근 ${RECENT_WINDOW_DAYS}일 동안 이 코스를 본 사람들이 늘고 있어요 (+${recentClick}).`;
  }
  if (totalSocial > 0) {
    return "이 코스에 반응이 쌓이고 있어요.";
  }
  return "이제 막 공개됐어요. 사람들이 발견하면 알려드릴게요.";
}

const styles = {
  wrap: {
    margin: "10px 0 0",
    padding: "12px 14px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  titleRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.02em",
  },
  windowNote: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.45)",
  },
  tiles: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
    gap: 8,
  },
  tile: {
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(0,0,0,0.22)",
    borderRadius: 10,
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  tileTop: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  tileEmoji: {
    fontSize: 14,
    lineHeight: 1,
  },
  tileValue: {
    fontSize: 18,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: "-0.02em",
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.6)",
  },
  headline: {
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.45,
    color: "#d4f4dd",
    background: "rgba(46,204,113,0.1)",
    border: "1px solid rgba(46,204,113,0.32)",
    borderRadius: 10,
    padding: "8px 10px",
    wordBreak: "keep-all",
  },
  helper: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.55)",
  },
};
