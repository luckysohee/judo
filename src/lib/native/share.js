import { isNativePlatform } from "./platform";

/**
 * @param {{ title?: string, text?: string, url: string, dialogTitle?: string }} input
 * @returns {Promise<'shared'|'clipboard'|'aborted'>}
 */
export async function shareOrCopy({ title, text, url, dialogTitle }) {
  const u = String(url ?? "").trim();
  if (!u) throw new Error("shareOrCopy: url required");

  const payload = {
    title: title || "주도",
    text: String(text ?? title ?? "").trim() || title || "",
    url: u,
    dialogTitle: dialogTitle || "공유",
  };

  if (isNativePlatform()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share(payload);
      return "shared";
    } catch (e) {
      if (e && (e.name === "AbortError" || /cancel|abort/i.test(String(e.message || "")))) {
        return "aborted";
      }
      if (import.meta.env.DEV) {
        console.warn("[native/share] Capacitor fallback:", e);
      }
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return "shared";
    } catch (e) {
      if (e && (e.name === "AbortError" || String(e.message || "").includes("Abort"))) {
        return "aborted";
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(
      payload.text ? `${payload.text}\n${payload.url}` : payload.url
    );
    return "clipboard";
  }

  const err = new Error("CLIPBOARD_UNAVAILABLE");
  err.url = u;
  throw err;
}
