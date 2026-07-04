import { useCallback, useEffect, useState } from "react";
import {
  fetchUserTastePreferences,
  upsertUserTastePreferences,
} from "../api/userTastePreferences";
import { tasteRowFromOnboardingAnswers } from "../utils/userTasteProfile";

/**
 * @param {{ userId?: string|null, authLoading?: boolean }} opts
 */
export function useUserTastePreferences({ userId, authLoading = false }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const uid = String(userId || "").trim();
    if (!uid) {
      setProfile(null);
      return;
    }
    setLoading(true);
    try {
      const row = await fetchUserTastePreferences(uid);
      setProfile(row);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    void reload();
  }, [authLoading, reload]);

  const saveOnboarding = useCallback(
    async (answers, { skipped = false } = {}) => {
      const uid = String(userId || "").trim();
      if (!uid) return { ok: false };

      const row = tasteRowFromOnboardingAnswers(
        answers,
        uid,
        skipped ? "skipped" : "completed"
      );
      const { data, error } = await upsertUserTastePreferences(uid, row);
      if (error) {
        if (import.meta.env.DEV) {
          console.warn("[taste] save:", error.message || error);
        }
        return { ok: false, error };
      }
      setProfile(data || row);
      return { ok: true };
    },
    [userId]
  );

  const savePreferences = saveOnboarding;

  const needsOnboarding =
    Boolean(userId) &&
    !loading &&
    profile &&
    profile.onboarding_status === "pending";

  return {
    profile,
    loading,
    needsOnboarding,
    reload,
    saveOnboarding,
    savePreferences,
  };
}
