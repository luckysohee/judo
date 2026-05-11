import { supabase } from "./client";
import { HOME_VIBE_CHIP_PRESETS } from "../constants/homeVibeChips";

/**
 * 홈 vibe chip 섹션 데이터 fetch.
 *
 *  - 큐레이티드 preset 각각에 대해 `collections.vibe_caption ILIKE %keyword%` AND
 *    `visibility='public'` 의 head count 만 조회.
 *  - 결과 0건 chip 은 자동으로 제외 → 실제 매칭이 있는 chip 만 노출돼 빈 검색 진입 방지.
 *  - 모든 fetch 는 best-effort, 실패한 chip 은 그냥 빠짐(섹션 자체는 살아있음).
 *
 * 추천/검색/`useCourseSearch` 정렬과 무관 — UI 칩 진입로 데이터 전용.
 */

/**
 * @typedef {{
 *   id: string,
 *   emoji: string,
 *   label: string,
 *   keyword: string,
 *   match_count: number,
 * }} HomeVibeChipRow
 */

/**
 * PostgREST `ilike` 메타문자(%, _, \) 를 escape.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeIlike(value) {
  return String(value ?? "").replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * 활성(매칭 ≥ 1건) vibe chip 만 반환.
 *
 * @returns {Promise<HomeVibeChipRow[]>}
 */
export async function fetchActiveHomeVibeChips() {
  const probes = HOME_VIBE_CHIP_PRESETS.map(async (preset) => {
    const keyword = String(preset?.keyword ?? "").trim();
    if (!keyword) return null;
    try {
      const { count, error } = await supabase
        .from("collections")
        .select("id", { head: true, count: "exact" })
        .eq("visibility", "public")
        .ilike("vibe_caption", `%${escapeIlike(keyword)}%`);
      if (error) throw error;
      const n = Number.isFinite(count) ? count : 0;
      if (n <= 0) return null;
      return {
        id: preset.id,
        emoji: preset.emoji,
        label: preset.label,
        keyword,
        match_count: n,
      };
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn(
          "fetchActiveHomeVibeChips probe:",
          preset?.id,
          e?.message || e,
        );
      }
      return null;
    }
  });
  const out = await Promise.all(probes);
  return out.filter(Boolean);
}
