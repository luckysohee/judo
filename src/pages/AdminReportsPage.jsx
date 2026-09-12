import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminTopNavButtonStyle } from "../styles/adminTopNavButton";
import {
  hideReportedContent,
  listContentReports,
  resolveContentReport,
} from "../api/contentReports";
import { REPORT_REASONS } from "../api/contentReports";

const reasonLabel = (id) =>
  REPORT_REASONS.find((r) => r.id === id)?.label || id;

export default function AdminReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listContentReports({ status, limit: 80 });
      setRows(data);
    } catch (e) {
      setError(e?.message || "목록을 불러오지 못했어요.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = async (row, nextStatus, hide) => {
    if (!user?.id) return;
    setBusyId(row.id);
    try {
      if (hide) {
        await hideReportedContent({
          targetType: row.target_type,
          targetId: row.target_id,
        });
      }
      await resolveContentReport({
        reportId: row.id,
        adminId: user.id,
        status: nextStatus,
        adminNote: hide ? "콘텐츠 비공개/보관 처리" : undefined,
      });
      await reload();
    } catch (e) {
      setError(e?.message || "처리에 실패했어요.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button
          type="button"
          onClick={() => navigate("/admin")}
          style={adminTopNavButtonStyle}
          aria-label="관리자 홈"
        >
          ←
        </button>
        <div style={styles.title}>UGC 신고</div>
      </header>

      <main style={styles.content}>
        <p style={styles.lead}>
          App Store 1.2 — 이용자 신고를 검토하고 콘텐츠 삭제·비공개 또는 기각합니다.
          목표는 접수 후 24시간 이내 1차 대응입니다.
        </p>

        <div style={styles.tabs}>
          {["pending", "actioned", "dismissed", "all"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              style={{
                ...styles.tab,
                ...(status === s ? styles.tabActive : null),
              }}
            >
              {s === "pending"
                ? "대기"
                : s === "actioned"
                  ? "조치"
                  : s === "dismissed"
                    ? "기각"
                    : "전체"}
            </button>
          ))}
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}
        {loading ? (
          <p style={styles.muted}>불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p style={styles.muted}>신고가 없어요.</p>
        ) : (
          rows.map((row) => (
            <article key={row.id} style={styles.card}>
              <div style={styles.meta}>
                <strong style={{ color: "#fff" }}>
                  {row.target_type} · {reasonLabel(row.reason)}
                </strong>
                <span style={styles.badge}>{row.status}</span>
              </div>
              <p style={styles.line}>
                target: <code>{row.target_id}</code>
              </p>
              {row.target_owner_id ? (
                <p style={styles.line}>
                  owner: <code>{row.target_owner_id}</code>
                </p>
              ) : null}
              {row.detail ? (
                <p style={{ ...styles.line, color: "rgba(255,255,255,0.75)" }}>
                  {row.detail}
                </p>
              ) : null}
              <p style={styles.line}>
                {new Date(row.created_at).toLocaleString("ko-KR")}
              </p>
              {row.status === "pending" ? (
                <div style={styles.actions}>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    style={styles.actionPrimary}
                    onClick={() => void act(row, "actioned", true)}
                  >
                    숨김·조치
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    style={styles.actionGhost}
                    onClick={() => void act(row, "dismissed", false)}
                  >
                    기각
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </main>
    </div>
  );
}

const styles = {
  page: {
    height: "100dvh",
    overflowY: "auto",
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
  },
  title: { fontSize: 22, fontWeight: 800, flex: 1 },
  content: { padding: "20px 16px 40px", maxWidth: 560, margin: "0 auto" },
  lead: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 1.5,
    marginBottom: 16,
  },
  tabs: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  tab: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid #333",
    background: "#1a1a1a",
    color: "rgba(255,255,255,0.7)",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  tabActive: {
    borderColor: "rgba(124,255,107,0.45)",
    background: "rgba(124,255,107,0.12)",
    color: "#7CFF6B",
  },
  muted: { color: "rgba(255,255,255,0.45)", fontSize: 14 },
  error: { color: "#f87171", fontSize: 13, marginBottom: 12 },
  card: {
    border: "1px solid #2a2a2a",
    background: "#171717",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  meta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    fontSize: 11,
    fontWeight: 800,
    color: "#f1c40f",
    textTransform: "uppercase",
  },
  line: {
    margin: "0 0 4px",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    wordBreak: "break-all",
  },
  actions: { display: "flex", gap: 8, marginTop: 12 },
  actionPrimary: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    border: "none",
    background: "#7CFF6B",
    color: "#111",
    fontWeight: 800,
    cursor: "pointer",
  },
  actionGhost: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    border: "1px solid #444",
    background: "transparent",
    color: "rgba(255,255,255,0.75)",
    fontWeight: 700,
    cursor: "pointer",
  },
};
