import { supabase } from "../lib/supabase";
import { searchKakaoKeywordViaProxy } from "./kakaoAPIProxy";

/**
 * 컬렉션 편집 화면 전용 장소 검색.
 * DB `places` ilike + 카카오 키워드 검색 프록시만 사용한다 (Home 검색 UI/로직 미사용).
 *
 * @param {string} query
 * @returns {Promise<{ dbRows: object[], kakaoDocs: object[] }>}
 */
export async function searchPlacesForCollectionAdd(query) {
  const term = String(query ?? "")
    .trim()
    .replace(/[%_\\]/g, "")
    .slice(0, 80);
  if (term.length < 2) {
    return { dbRows: [], kakaoDocs: [] };
  }
  const pattern = `%${term}%`;

  const [nameRes, addrRes, kakaoDocs] = await Promise.all([
    supabase
      .from("places")
      .select("id, name, address, category, kakao_place_id")
      .ilike("name", pattern)
      .limit(12),
    supabase
      .from("places")
      .select("id, name, address, category, kakao_place_id")
      .ilike("address", pattern)
      .limit(12),
    searchKakaoKeywordViaProxy({ query: term, size: 15 }).then((r) =>
      Array.isArray(r.documents) ? r.documents : [],
    ),
  ]);

  if (nameRes.error && import.meta.env.DEV) {
    console.warn("searchPlacesForCollectionAdd name:", nameRes.error);
  }
  if (addrRes.error && import.meta.env.DEV) {
    console.warn("searchPlacesForCollectionAdd address:", addrRes.error);
  }

  const dbById = new Map();
  for (const row of [...(nameRes.data || []), ...(addrRes.data || [])]) {
    if (row?.id) dbById.set(String(row.id), row);
  }
  const dbRows = [...dbById.values()].slice(0, 15);

  const dbKakaoIds = new Set(
    dbRows
      .map((r) => String(r.kakao_place_id ?? "").trim())
      .filter((id) => /^\d+$/.test(id)),
  );

  const kakaoFiltered = kakaoDocs.filter((d) => {
    const kid = String(d?.id ?? "").trim();
    return kid && /^\d+$/.test(kid) && !dbKakaoIds.has(kid);
  });

  return { dbRows, kakaoDocs: kakaoFiltered };
}
