/**
 * @param {number} [maxEntries]
 * @param {number} [ttlMs]
 */
export function createTtlCache(maxEntries = 500, ttlMs = 6 * 60 * 60 * 1000) {
  /** @type {Map<string, { value: unknown, exp: number }>} */
  const map = new Map();

  return {
    get(key) {
      const e = map.get(String(key));
      if (!e) return undefined;
      if (Date.now() > e.exp) {
        map.delete(String(key));
        return undefined;
      }
      return e.value;
    },
    set(key, value) {
      const k = String(key);
      if (map.size >= maxEntries) {
        const first = map.keys().next().value;
        if (first != null) map.delete(first);
      }
      map.set(k, { value, exp: Date.now() + ttlMs });
    },
  };
}
