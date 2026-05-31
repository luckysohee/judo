import { supabase } from "../lib/supabase";
import {
  flattenCuratorStyleFeaturesForMl,
  normalizeCuratorStyleBlock,
} from "../utils/curatorStyleFeatures";

/**
 * ML·추천 파이프라인용 큐레이터 취향 특징 (본인만)
 * @param {string} curatorUserId auth uid
 */
export async function fetchCuratorStyleFeatures(curatorUserId) {
  const id = String(curatorUserId ?? "").trim();
  if (!id) {
    return {
      style: normalizeCuratorStyleBlock(null),
      ml: flattenCuratorStyleFeaturesForMl(normalizeCuratorStyleBlock(null)),
    };
  }

  const { data, error } = await supabase.rpc("get_curator_style_features", {
    p_curator_id: id,
  });
  if (error) throw error;

  const style = normalizeCuratorStyleBlock(
    data && typeof data === "object" ? data.features : null
  );
  return {
    style,
    ml: flattenCuratorStyleFeaturesForMl(style),
    raw: data,
  };
}
