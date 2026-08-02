import { supabase } from "../lib/supabase";

export async function fetchSupabaseCurators() {
  let { data, error } = await supabase
    .from("curators")
    .select("*")
    .order("home_chip_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (
    error &&
    /home_chip_order/i.test(String(error.message || error.details || ""))
  ) {
    ({ data, error } = await supabase
      .from("curators")
      .select("*")
      .order("created_at", { ascending: false }));
  }

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}