import { supabase } from "./supabase";

/**
 * React Strict Mode·동시 마운트에서 getUser/getSession lock steal 방지용.
 * @returns {Promise<import('@supabase/supabase-js').User | null>}
 */
export async function getSupabaseUserSafe() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data?.user ?? null;
  } catch {
    return null;
  }
}
