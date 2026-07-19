/**
 * 카카오톡·인스타 등 인앱(WebView) 감지.
 * Google OAuth 는 인앱에서 `403: disallowed_useragent` 로 차단됨.
 */

const IN_APP_RULES = [
  { id: "kakaotalk", re: /KAKAOTALK/i, label: "카카오톡" },
  { id: "instagram", re: /Instagram/i, label: "인스타그램" },
  { id: "facebook", re: /FBAN|FBAV|FB_IAB|FB4A|FBIOS/i, label: "페이스북" },
  { id: "naver", re: /NAVER\(|InAppBrowser|NAVER/i, label: "네이버" },
  { id: "line", re: /\bLine\//i, label: "라인" },
  { id: "twitter", re: /Twitter/i, label: "X(트위터)" },
  { id: "linkedin", re: /LinkedInApp/i, label: "링크드인" },
  { id: "webview", re: /; wv\)|WebView/i, label: "인앱 브라우저" },
];

/**
 * @returns {{ inApp: boolean, id: string, label: string } | null}
 */
export function detectInAppBrowser() {
  if (typeof navigator === "undefined") return null;
  const ua = String(navigator.userAgent || "");
  if (!ua) return null;
  for (const rule of IN_APP_RULES) {
    if (rule.re.test(ua)) {
      return { inApp: true, id: rule.id, label: rule.label };
    }
  }
  return null;
}

export function isInAppBrowser() {
  return Boolean(detectInAppBrowser()?.inApp);
}

export function isAndroidUa() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

export function isIosUa() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

/**
 * 현재 페이지를 기기 기본/크롬 브라우저로 열기 시도.
 * @returns {'android_chrome' | 'copied' | 'manual'}
 */
export function openCurrentPageInExternalBrowser() {
  if (typeof window === "undefined") return "manual";
  const url = window.location.href;

  if (isAndroidUa()) {
    const withoutScheme = url.replace(/^https?:\/\//i, "");
    const intent = `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    window.location.href = intent;
    return "android_chrome";
  }

  try {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url);
      return "copied";
    }
  } catch {
    /* ignore */
  }
  return "manual";
}

/** Google 로그인 차단용 사용자 메시지 */
export function googleLoginBlockedInAppMessage(appLabel) {
  const name = appLabel || "인앱 브라우저";
  if (isAndroidUa()) {
    return `${name} 안에서는 구글 로그인이 막혀 있어요.\n「외부 브라우저로 열기」를 누르거나, 카카오로 로그인해 주세요.`;
  }
  return `${name} 안에서는 구글 로그인이 막혀 있어요.\n우측 메뉴(⋯)에서 Safari/Chrome으로 연 뒤 다시 시도하거나, 카카오로 로그인해 주세요.`;
}

export const IN_APP_GOOGLE_AUTH_ERROR_CODE = "IN_APP_GOOGLE_BLOCKED";
