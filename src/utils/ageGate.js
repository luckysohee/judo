/** 만 19세 확인 — 기기당 1회. 약관·개인정보 페이지만 예외. */
export const AGE_GATE_STORAGE_KEY = "judo_age_confirmed_v1";
export const AGE_GATE_PUBLIC_PATHS = ["/terms", "/privacy"];

export function isAgeGatePublicPath(pathname) {
  const path = String(pathname || "");
  return AGE_GATE_PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
}

export function isAgeConfirmed() {
  try {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(AGE_GATE_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markAgeConfirmed() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(AGE_GATE_STORAGE_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function resetAgeGateForTests() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(AGE_GATE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
