import { isNativePlatform, getNativePlatform } from "./platform";

/**
 * 앱 부팅 시 네이티브 셸 초기화 (StatusBar, Splash).
 * 푸시 권한은 기능 출시 전까지 부팅 시 요청하지 않습니다 (과도한 권한 예방).
 * 웹에서는 no-op.
 */
export async function bootstrapNativeShell() {
  if (!isNativePlatform()) return { platform: "web" };

  const platform = getNativePlatform();
  const result = { platform, statusBar: false, splash: false };

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    if (platform === "android") {
      try {
        await StatusBar.setBackgroundColor({ color: "#0e0e0e" });
      } catch {
        /* ignore */
      }
    }
    result.statusBar = true;
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[native] StatusBar:", e);
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 280 });
    result.splash = true;
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[native] SplashScreen:", e);
  }

  try {
    const { App } = await import("@capacitor/app");
    App.addListener("appStateChange", ({ isActive }) => {
      if (import.meta.env.DEV) {
        console.info("[native] appStateChange", isActive);
      }
    });
  } catch {
    /* ignore */
  }

  return result;
}
