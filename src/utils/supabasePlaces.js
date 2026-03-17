import { supabase } from "../lib/supabase";

export async function fetchPlacesByPrimaryCuratorId(curatorId) {
  if (!curatorId) return [];

  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("primary_curator_id", curatorId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}
