import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { LEGAL } from "../../config/legal";
import {
  isAgeConfirmed,
  isAgeGatePublicPath,
  markAgeConfirmed,
} from "../../utils/ageGate";

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
  width: "100%",
};

function LegalLinks() {
  return (
    <div
      style={{
        marginTop: 8,
        display: "flex",
        gap: 16,
        justifyContent: "center",
        flexWrap: "wrap",
      }}
    >
      <Link
        to="/terms"
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.45)",
          textDecoration: "underline",
        }}
      >
        이용약관
      </Link>
      <Link
        to="/privacy"
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.45)",
          textDecoration: "underline",
        }}
      >
        개인정보 처리방침
      </Link>
    </div>
  );
}

function AgePrompt({ onConfirmAdult, onDecline }) {
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
        {LEGAL.serviceNameEn}
      </p>
      <h1 style={titleStyle}>만 19세 이상만 이용할 수 있어요</h1>
      <p style={bodyStyle}>
        {LEGAL.serviceName}는 술집·한잔 기록을 다루는 서비스입니다.
        <br />
        계속하려면 만 19세 이상이어야 합니다.
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "min(100%, 280px)",
        }}
      >
        <button
          type="button"
          style={{ ...btnBase, background: "#fff", color: "#111" }}
          onClick={onConfirmAdult}
        >
          만 19세 이상입니다
        </button>
        <button
          type="button"
          style={{
            ...btnBase,
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
          }}
          onClick={onDecline}
        >
          만 19세 미만입니다
        </button>
      </div>
      <LegalLinks />
    </div>
  );
}

function AgeBlocked({ onBack }) {
  return (
    <div style={shellStyle}>
      <h1 style={titleStyle}>서비스를 이용할 수 없어요</h1>
      <p style={bodyStyle}>
        주류 관련 장소 정보를 다루기 때문에
        <br />
        만 19세 미만에게는 열리지 않습니다.
      </p>
      <div style={{ width: "min(100%, 280px)" }}>
        <button
          type="button"
          style={{
            ...btnBase,
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
          }}
          onClick={onBack}
        >
          돌아가기
        </button>
      </div>
      <LegalLinks />
    </div>
  );
}

export default function AgeGate({ children }) {
  const location = useLocation();
  const [confirmed, setConfirmed] = useState(isAgeConfirmed);
  const [blocked, setBlocked] = useState(false);

  if (isAgeGatePublicPath(location.pathname) || confirmed) {
    return children;
  }

  if (blocked) {
    return <AgeBlocked onBack={() => setBlocked(false)} />;
  }

  return (
    <AgePrompt
      onConfirmAdult={() => {
        markAgeConfirmed();
        setConfirmed(true);
      }}
      onDecline={() => setBlocked(true)}
    />
  );
}
