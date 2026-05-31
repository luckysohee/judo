/**
 * PostgREST / Supabase — 마이그레이션 미적용 시 흔한 오류 코드
 * @param {unknown} error
 * @returns {boolean}
 */
export function isSupabaseSchemaMissingError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  if (code === "PGRST205" || code === "PGRST202" || code === "42P01") {
    return true;
  }
  const status = Number(
    error.status ?? error.statusCode ?? error.status_code ?? 0
  );
  if (status === 404 && (code === "PGRST202" || code === "PGRST205")) {
    return true;
  }
  const msg = String(error.message || "").toLowerCase();
  if (
    msg.includes("could not find the function") ||
    msg.includes("could not find the table")
  ) {
    return true;
  }
  return (
    msg.includes("schema cache") &&
    (msg.includes("could not find the table") ||
      msg.includes("could not find the function"))
  );
}
