import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  ACCOUNT_DELETE_TYPE_WORD,
  isAccountDeleteTyped,
  requestAccountDeletion,
} from "../api/deleteAccount";
import { useAuth } from "../context/AuthContext";
import { LEGAL } from "../config/legal";

const styles = {
  page: {
    minHeight: "100dvh",
    backgroundColor: "#0e0e0e",
    color: "#e8e8e8",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "rgba(14, 14, 14, 0.92)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid #222",
    padding:
      "max(12px, env(safe-area-inset-top, 0px)) 16px 12px max(16px, env(safe-area-inset-left, 0px))",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    border: "1px solid #333",
    background: "#1a1a1a",
    color: "#fff",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  main: {
    maxWidth: 520,
    margin: "0 auto",
    padding:
      "20px 16px max(32px, env(safe-area-inset-bottom, 0px))",
    boxSizing: "border-box",
  },
  card: {
    padding: "14px 16px",
    borderRadius: 12,
    background: "#171717",
    border: "1px solid #2a2a2a",
    marginBottom: 16,
  },
  h2: {
    margin: "0 0 8px",
    fontSize: 15,
    fontWeight: 800,
  },
  p: {
    margin: "0 0 8px",
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.78)",
  },
  muted: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.5,
  },
  link: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    textDecoration: "underline",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: 8,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #333",
    background: "#111",
    color: "#fff",
    fontSize: 15,
  },
  dangerBtn: {
    width: "100%",
    marginTop: 12,
    minHeight: 46,
    border: "none",
    borderRadius: 12,
    background: "#b42318",
    color: "#fff",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  },
};

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [typed, setTyped] = useState("");
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const email = user?.email || "";
  const canSubmit = Boolean(user) && acked && isAccountDeleteTyped(typed) && !busy;

  const handleDelete = async () => {
    if (!canSubmit) return;
    const ok = window.confirm(
      "계정을 삭제하면 로그인·저장·한잔·픽 기록이 지워지고 되돌릴 수 없습니다. 계속할까요?"
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    const result = await requestAccountDeletion();
    if (!result.ok) {
      setBusy(false);
      setError(result.error || "계정 삭제에 실패했습니다.");
      return;
    }
    try {
      await signOut();
    } catch {
      /* 세션이 이미 사라졌을 수 있음 */
    }
    navigate("/", { replace: true });
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button
          type="button"
          style={styles.backBtn}
          onClick={() => navigate(-1)}
          aria-label="뒤로"
        >
          ← 뒤로
        </button>
        <h1 style={styles.title}>계정</h1>
      </header>

      <main style={styles.main}>
        <section style={styles.card}>
          <h2 style={styles.h2}>로그인</h2>
          {loading ? (
            <p style={styles.p}>확인 중…</p>
          ) : user ? (
            <p style={styles.p}>{email || "소셜 로그인 계정"}</p>
          ) : (
            <p style={styles.p}>로그인하면 계정 삭제와 약관을 확인할 수 있습니다.</p>
          )}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            <Link to="/terms" style={styles.link}>
              이용약관
            </Link>
            <Link to="/privacy" style={styles.link}>
              개인정보 처리방침
            </Link>
          </div>
        </section>

        {user ? (
          <section style={{ ...styles.card, borderColor: "rgba(180,35,24,0.45)" }}>
            <h2 style={styles.h2}>계정 삭제</h2>
            <p style={styles.p}>
              탈퇴하면 계정, 프로필, 저장·픽·한잔·취향 설문이 삭제됩니다. 큐레이터로
              공개한 장소·코스·맛집첩도 함께 삭제될 수 있습니다.
            </p>
            <p style={styles.muted}>
              문의: {LEGAL.contactEmail}
            </p>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginTop: 12,
                fontSize: 13,
                color: "rgba(255,255,255,0.78)",
                lineHeight: 1.45,
              }}
            >
              <input
                type="checkbox"
                checked={acked}
                onChange={(e) => setAcked(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              삭제 후 복구할 수 없음을 이해했습니다.
            </label>
            <label style={{ display: "block", marginTop: 12, fontSize: 13 }}>
              확인을 위해 「{ACCOUNT_DELETE_TYPE_WORD}」를 입력하세요.
              <input
                style={styles.input}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                placeholder={ACCOUNT_DELETE_TYPE_WORD}
              />
            </label>
            {error ? (
              <p style={{ ...styles.p, color: "#f97066", marginTop: 10 }}>{error}</p>
            ) : null}
            <button
              type="button"
              style={{
                ...styles.dangerBtn,
                opacity: canSubmit ? 1 : 0.45,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
              disabled={!canSubmit}
              onClick={() => void handleDelete()}
            >
              {busy ? "삭제 중…" : "계정 영구 삭제"}
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
