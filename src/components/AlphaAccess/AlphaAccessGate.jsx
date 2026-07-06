import { Link, useLocation } from "react-router-dom";

import { ALPHA_GATE_PUBLIC_PATHS } from "../../config/alphaAccess";
import { useAlphaAccess } from "../../hooks/useAlphaAccess";
import { LEGAL } from "../../config/legal";

const shellStyle = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px 20px 48px",
  background: "#0e0e0e",
  color: "#fff",
  textAlign: "center",
  gap: 16,
};

const titleStyle = {
  margin: 0,
  fontSize: "clamp(22px, 5vw, 28px)",
  fontWeight: 800,
  letterSpacing: "-0.04em",
};

const bodyStyle = {
  margin: 0,
  maxWidth: 340,
  fontSize: 15,
  lineHeight: 1.55,
  color: "rgba(255,255,255,0.72)",
};

const btnBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  padding: "0 20px",
  borderRadius: 12,
  border: "none",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};

function GateLoading() {
  return (
    <div style={shellStyle}>
      <p style={{ ...bodyStyle, color: "rgba(255,255,255,0.5)" }}>확인 중…</p>
    </div>
  );
}

function AlphaAccessWall({ mode, email, onGoogleLogin, onKakaoLogin, onSignOut }) {
  const isLogin = mode === "login";

  return (
    <div style={shellStyle}>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#7CFF6B",
        }}
      >
        {LEGAL.serviceNameEn} Alpha
      </p>
      <h1 style={titleStyle}>
        {isLogin ? "비공개 알파 테스트" : "초대된 계정만 이용 가능"}
      </h1>
      <p style={bodyStyle}>
        {isLogin ? (
          <>
            지인 초대로 진행 중인 클로즈드 알파입니다.
            <br />
            Google 또는 Kakao로 로그인해 주세요.
          </>
        ) : (
          <>
            <strong style={{ color: "#fff", fontWeight: 700 }}>{email}</strong>
            은(는) 알파 접근 목록에 없습니다.
            <br />
            링크·스크린샷 공유는 약관상 금지됩니다.
          </>
        )}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "min(100%, 280px)" }}>
        {isLogin ? (
          <>
            <button
              type="button"
              style={{ ...btnBase, background: "#fff", color: "#111" }}
              onClick={() => onGoogleLogin?.()}
            >
              Google로 계속
            </button>
            <button
              type="button"
              style={{
                ...btnBase,
                background: "#FEE500",
                color: "#191919",
              }}
              onClick={() => onKakaoLogin?.()}
            >
              Kakao로 계속
            </button>
          </>
        ) : (
          <button
            type="button"
            style={{ ...btnBase, background: "rgba(255,255,255,0.12)", color: "#fff" }}
            onClick={() => onSignOut?.()}
          >
            다른 계정으로 로그인
          </button>
        )}
      </div>
      <Link
        to="/terms"
        style={{
          marginTop: 8,
          fontSize: 13,
          color: "rgba(255,255,255,0.45)",
          textDecoration: "underline",
        }}
      >
        이용약관
      </Link>
    </div>
  );
}

function isPublicAlphaPath(pathname) {
  return ALPHA_GATE_PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export default function AlphaAccessGate({ children }) {
  const location = useLocation();
  const access = useAlphaAccess();

  if (!access.enabled || isPublicAlphaPath(location.pathname)) {
    return children;
  }

  if (access.authLoading || (access.user && access.checking)) {
    return <GateLoading />;
  }

  if (!access.user) {
    return (
      <AlphaAccessWall
        mode="login"
        onGoogleLogin={() => access.signInWithProvider("google")}
        onKakaoLogin={() => access.signInWithProvider("kakao")}
      />
    );
  }

  if (!access.allowed) {
    return (
      <AlphaAccessWall
        mode="denied"
        email={access.user.email}
        onSignOut={() => access.signOut()}
      />
    );
  }

  return children;
}
