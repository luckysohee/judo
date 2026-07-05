const listeners = new Set();

/**
 * @param {(payload: { amount: number, subtitle?: string } | null) => void} fn
 */
export function subscribeDropEarnToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * @param {number} amount
 * @param {string} [subtitle]
 */
export function showDropEarnToast(amount, subtitle = "") {
  const payload = {
    amount: Math.max(0, Math.floor(Number(amount) || 0)),
    subtitle: String(subtitle || "").trim(),
  };
  for (const fn of listeners) {
    try {
      fn(payload);
    } catch {
      /* ignore */
    }
  }
}

export function clearDropEarnToast() {
  for (const fn of listeners) {
    try {
      fn(null);
    } catch {
      /* ignore */
    }
  }
}
