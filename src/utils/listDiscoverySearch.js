/**
 * 맛집첩 디스커버리 검색 — 느슨한 부분 매칭
 * (성수동 ← "성수", 태그·큐레이터·장소명 포함)
 */

const REGION_SUFFIX_RE =
  /(특별자치시|특별자치도|광역시|특별시|자치시|자치도|시|군|구|동|읍|면|리|로|길|가|역)$/;

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function expandListSearchQueryVariants(raw) {
  let q = String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  if (!q) return [];

  const variants = new Set();
  const add = (s) => {
    const t = String(s || "").trim();
    if (t.length >= 1) variants.add(t);
  };

  add(q);
  add(q.replace(/\s+/g, ""));

  for (const token of q.split(/\s+/).filter(Boolean)) {
    add(token);
    let cur = token;
    for (let i = 0; i < 6; i += 1) {
      const next = cur.replace(REGION_SUFFIX_RE, "");
      if (!next || next === cur) break;
      add(next);
      cur = next;
    }
  }

  let cur = q.replace(/\s+/g, "");
  for (let i = 0; i < 6; i += 1) {
    const next = cur.replace(REGION_SUFFIX_RE, "");
    if (!next || next === cur) break;
    add(next);
    cur = next;
  }

  return [...variants];
}

function normalizeHay(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "");
}

function stripRegionSuffixes(s) {
  let cur = normalizeHay(s).replace(/\s+/g, "");
  for (let i = 0; i < 6; i += 1) {
    const next = cur.replace(REGION_SUFFIX_RE, "");
    if (!next || next === cur) break;
    cur = next;
  }
  return cur;
}

/**
 * @param {string} field
 * @param {string[]} variants
 */
export function fieldMatchesListSearchVariants(field, variants) {
  const h = normalizeHay(field);
  if (!h || !Array.isArray(variants) || variants.length === 0) return false;
  const hCompact = h.replace(/\s+/g, "");
  const hLoose = stripRegionSuffixes(h);

  for (const v of variants) {
    if (!v) continue;
    if (h.includes(v) || hCompact.includes(v)) return true;
    if (hLoose && (hLoose.includes(v) || v.includes(hLoose))) {
      /** 너무 짧은 역매칭(한 글자)은 노이즈 → 2글자부터 */
      if (v.length >= 2 || hLoose.length >= 2) return true;
    }
  }
  return false;
}

/**
 * @param {object} list
 * @param {string} rawQuery
 * @param {{
 *   curatorLabel?: string,
 *   placeNames?: string[],
 * }} [opts]
 */
export function listMatchesDiscoverySearch(list, rawQuery, opts = {}) {
  const variants = expandListSearchQueryVariants(rawQuery);
  if (variants.length === 0) return true;
  if (!list || typeof list !== "object") return false;

  const tags = Array.isArray(list.theme_tags) ? list.theme_tags : [];
  const placeNames = Array.isArray(opts.placeNames)
    ? opts.placeNames
    : Array.isArray(list._placeNames)
      ? list._placeNames
      : [];

  const fields = [
    list.title,
    list.area,
    list.description,
    opts.curatorLabel,
    ...tags,
    ...placeNames,
  ];

  return fields.some((f) => fieldMatchesListSearchVariants(f, variants));
}

/**
 * @param {object[]} lists
 * @param {string} rawQuery
 * @param {{
 *   curatorLabelFor?: (list: object) => string,
 * }} [opts]
 */
export function filterListsForDiscoverySearch(lists, rawQuery, opts = {}) {
  const q = String(rawQuery || "").trim();
  if (!q) return Array.isArray(lists) ? lists : [];
  const rows = Array.isArray(lists) ? lists : [];
  const labelFor =
    typeof opts.curatorLabelFor === "function"
      ? opts.curatorLabelFor
      : () => "";

  return rows.filter((list) =>
    listMatchesDiscoverySearch(list, q, {
      curatorLabel: labelFor(list),
      placeNames: list?._placeNames,
    })
  );
}
