import { supabase } from "../lib/supabase";

export async function fetchMyFollowedCuratorIds(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("curator_follows")
    .select("curator_id")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data.map((row) => row.curator_id).filter(Boolean) : [];
}

export async function followCurator({ userId, curatorId }) {
  const { error } = await supabase.from("curator_follows").insert([
    {
      user_id: userId,
      curator_id: curatorId,
    },
  ]);

  if (error) {
    throw error;
  }
}

export async function unfollowCurator({ userId, curatorId }) {
  const { error } = await supabase
    .from("curator_follows")
    .delete()
    .eq("user_id", userId)
    .eq("curator_id", curatorId);

  if (error) {
    throw error;
  }
}
