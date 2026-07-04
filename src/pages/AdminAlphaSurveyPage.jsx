import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminTopNavButtonStyle } from "../styles/adminTopNavButton";
import {
  fetchAllAlphaSurveyResponsesForAdmin,
  fetchAlphaSurveyUserLabels,
  isAlphaSurveySubmitted,
} from "../api/alphaSurvey";
import {
  ALPHA_SURVEY_VERSION,
  formatAlphaSurveyAnswersForDisplay,
} from "../config/alphaSurvey";

const styles = {
  page: {
    height: "100dvh",
    maxHeight: "100dvh",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    overscrollBehaviorY: "contain",
    boxSizing: "border-box",
    backgroundColor: "#111",
    color: "#fff",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "#111",
    padding: 16,
    borderBottom: "1px solid #222",
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  title: { fontSize: 20, fontWeight: 800, flex: 1 },
  content: {
    padding: "16px 16px 40px",
    maxWidth: 920,
    margin: "0 auto",
    boxSizing: "border-box",
  },
  lead: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.5,
    marginBottom: 16,
  },
  statsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: "1 1 140px",
    minWidth: 120,
    padding: "12px 14px",
    borderRadius: 12,
    background: "#171717",
    border: "1px solid #2a2a2a",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 4,
  },
  statValue: { fontSize: 22, fontWeight: 800 },
  card: {
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    background: "#171717",
    marginBottom: 12,
    overflow: "hidden",
  },
  cardHead: {
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "transparent",
    color: "#fff",
    padding: "14px 16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  cardBody: {
    padding: "0 16px 14px",
    borderTop: "1px solid #252525",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(88px, 28%) 1fr",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontSize: 12,
    lineHeight: 1.45,
  },
  q: { color: "rgba(255,255,255,0.5)", fontWeight: 600 },
  a: { color: "rgba(255,255,255,0.92)", wordBreak: "break-word" },
  empty: {
    padding: 24,
    textAlign: "center",
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
  },
};

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function userLabel(userId, labels) {
  const meta = labels.get(userId);
  const name = String(meta?.display_name || "").trim();
  const handle = String(meta?.username || "").trim();
  if (name && handle) return `${name} (@${handle})`;
  if (name) return name;
  if (handle) return `@${handle}`;
  return userId.slice(0, 8);
}

export default function AdminAlphaSurveyPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [labels, setLabels] = useState(new Map());
  const [expandedId, setExpandedId] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllAlphaSurveyResponsesForAdmin();
      setRows(data);
      const labelMap = await fetchAlphaSurveyUserLabels(
        data.map((r) => r.user_id)
      );
      setLabels(labelMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = useMemo(() => {
    const submittedRows = rows.filter((r) => isAlphaSurveySubmitted(r));
    const draftRows = rows.filter((r) => !isAlphaSurveySubmitted(r));
    const scores = submittedRows
      .map((r) => Number(r.answers?.satisfaction))
      .filter((n) => Number.isFinite(n));
    const avg =
      scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : "—";
    const npsScores = submittedRows
      .map((r) => Number(r.answers?.recommend_score))
      .filter((n) => Number.isFinite(n));
    const npsAvg =
      npsScores.length > 0
        ? (npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1)
        : "—";
    return {
      count: rows.length,
      submittedCount: submittedRows.length,
      draftCount: draftRows.length,
      avg,
      npsAvg,
    };
  }, [rows]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button
          type="button"
          style={adminTopNavButtonStyle}
          onClick={() => navigate("/admin")}
        >
          ← 허브
        </button>
        <h1 style={styles.title}>알파 피드백 설문</h1>
        <button
          type="button"
          style={adminTopNavButtonStyle}
          onClick={() => void reload()}
          disabled={loading}
        >
          새로고침
        </button>
      </header>

      <main style={styles.content}>
        <p style={styles.lead}>
          홈 「피드백」 칩 설문입니다. 입력 중에도 자동 임시저장되어 「작성 중」으로
          보이고, 사용자가 「제출하기」를 누르면 「제출 완료」로 표시됩니다. (버전{" "}
          {ALPHA_SURVEY_VERSION})
        </p>

        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>전체 (임시+제출)</div>
            <div style={styles.statValue}>{stats.count}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>제출 완료</div>
            <div style={styles.statValue}>{stats.submittedCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>작성 중</div>
            <div style={styles.statValue}>{stats.draftCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>평균 만족도 (제출만)</div>
            <div style={styles.statValue}>{stats.avg}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>평균 추천 의향 (제출만)</div>
            <div style={styles.statValue}>{stats.npsAvg}</div>
          </div>
        </div>

        {loading ? (
          <div style={styles.empty}>불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div style={styles.empty}>아직 저장된 피드백이 없습니다.</div>
        ) : (
          rows.map((row) => {
            const open = expandedId === row.id;
            const submitted = isAlphaSurveySubmitted(row);
            const displayRows = formatAlphaSurveyAnswersForDisplay(row.answers);
            return (
              <div key={row.id} style={styles.card}>
                <button
                  type="button"
                  style={styles.cardHead}
                  onClick={() => setExpandedId(open ? null : row.id)}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>
                    {open ? "▾" : "▸"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: 14 }}>
                        {userLabel(row.user_id, labels)}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: submitted
                            ? "rgba(46, 204, 113, 0.18)"
                            : "rgba(241, 196, 15, 0.18)",
                          color: submitted ? "#2ECC71" : "#f1c40f",
                          border: submitted
                            ? "1px solid rgba(46, 204, 113, 0.35)"
                            : "1px solid rgba(241, 196, 15, 0.35)",
                        }}
                      >
                        {submitted ? "제출 완료" : "작성 중"}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.45)",
                        marginTop: 2,
                      }}
                    >
                      수정 {formatWhen(row.updated_at)}
                      {submitted && row.submitted_at
                        ? ` · 제출 ${formatWhen(row.submitted_at)}`
                        : ""}
                    </div>
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#fbbf24",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ★ {row.answers?.satisfaction ?? "—"}
                  </span>
                </button>
                {open ? (
                  <div style={styles.cardBody}>
                    {displayRows.map((item) => (
                      <div key={item.questionId} style={styles.row}>
                        <div style={styles.q}>{item.label}</div>
                        <div style={styles.a}>{item.value}</div>
                      </div>
                    ))}
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 10,
                        color: "rgba(255,255,255,0.35)",
                        fontFamily: "monospace",
                      }}
                    >
                      user_id: {row.user_id}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
