import { Link } from "react-router-dom";
import BlockedUsersPanel from "../components/Safety/BlockedUsersPanel";
import { LEGAL } from "../config/legal";

/**
 * 안전 · 신고/차단 안내 + 차단 목록.
 */
export default function SafetySettingsPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0e0e0e",
        color: "#fff",
        padding: "24px 18px calc(32px + env(safe-area-inset-bottom))",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <Link
          to="/"
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          ← 홈
        </Link>
        <h1
          style={{
            margin: "16px 0 8px",
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          안전 · 신고
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 14,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          코스·장소·프로필에서 <strong style={{ color: "#fff" }}>⋯</strong> 메뉴로
          신고하거나 사용자를 차단할 수 있습니다. 운영팀은 신고를 보통 24시간
          이내에 검토합니다. 문의:{" "}
          <a
            href={`mailto:${LEGAL.contactEmail}`}
            style={{ color: "#7CFF6B" }}
          >
            {LEGAL.contactEmail}
          </a>
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 13 }}>
          <Link to="/terms" style={{ color: "rgba(255,255,255,0.75)" }}>
            이용약관
          </Link>
        </p>
        <BlockedUsersPanel
          style={{
            marginTop: 8,
            padding: 16,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "#161616",
          }}
        />
      </div>
    </div>
  );
}
