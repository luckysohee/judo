import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import DropIcon from "./DropIcon.jsx";
import { formatDropEarnToast } from "../../utils/userWalletFormat.js";
import {
  clearDropEarnToast,
  subscribeDropEarnToast,
} from "./showDropEarnToast.js";
import { TOAST_LAYER_Z_INDEX } from "../../constants/toastLayer.js";

const AUTO_HIDE_MS = 2200;

/**
 * Drop 적립 전용 토스트 (일반 유저 · 홈 등 상단 1곳에 마운트)
 */
export default function DropEarnToastHost() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let hideTimer = null;
    const unsub = subscribeDropEarnToast((payload) => {
      if (hideTimer) clearTimeout(hideTimer);
      if (!payload?.amount) {
        setToast(null);
        return;
      }
      setToast(payload);
      hideTimer = setTimeout(() => setToast(null), AUTO_HIDE_MS);
    });
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      unsub();
    };
  }, []);

  useEffect(() => () => clearDropEarnToast(), []);

  if (!toast || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={toast ? "judoDropEarnToast judoDropEarnToast--in" : ""}
      style={{
        position: "fixed",
        top: "calc(16px + env(safe-area-inset-top, 0px))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: TOAST_LAYER_Z_INDEX + 12,
        pointerEvents: "none",
      }}
    >
      <style>{DROP_EARN_TOAST_CSS}</style>
      <div style={shell}>
        <div style={iconWrap} aria-hidden>
          <DropIcon size={22} />
        </div>
        <div style={textCol}>
          <div style={amountLine}>{formatDropEarnToast(toast.amount)}</div>
          {toast.subtitle ? (
            <div style={subLine}>{toast.subtitle}</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

const shell = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 18px 12px 14px",
  borderRadius: "16px",
  background:
    "linear-gradient(145deg, rgba(28,22,12,0.94) 0%, rgba(12,10,8,0.92) 100%)",
  border: "1px solid rgba(245,166,35,0.42)",
  boxShadow:
    "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 24px rgba(245,166,35,0.18)",
  backdropFilter: "blur(16px) saturate(160%)",
  WebkitBackdropFilter: "blur(16px) saturate(160%)",
  minWidth: "168px",
};

const iconWrap = {
  animation: "judoDropEarnFall 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
};

const textCol = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const amountLine = {
  fontSize: "16px",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  color: "#FFE8A3",
  lineHeight: 1.2,
};

const subLine = {
  fontSize: "11px",
  fontWeight: 600,
  color: "rgba(255,255,255,0.52)",
  lineHeight: 1.3,
};

const DROP_EARN_TOAST_CSS = `
@keyframes judoDropEarnFall {
  0% { opacity: 0; transform: translateY(-14px) scale(0.82); }
  55% { opacity: 1; transform: translateY(2px) scale(1.06); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.judoDropEarnToast--in {
  animation: judoDropEarnShell 0.35s ease-out;
}
@keyframes judoDropEarnShell {
  from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
`;
