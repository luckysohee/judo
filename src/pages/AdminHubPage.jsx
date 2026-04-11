import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { adminTopNavButtonStyle } from "../styles/adminTopNavButton";

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#111111",
    color: "#ffffff",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "#111111",
    padding: "16px",
    borderBottom: "1px solid #222222",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  title: {
    fontSize: "22px",
    fontWeight: 800,
    flex: 1,
    minWidth: "160px",
  },
  content: {
    padding: "20px 16px 40px",
    maxWidth: "560px",
    margin: "0 auto",
    boxSizing: "border-box",
  },
  lead: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.65)",
    lineHeight: 1.5,
    marginBottom: "20px",
  },
  card: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
    textAlign: "left",
    border: "1px solid #2a2a2a",
    backgroundColor: "#171717",
    borderRadius: "14px",
    padding: "16px 18px",
    marginBottom: "12px",
    cursor: "pointer",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, background 0.15s ease",
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: 800,
    marginBottom: "6px",
    color: "#fff",
  },
  cardDesc: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.45,
  },
  badge: {
    flexShrink: 0,
    minWidth: "28px",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: 800,
    textAlign: "center",
    lineHeight: 1.3,
  },
  badgeMuted: {
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.45)",
  },
  badgeWarn: {
    backgroundColor: "rgba(241, 196, 15, 0.22)",
    color: "#f1c40f",
    border: "1px solid rgba(241, 196, 15, 0.35)",
  },
  badgeOk: {
    backgroundColor: "rgba(46, 204, 113, 0.18)",
    color: "#2ECC71",
    border: "1px solid rgba(46, 204, 113, 0.3)",
  },
  note: {
    marginTop: "24px",
    padding: "12px 14px",
    borderRadius: "10px",
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    fontSize: "12px",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.5,
  },
};

export default function AdminHubPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    pendingApps: null,
    gradeQueue: null,
    curatorCount: null,
    loading: true,
  });

  useEffect(() => {
    if (authLoading || !user?.id) {
      if (!authLoading && !user?.id) {
        setStats((s) => ({ ...s, loading: false }));
      }
      return;
    }

    let cancelled = false;

    (async () => {
      setStats((s) => ({ ...s, loading: true }));

      const safeCount = async (promise) => {
        try {
          const { count, error } = await promise;
          if (error) return null;
          return typeof count === "number" ? count : null;
        } catch {
          return null;
        }
      };

      const [pendingApps, gradeQueue, curatorCount] = await Promise.all([
        safeCount(
          supabase
            .from("curator_applications")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending")
        ),
        safeCount(
          supabase
            .from("curator_grade_review_queue")
            .select("*", { count: "exact", head: true })
            .is("resolved_at", null)
        ),
        safeCount(
          supabase.from("curators").select("*", { count: "exact", head: true })
        ),
      ]);

      if (!cancelled) {
        setStats({
          pendingApps,
          gradeQueue,
          curatorCount,
          loading: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  const formatBadge = (n) => {
    if (stats.loading) return "…";
    if (n === null || n === undefined) return "—";
    return String(n);
  };

  const pendingDisplay = formatBadge(stats.pendingApps);
  const gradeDisplay = formatBadge(stats.gradeQueue);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={adminTopNavButtonStyle}
          aria-label="홈으로"
          title="홈으로"
        >
          ←
        </button>
        <div style={styles.title}>관리자</div>
      </header>

      <main style={styles.content}>
        <p style={styles.lead}>
          운영 메뉴로 이동합니다. 큐레이터별 상세 관리는 신청 목록의「상세보기」또는{" "}
          <code style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)" }}>
            {"/admin/curator/{userId}"}
          </code>
          로 열 수 있습니다.
        </p>

        <button
          type="button"
          style={styles.card}
          onClick={() => navigate("/admin/applications")}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = "rgba(46, 204, 113, 0.35)";
            e.currentTarget.style.backgroundColor = "#1a221c";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = "#2a2a2a";
            e.currentTarget.style.backgroundColor = "#171717";
          }}
        >
          <div style={styles.cardMain}>
            <div style={styles.cardTitle}>큐레이터 신청</div>
            <div style={styles.cardDesc}>
              승인·반려·앱 내 활동 확인, 승급 검토 알림
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
            <span
              style={{
                ...styles.badge,
                ...(typeof stats.pendingApps === "number" && stats.pendingApps > 0
                  ? styles.badgeWarn
                  : styles.badgeMuted),
              }}
              title="대기 중 신청"
            >
              대기 {pendingDisplay}
            </span>
            <span
              style={{
                ...styles.badge,
                ...(typeof stats.gradeQueue === "number" && stats.gradeQueue > 0
                  ? styles.badgeWarn
                  : styles.badgeMuted),
              }}
              title="승급 검토 큐(미해결)"
            >
              승급 {gradeDisplay}
            </span>
          </div>
        </button>

        <button
          type="button"
          style={{ ...styles.card, display: "block" }}
          onClick={() => navigate("/admin/search-insights")}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = "rgba(52, 152, 219, 0.35)";
            e.currentTarget.style.backgroundColor = "#1a2028";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = "#2a2a2a";
            e.currentTarget.style.backgroundColor = "#171717";
          }}
        >
          <div style={styles.cardTitle}>검색 인사이트</div>
          <div style={styles.cardDesc}>
            무결과 검색어·최근 검색 로그 (search_logs)
          </div>
        </button>

        <button
          type="button"
          style={styles.card}
          onClick={() => navigate("/admin/curators")}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = "rgba(241, 196, 15, 0.35)";
            e.currentTarget.style.backgroundColor = "#221c12";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = "#2a2a2a";
            e.currentTarget.style.backgroundColor = "#171717";
          }}
        >
          <div style={styles.cardMain}>
            <div style={styles.cardTitle}>큐레이터 목록 · 감사 로그</div>
            <div style={styles.cardDesc}>
              전체 큐레이터와 관리자 조작 기록 (admin_audit_log)
            </div>
          </div>
          <span
            style={{
              ...styles.badge,
              ...(typeof stats.curatorCount === "number" && stats.curatorCount > 0
                ? styles.badgeOk
                : styles.badgeMuted),
            }}
            title="등록 큐레이터 수"
          >
            {formatBadge(stats.curatorCount)}
          </span>
        </button>

        <p style={styles.note}>
          이 페이지들은 로그인한 관리자 계정만 접근할 수 있습니다. 숫자는 허브에 들어올 때
          한 번 불러오며, 최신 값은 각 메뉴에서 확인하세요.
        </p>
      </main>
    </div>
  );
}
