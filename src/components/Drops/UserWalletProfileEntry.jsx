import DropIcon from "./DropIcon.jsx";
import AiCreditIcon from "./AiCreditIcon.jsx";
import { DROP_UNIT_LABEL, AI_CREDIT_UNIT_LABEL } from "../../constants/dropEconomy.js";

/**
 * 프로필 홈 — Drop · AI Credit 진입 (탭하면 지갑 시트)
 * @param {{
 *   visible?: boolean,
 *   drops?: number,
 *   aiCredits?: number,
 *   onOpen?: () => void,
 * }} props
 */
export default function UserWalletProfileEntry({
  visible = false,
  drops = 0,
  aiCredits = 0,
  onOpen,
}) {
  if (!visible || typeof onOpen !== "function") return null;

  const dropCount = Math.max(0, Math.floor(Number(drops) || 0));
  const credits = Math.max(0, Math.floor(Number(aiCredits) || 0));

  const hint =
    credits > 0
      ? `${dropCount.toLocaleString("ko-KR")} ${DROP_UNIT_LABEL} · ${AI_CREDIT_UNIT_LABEL} ${credits}회`
      : `${dropCount.toLocaleString("ko-KR")} ${DROP_UNIT_LABEL} · 탭해서 보기`;

  return (
    <button
      type="button"
      style={entryBtn}
      onClick={onOpen}
      aria-label={`Drop ${dropCount}개${credits ? `, AI Credit ${credits}회` : ""} 보기`}
    >
      <span style={entryMain}>
        <span style={entryTitleRow}>
          <DropIcon size={15} />
          <span style={entryTitle}>Drop · AI Credit</span>
          {credits > 0 ? (
            <span style={creditPill} aria-hidden>
              <AiCreditIcon size={8} />
              <span style={creditPillText}>{credits}</span>
            </span>
          ) : null}
        </span>
        <span style={entryHint}>{hint}</span>
      </span>
      <span style={entryChevron} aria-hidden>
        ›
      </span>
    </button>
  );
}

const entryBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255, 255, 255, 0.1)",
  background:
    "linear-gradient(160deg, rgba(0, 0, 0, 0.72) 0%, rgba(18, 18, 18, 0.92) 100%)",
  boxShadow:
    "0 2px 12px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
  color: "#fff",
  cursor: "pointer",
  textAlign: "left",
  WebkitTapHighlightColor: "transparent",
};

const entryMain = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const entryTitleRow = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};

const entryTitle = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "-0.02em",
};

const entryHint = {
  fontSize: 11,
  fontWeight: 500,
  color: "rgba(255,255,255,0.45)",
  lineHeight: 1.35,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const entryChevron = {
  flexShrink: 0,
  fontSize: 20,
  fontWeight: 300,
  lineHeight: 1,
  color: "rgba(255,255,255,0.32)",
};

const creditPill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  marginLeft: 4,
  padding: "2px 5px",
  borderRadius: 99,
  background: "rgba(255, 255, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
};

const creditPillText = {
  fontSize: 9,
  fontWeight: 800,
  lineHeight: 1,
  color: "rgba(255,255,255,0.88)",
};
