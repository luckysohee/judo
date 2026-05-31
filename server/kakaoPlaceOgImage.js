/**
 * 카카오 Local keyword API에는 장소 사진이 없음 → place.map.kakao.com og:image 로 보강.
 * @param {string} html
 * @returns {string|null}
 */
export function extractOgImageUrlFromHtml(html) {
  const text = String(html || "");
  if (!text) return null;
  const patterns = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const raw = m?.[1] ? String(m[1]).trim() : "";
    if (!raw) continue;
    if (raw.startsWith("//")) return `https:${raw}`;
    if (/^https?:\/\//i.test(raw)) return raw;
  }
  return null;
}

/**
 * @param {string} placeId 카카오 숫자 장소 id
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 * @returns {Promise<string|null>}
 */
export async function fetchKakaoPlaceOgImageUrl(placeId, opts = {}) {
  const pid = String(placeId ?? "").trim();
  if (!/^\d+$/.test(pid)) return null;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") return null;
  const timeoutMs =
    typeof opts.timeoutMs === "number" && opts.timeoutMs > 0
      ? Math.min(15000, Math.floor(opts.timeoutMs))
      : 9000;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://place.map.kakao.com/${pid}`, {
      signal: ac.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; JudoPlacePreview/1.0; +https://judo.app)",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractOgImageUrlFromHtml(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {object|null|undefined} doc keyword 검색 document
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<object|null|undefined>}
 */
export async function enrichKakaoPlaceDocWithOgImage(doc, opts = {}) {
  if (!doc || typeof doc !== "object") return doc;
  const existing = String(
    doc.thumbnail_url || doc.thumbnail || doc.photo_url || doc.image_url || ""
  ).trim();
  if (existing) return doc;
  const pid = String(doc.id ?? "").trim();
  if (!pid) return doc;
  const thumb = await fetchKakaoPlaceOgImageUrl(pid, opts);
  if (!thumb) return doc;
  return { ...doc, thumbnail_url: thumb };
}
