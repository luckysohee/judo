/** DB 트리거 `enforce_username_change_cooldown` (P0001) 응답 판별 */
export function isUsernameChangeCooldownError(error) {
  const m = String(error?.message || error?.details || "");
  return error?.code === "P0001" || /14일에 한 번/.test(m);
}
