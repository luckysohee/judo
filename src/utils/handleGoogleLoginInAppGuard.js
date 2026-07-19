import {
  detectInAppBrowser,
  isAndroidUa,
  openCurrentPageInExternalBrowser,
  IN_APP_GOOGLE_AUTH_ERROR_CODE,
} from "./inAppBrowser";

/**
 * 인앱에서 구글 로그인 탭 시 — Google 403 화면 대신 JUDO 안내.
 * @returns {boolean} true면 호출측에서 OAuth 를 더 진행하지 말 것
 */
export function handleGoogleLoginInAppGuard({ showToast } = {}) {
  const inApp = detectInAppBrowser();
  if (!inApp?.inApp) return false;

  const toast =
    typeof showToast === "function"
      ? (msg, type, ms) => showToast(msg, type, ms)
      : (msg) => {
          window.alert(msg);
        };

  if (isAndroidUa()) {
    const go = window.confirm(
      `${inApp.label} 안에서는 구글 로그인이 막혀 있어요.\n\n확인: Chrome으로 열기\n취소: 카카오 로그인 사용`
    );
    if (go) {
      openCurrentPageInExternalBrowser();
      toast("Chrome에서 열어 구글로 로그인해 주세요.", "info", 4000);
    } else {
      toast("아래 카카오 로그인으로 진행해 주세요.", "info", 3200);
    }
    return true;
  }

  const copied = openCurrentPageInExternalBrowser() === "copied";
  window.alert(
    `${inApp.label} 안에서는 구글 로그인이 막혀 있어요.\n\n` +
      (copied
        ? "주소가 복사됐어요. 사파리/Chrome을 열어 붙여넣기 한 뒤 구글로 로그인해 주세요.\n"
        : "우측 메뉴(⋯) → Safari/Chrome으로 열기를 누른 뒤 구글로 로그인해 주세요.\n") +
      "\n또는 카카오 로그인을 이용해 주세요."
  );
  return true;
}

export function isInAppGoogleAuthError(error) {
  return (
    error?.code === IN_APP_GOOGLE_AUTH_ERROR_CODE ||
    String(error?.message || "").includes("구글 로그인이 막혀")
  );
}
