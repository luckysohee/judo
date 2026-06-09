/** Supabase REST/RPC hang 시 Railway 502 방지 */
export const SUPABASE_FETCH_TIMEOUT_MS = 12000;

export function createSupabaseFetch(timeoutMs = SUPABASE_FETCH_TIMEOUT_MS) {
  return (url, options = {}) => {
    if (options.signal) {
      return fetch(url, options);
    }
    return fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  };
}
