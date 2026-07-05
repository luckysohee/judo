import DropIcon from "./DropIcon.jsx";
import AiCreditIcon from "./AiCreditIcon.jsx";
import { DROP_UNIT_LABEL } from "../../constants/dropEconomy.js";

/**
 * 홈 지도 우측 범례 — Drop · AI Credit (일반 유저)
 * @param {{
 *   visible?: boolean,
 *   drops?: number,
 *   aiCredits?: number,
 *   onOpen?: () => void,
 *   buttonStyle?: object,
 *   labelStyle?: object,
 *   creditBadgeStyle?: object,
 * }} props
 */
export default function UserWalletLegendChip({
  visible = false,
  drops = 0,
  aiCredits = 0,
  onOpen,
  buttonStyle = {},
  labelStyle = {},
  creditBadgeStyle = {},
}) {
  if (!visible || typeof onOpen !== "function") return null;

  const dropCount = Math.max(0, Math.floor(Number(drops) || 0));
  const credits = Math.max(0, Math.floor(Number(aiCredits) || 0));

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${dropCount} ${DROP_UNIT_LABEL} 보유${credits ? `, AI Credit ${credits}회` : ""}`}
      title="Drop · AI Credit"
      style={{ position: "relative", ...buttonStyle }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 0,
        }}
        aria-hidden
      >
        <DropIcon size={14} />
      </span>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          marginTop: "2px",
          color: "#FFE8A3",
        }}
      >
        {dropCount >= 1000
          ? `${(dropCount / 1000).toFixed(1).replace(/\.0$/, "")}k`
          : dropCount}
      </span>
      <span style={labelStyle}>{DROP_UNIT_LABEL}</span>
      {credits > 0 ? (
        <span style={{ ...creditDot, ...creditBadgeStyle }} aria-hidden>
          <AiCreditIcon size={8} />
          <span style={creditDotText}>{credits}</span>
        </span>
      ) : null}
    </button>
  );
}

const creditDot = {
  position: "absolute",
  top: "-4px",
  right: "-4px",
  display: "inline-flex",
  alignItems: "center",
  gap: "1px",
  padding: "2px 4px",
  borderRadius: "99px",
  background: "linear-gradient(135deg, #6366F1, #4F46E5)",
  border: "1px solid rgba(199,210,254,0.5)",
  boxShadow: "0 2px 8px rgba(79,70,229,0.45)",
};

const creditDotText = {
  fontSize: "7px",
  fontWeight: 900,
  color: "#fff",
  lineHeight: 1,
};
