import { useEffect, useState } from "react";

import { checkAlphaAccessAllowed } from "../api/alphaAccess";
import { isAlphaAllowlistEnabled } from "../config/alphaAccess";
import { useAuth } from "../context/AuthContext";

/**
 * @returns {{
 *   enabled: boolean,
 *   authLoading: boolean,
 *   checking: boolean,
 *   user: import("@supabase/supabase-js").User | null,
 *   allowed: boolean,
 *   signInWithProvider: (provider: string) => Promise<void>,
 *   signOut: () => Promise<void>,
 * }}
 */
export function useAlphaAccess() {
  const { user, loading: authLoading, signInWithProvider, signOut } = useAuth();
  const enabled = isAlphaAllowlistEnabled();
  const [checking, setChecking] = useState(false);
  const [allowed, setAllowed] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setChecking(false);
      setAllowed(true);
      return;
    }
    if (authLoading) return;
    if (!user?.id) {
      setChecking(false);
      setAllowed(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    setAllowed(false);

    checkAlphaAccessAllowed()
      .then((ok) => {
        if (!cancelled) {
          setAllowed(ok);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllowed(false);
          setChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, authLoading, user?.id]);

  return {
    enabled,
    authLoading,
    checking,
    user,
    allowed,
    signInWithProvider,
    signOut,
  };
}
