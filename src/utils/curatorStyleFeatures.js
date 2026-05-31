/** @typedef {{ label: string, pct: number, count: number }} StyleDimensionRow */
/** @typedef {'alcohol'|'moods'|'tags'|'categories'} StyleAxis */

export const CURATOR_STYLE_SCHEMA_VERSION = 2;

const STYLE_AXES = /** @type {const} */ (["alcohol", "moods", "tags", "categories"]);

/**
 * RPC style.* 배열 → 정규화 행 (UI·ML 공용)
 * @param {unknown} rows
 * @returns {StyleDimensionRow[]}
 */
export function normalizeStyleDimensionRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      label: String(r?.label ?? "").trim(),
      pct: Math.min(100, Math.max(0, Number(r?.pct) || 0)),
      count: Math.max(0, Math.floor(Number(r?.count) || 0)),
    }))
    .filter((r) => r.label);
}

/**
 * @param {unknown} meta
 */
export function normalizeCuratorStyleMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return {
      schemaVersion: CURATOR_STYLE_SCHEMA_VERSION,
      pickSourceCount: 0,
      courseOnlySourceCount: 0,
      themeTagSourceCount: 0,
      axes: {},
    };
  }
  const m = /** @type {Record<string, unknown>} */ (meta);
  return {
    schemaVersion: Math.max(
      1,
      Math.floor(Number(m.schema_version) || CURATOR_STYLE_SCHEMA_VERSION)
    ),
    pickSourceCount: Math.max(0, Math.floor(Number(m.pick_source_count) || 0)),
    courseOnlySourceCount: Math.max(
      0,
      Math.floor(Number(m.course_only_source_count) || 0)
    ),
    themeTagSourceCount: Math.max(
      0,
      Math.floor(Number(m.theme_tag_source_count) || 0)
    ),
    axes:
      m.axes && typeof m.axes === "object"
        ? /** @type {Record<string, string>} */ (m.axes)
        : {},
  };
}

/**
 * studio_archive_extended_insights / get_curator_style_features 의 style 블록
 * @param {unknown} styleRaw
 */
export function normalizeCuratorStyleBlock(styleRaw) {
  if (!styleRaw || typeof styleRaw !== "object") {
    return {
      alcohol: [],
      moods: [],
      tags: [],
      categories: [],
      meta: normalizeCuratorStyleMeta(null),
    };
  }
  const s = /** @type {Record<string, unknown>} */ (styleRaw);
  return {
    alcohol: normalizeStyleDimensionRows(s.alcohol),
    moods: normalizeStyleDimensionRows(s.moods),
    tags: normalizeStyleDimensionRows(s.tags),
    categories: normalizeStyleDimensionRows(s.categories),
    meta: normalizeCuratorStyleMeta(s.meta),
  };
}

/**
 * ML·추천용: 축별 label → 가중치(0~1). count 합으로 정규화, 없으면 pct/100.
 * @param {ReturnType<typeof normalizeCuratorStyleBlock>} style
 * @returns {Record<StyleAxis, Record<string, number>>}
 */
export function buildCuratorStyleWeightVectors(style) {
  /** @type {Record<StyleAxis, Record<string, number>>} */
  const out = {
    alcohol: {},
    moods: {},
    tags: {},
    categories: {},
  };

  for (const axis of STYLE_AXES) {
    const rows = style[axis] ?? [];
    const totalCount = rows.reduce((sum, r) => sum + r.count, 0);
    for (const row of rows) {
      const w =
        totalCount > 0
          ? row.count / totalCount
          : Math.min(1, Math.max(0, row.pct / 100));
      out[axis][row.label] = w;
    }
  }

  return out;
}

/**
 * @param {ReturnType<typeof normalizeCuratorStyleBlock>} style
 */
export function flattenCuratorStyleFeaturesForMl(style) {
  const vectors = buildCuratorStyleWeightVectors(style);
  return {
    schemaVersion: style.meta.schemaVersion,
    dimensions: STYLE_AXES.reduce((acc, axis) => {
      acc[axis] = (style[axis] ?? []).map((row) => ({
        label: row.label,
        count: row.count,
        pct: row.pct,
        weight: vectors[axis][row.label] ?? 0,
      }));
      return acc;
    }, /** @type {Record<StyleAxis, Array<{ label: string, count: number, pct: number, weight: number }>>} */ ({})),
    sources: {
      pickPlaces: style.meta.pickSourceCount,
      courseOnlyPlaces: style.meta.courseOnlySourceCount,
      courseThemeTags: style.meta.themeTagSourceCount,
    },
  };
}
