import { createPortal } from "react-dom";
import DropIcon from "./DropIcon.jsx";
import AiCreditIcon from "./AiCreditIcon.jsx";
import {
  AI_CREDIT_UNIT_LABEL,
  DROP_UNIT_LABEL,
  DROPS_PER_AI_CREDIT,
} from "../../constants/dropEconomy.js";
import {
  dropProgressToNextCredit,
  formatAiCreditBalance,
  formatDropBalance,
} from "../../utils/userWalletFormat.js";
import { showDropEarnToast } from "./showDropEarnToast.js";

const SHEET_Z = 27500;

/**
 * @param {{
 *   open?: boolean,
 *   onClose?: () => void,
 *   wallet?: import("../../api/userWallet.js").UserWallet,
 *   onExchange?: () => void | Promise<void>,
 *   onPreviewEarn?: (amount: number) => void,
 *   exchanging?: boolean,
 * }} props
 */
export default function UserWalletSheet({
  open = false,
  onClose,
  wallet,
  onExchange,
  onPreviewEarn,
  exchanging = false,
}) {
  if (!open || typeof document === "undefined") return null;

  const w = wallet || {
    drops: 0,
    aiCredits: 0,
    dropsPerAiCredit: DROPS_PER_AI_CREDIT,
  };
  const progress = dropProgressToNextCredit(w.drops, w.dropsPerAiCredit);
  const canExchange = w.drops >= w.dropsPerAiCredit;

  return createPortal(
    <div style={backdrop} onClick={onClose} role="presentation">
      <div
        style={sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="user-wallet-title"
      >
        <div style={handle} aria-hidden />
        <h2 id="user-wallet-title" style={title}>
          Drop · AI Credit
        </h2>
        <p style={hint}>
          체크인·저장·가벼운 리뷰로 Drop을 모을 수 있어요. AI Credit은 홈 맞춤 AI
          기능(코스 만들기·Studio Pro와 별도)에 쓰일 예정이에요.
        </p>

        <div style={balanceRow}>
          <div style={balanceCard}>
            <DropIcon size={20} />
            <div>
              <div style={balanceValue}>{w.drops.toLocaleString("ko-KR")}</div>
              <div style={balanceLabel}>{DROP_UNIT_LABEL} 보유</div>
            </div>
          </div>
          <div style={{ ...balanceCard, ...balanceCardCredit }}>
            <AiCreditIcon size={18} />
            <div>
              <div style={balanceValue}>{w.aiCredits.toLocaleString("ko-KR")}</div>
              <div style={balanceLabel}>{AI_CREDIT_UNIT_LABEL}</div>
            </div>
          </div>
        </div>

        <div style={progressBlock}>
          <div style={progressHeader}>
            <span>다음 {AI_CREDIT_UNIT_LABEL}까지</span>
            <span style={progressNums}>
              {progress.current} / {progress.target} {DROP_UNIT_LABEL}
            </span>
          </div>
          <div style={progressTrack}>
            <div
              style={{
                ...progressFill,
                width: `${progress.percent}%`,
              }}
            />
          </div>
        </div>

        <button
          type="button"
          style={{
            ...exchangeBtn,
            opacity: canExchange && !exchanging ? 1 : 0.45,
          }}
          disabled={!canExchange || exchanging}
          onClick={() => void onExchange?.()}
        >
          {exchanging
            ? "교환 중…"
            : `${w.dropsPerAiCredit} ${DROP_UNIT_LABEL} → ${AI_CREDIT_UNIT_LABEL} 1회`}
        </button>

        {import.meta.env.DEV ? (
          <button
            type="button"
            style={previewBtn}
            onClick={() => {
              onPreviewEarn?.(10);
              showDropEarnToast(10, "UI 미리보기");
            }}
          >
            미리보기 +10 Drop
          </button>
        ) : null}

        <button type="button" style={closeBtn} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>,
    document.body
  );
}

const backdrop = {
  position: "fixed",
  inset: 0,
  zIndex: SHEET_Z,
  background: "rgba(0,0,0,0.52)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: "0 0 env(safe-area-inset-bottom, 0px)",
};

const sheet = {
  width: "100%",
  maxWidth: "420px",
  borderRadius: "20px 20px 0 0",
  padding: "8px 18px calc(20px + env(safe-area-inset-bottom, 0px))",
  background:
    "linear-gradient(180deg, rgba(30,27,22,0.98) 0%, rgba(12,10,8,0.98) 100%)",
  border: "1px solid rgba(245,166,35,0.22)",
  borderBottom: "none",
  boxShadow: "0 -12px 40px rgba(0,0,0,0.45)",
  color: "#fff",
  boxSizing: "border-box",
};

const handle = {
  width: "36px",
  height: "4px",
  borderRadius: "99px",
  background: "rgba(255,255,255,0.2)",
  margin: "4px auto 14px",
};

const title = {
  margin: "0 0 6px",
  fontSize: "17px",
  fontWeight: 800,
  letterSpacing: "-0.02em",
};

const hint = {
  margin: "0 0 16px",
  fontSize: "12px",
  lineHeight: 1.5,
  color: "rgba(255,255,255,0.52)",
};

const balanceRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
  marginBottom: "16px",
};

const balanceCard = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 12px",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(245,166,35,0.28)",
};

const balanceCardCredit = {
  border: "1px solid rgba(129,140,248,0.35)",
};

const balanceValue = {
  fontSize: "20px",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  lineHeight: 1.1,
};

const balanceLabel = {
  fontSize: "10px",
  fontWeight: 700,
  color: "rgba(255,255,255,0.48)",
  marginTop: "2px",
};

const progressBlock = {
  marginBottom: "14px",
};

const progressHeader = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "11px",
  fontWeight: 700,
  color: "rgba(255,255,255,0.58)",
  marginBottom: "6px",
};

const progressNums = {
  color: "#FFE08A",
};

const progressTrack = {
  height: "8px",
  borderRadius: "99px",
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const progressFill = {
  height: "100%",
  borderRadius: "99px",
  background: "linear-gradient(90deg, #F5A623 0%, #FFE08A 100%)",
  transition: "width 0.35s ease",
};

const exchangeBtn = {
  width: "100%",
  minHeight: "46px",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
  color: "#fff",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
  marginBottom: "8px",
};

const previewBtn = {
  width: "100%",
  minHeight: "40px",
  borderRadius: "10px",
  border: "1px dashed rgba(245,166,35,0.45)",
  background: "transparent",
  color: "rgba(255,224,138,0.9)",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
  marginBottom: "8px",
};

const closeBtn = {
  width: "100%",
  minHeight: "42px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "rgba(255,255,255,0.72)",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};
