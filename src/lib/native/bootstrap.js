import { isNativePlatform, getNativePlatform } from "./platform";

/**
 * 앱 부팅 시 네이티브 셸 초기화 (StatusBar, Splash, Push 등록 시도).
 * 웹에서는 no-op.
 */
export async function bootstrapNativeShell() {
  if (!isNativePlatform()) return { platform: "web" };

  const platform = getNativePlatform();
  const result = { platform, statusBar: false, splash: false, push: false };

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
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.checkPermissions();
    let receive = perm.receive;
    if (receive === "prompt" || receive === "prompt-with-rationale") {
      const req = await PushNotifications.requestPermissions();
      receive = req.receive;
    }
    if (receive === "granted") {
      await PushNotifications.register();
      result.push = true;
    }

    PushNotifications.addListener("registration", (token) => {
      try {
        localStorage.setItem(
          "judo_push_token",
          JSON.stringify({
            value: token?.value || "",
            platform,
            at: new Date().toISOString(),
          })
        );
      } catch {
        /* ignore */
      }
      if (import.meta.env.DEV) {
        console.info("[native] push token registered");
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      if (import.meta.env.DEV) {
        console.warn("[native] push registrationError", err);
      }
    });
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[native] PushNotifications:", e);
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
