import { supabase } from "../lib/supabase";

export async function fetchSupabaseCurators() {
  const { data, error } = await supabase
    .from("curators")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}