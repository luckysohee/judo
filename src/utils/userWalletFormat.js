import {
  AI_CREDIT_UNIT_LABEL,
  DROP_UNIT_LABEL,
  DROPS_PER_AI_CREDIT,
} from "../constants/dropEconomy.js";

/**
 * @param {number} drops
 * @param {{ compact?: boolean }} [opts]
 */
export function formatDropBalance(drops, opts = {}) {
  const n = Math.max(0, Math.floor(Number(drops) || 0));
  if (opts.compact) return `${n.toLocaleString("ko-KR")} ${DROP_UNIT_LABEL}`;
  return `${n.toLocaleString("ko-KR")} ${DROP_UNIT_LABEL} 보유`;
}

/**
 * @param {number} credits
 * @param {{ compact?: boolean }} [opts]
 */
export function formatAiCreditBalance(credits, opts = {}) {
  const n = Math.max(0, Math.floor(Number(credits) || 0));
  if (opts.compact) {
    return `${n.toLocaleString("ko-KR")} ${AI_CREDIT_UNIT_LABEL}`;
  }
  return `${AI_CREDIT_UNIT_LABEL} ${n.toLocaleString("ko-KR")}회`;
}

/**
 * @param {number} drops
 * @param {number} [perCredit]
 */
export function dropProgressToNextCredit(drops, perCredit = DROPS_PER_AI_CREDIT) {
  const need = Math.max(1, Math.floor(Number(perCredit) || DROPS_PER_AI_CREDIT));
  const bal = Math.max(0, Math.floor(Number(drops) || 0));
  const mod = bal % need;
  return {
    current: mod,
    target: need,
    percent: Math.min(100, Math.round((mod / need) * 100)),
    canExchange: mod === 0 && bal >= need,
  };
}

/**
 * @param {number} amount
 */
export function formatDropEarnToast(amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  return `+${n.toLocaleString("ko-KR")} ${DROP_UNIT_LABEL}`;
}
