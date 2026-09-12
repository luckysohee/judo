import { isNativePlatform } from "./platform";

/**
 * @param {{ enableHighAccuracy?: boolean, timeout?: number, maximumAge?: number }} [options]
 * @returns {Promise<{ lat: number, lng: number, accuracyM: number|null }>}
 */
export async function getCurrentPosition(options = {}) {
  const enableHighAccuracy = options.enableHighAccuracy !== false;
  const timeout = typeof options.timeout === "number" ? options.timeout : 10000;
  const maximumAge =
    typeof options.maximumAge === "number" ? options.maximumAge : 15000;

  if (isNativePlatform()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy,
        timeout,
        maximumAge,
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM:
          typeof pos.coords.accuracy === "number" &&
          Number.isFinite(pos.coords.accuracy)
            ? pos.coords.accuracy
            : null,
      };
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[native/geo] Capacitor fallback to web:", e);
      }
    }
  }

  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation_not_supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM:
            typeof pos.coords.accuracy === "number" &&
            Number.isFinite(pos.coords.accuracy)
              ? pos.coords.accuracy
              : null,
        }),
      (err) => reject(err),
      { enableHighAccuracy, timeout, maximumAge }
    );
  });
}
