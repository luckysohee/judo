import { supabase } from "../lib/supabase";

export async function fetchCuratorLiveStatus(curatorId) {
  if (!curatorId) return null;

  const { data, error } = await supabase
    .from("curator_live_status")
    .select("curator_id, is_live, updated_at")
    .eq("curator_id", curatorId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function fetchCuratorLiveStatusByCuratorIds(curatorIds) {
  const ids = Array.isArray(curatorIds) ? curatorIds.filter(Boolean) : [];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("curator_live_status")
    .select("curator_id, is_live, updated_at")
    .in("curator_id", ids);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function setCuratorLiveStatus({ curatorId, isLive }) {
  if (!curatorId) {
    throw new Error("curatorId is required");
  }

  const nextIsLive = Boolean(isLive);

  const { error } = await supabase.from("curator_live_status").upsert(
    {
      curator_id: curatorId,
      is_live: nextIsLive,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "curator_id" }
  );

  if (error) {
    throw error;
  }
}

export function subscribeCuratorLiveStatus(curatorId, onChange) {
  if (!curatorId) return () => {};

  const channel = supabase
    .channel(`curator_live_status:${curatorId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "curator_live_status",
        filter: `curator_id=eq.${curatorId}`,
      },
      (payload) => {
        if (typeof onChange === "function") {
          onChange(payload);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeCuratorLiveStatusTable({ curatorIds, onChange } = {}) {
  const ids = Array.isArray(curatorIds) ? curatorIds.filter(Boolean) : [];

  const channel = supabase
    .channel("curator_live_status:table")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "curator_live_status",
      },
      (payload) => {
        const changedId = payload?.new?.curator_id || payload?.old?.curator_id;
        if (ids.length > 0 && (!changedId || !ids.includes(changedId))) {
          return;
        }

        if (typeof onChange === "function") {
          onChange(payload);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
