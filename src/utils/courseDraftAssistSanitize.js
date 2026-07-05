/** @param {string} tip @param {string[]} names */
export function tipMentionsAnyPlace(tip, names) {
  const t = String(tip || "");
  return names.some((n) => n.length >= 2 && t.includes(n));
}

/** 뻔한 한 줄만 있는 팁 — 상호명 없을 때 걸러냄 */
export function isGenericOnlyTip(tip) {
  const t = String(tip || "").trim();
  if (t.length >= 55) return false;
  return (
    /^(?:주차|대중교통|영업시간|SNS|인스타|미리\s*(?:예약|전화|확인)|날씨|현금|혼잡)/i.test(
      t
    ) ||
    /(?:확인(?:하|해)\s*(?:주|보)|이용(?:하|해)\s*(?:주|보)|추천(?:해|드)?)/i.test(
      t
    )
  );
}

/** @param {string[]} items @param {string[]} selectedNames */
export function refinePlaceSpecificTips(items, selectedNames, max = 5) {
  const list = (Array.isArray(items) ? items : [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  if (list.length === 0) return [];
  if (selectedNames.length === 0) return list.slice(0, max);

  const filtered = list.filter(
    (t) => tipMentionsAnyPlace(t, selectedNames) || !isGenericOnlyTip(t)
  );
  const pool = filtered.length > 0 ? filtered : list;

  const strong = pool.filter(
    (t) => tipMentionsAnyPlace(t, selectedNames) && !isGenericOnlyTip(t)
  );
  const named = pool.filter((t) => tipMentionsAnyPlace(t, selectedNames));

  if (strong.length >= 2) return strong.slice(0, max);
  if (named.length >= 2) return named.slice(0, max);
  if (strong.length >= 1) return strong.slice(0, max);
  if (named.length >= 1) return named.slice(0, max);
  return pool.slice(0, max);
}

/**
 * @param {unknown[]} places — compactPlacesForCourseDraftAssist 출력
 */
export function sanitizeCourseDraftAssistOutput(
  out,
  allowedKeys,
  places = [],
  opts = {}
) {
  const allowed = new Set(allowedKeys);
  const steps = (Array.isArray(out?.steps) ? out.steps : [])
    .map((s) => ({
      placeKey: String(s?.placeKey || "").trim(),
      memo: String(s?.memo || "").trim().slice(0, 160),
      visit_tip: String(s?.visit_tip || "").trim().slice(0, 160),
      stay_minutes: Number.isFinite(Number(s?.stay_minutes))
        ? Math.max(0, Math.min(180, Math.floor(Number(s.stay_minutes))))
        : 0,
    }))
    .filter((s) => s.placeKey && allowed.has(s.placeKey));

  const seen = new Set();
  const deduped = [];
  const minSteps = Math.max(2, Number(opts.minSteps) || 2);
  const maxSteps = Math.min(6, Number(opts.maxSteps) || 6);
  const exactSteps = opts.exactSteps === true;
  const targetSteps = Number(opts.targetSteps);
  const cap =
    exactSteps && Number.isFinite(targetSteps) && targetSteps >= 2
      ? targetSteps
      : maxSteps;

  for (const s of steps) {
    if (seen.has(s.placeKey)) continue;
    seen.add(s.placeKey);
    deduped.push(s);
    if (deduped.length >= cap) break;
  }

  if (deduped.length < minSteps) return null;
  if (exactSteps && Number.isFinite(targetSteps) && targetSteps >= 2) {
    if (deduped.length !== targetSteps) return null;
  } else if (deduped.length > maxSteps) {
    deduped.splice(maxSteps);
  }

  const theme_tags = (Array.isArray(out?.theme_tags) ? out.theme_tags : [])
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const placeByKey = new Map(
    (Array.isArray(places) ? places : [])
      .filter((p) => p?.placeKey)
      .map((p) => [String(p.placeKey), p])
  );
  const selectedNames = deduped
    .map((s) => String(placeByKey.get(s.placeKey)?.name || "").trim())
    .filter((n) => n.length >= 2);

  const route_tips = refinePlaceSpecificTips(
    (Array.isArray(out?.route_tips) ? out.route_tips : [])
      .map((t) => String(t || "").trim())
      .filter(Boolean)
      .map((t) => t.slice(0, 240)),
    selectedNames,
    5
  );

  const visit_checklist = refinePlaceSpecificTips(
    (Array.isArray(out?.visit_checklist) ? out.visit_checklist : [])
      .map((t) => String(t || "").trim())
      .filter(Boolean)
      .map((t) => t.slice(0, 240)),
    selectedNames,
    5
  );

  return {
    title: String(out?.title || "").trim().slice(0, 120),
    description: String(out?.description || "").trim().slice(0, 500),
    area: String(out?.area || "").trim().slice(0, 40),
    theme_tags,
    route_tips,
    visit_checklist,
    steps: deduped,
  };
}
