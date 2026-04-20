import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import { syncAuthProviderToProfile } from "../lib/syncAuthProviderToProfile";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 초기 하이드레이션: getSession()은 로컬에 저장된 세션을 빠르게 복원한다.
    // getUser()는 서버에서 세션을 재검증하지만 호출마다 락·네트워크 비용이 있다.
    // 여기서는 세션 소스를 Provider 한 곳으로 두고, 이후 갱신은 onAuthStateChange로만
    // 맞춘다. 권한이 민감한 UI는 RLS·서버 검증에 의존하고, 컴포넌트에서는 useAuth()를 쓴다.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("getSession error:", error);
        }
        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
        const u = data?.session?.user;
        if (u) {
          syncAuthProviderToProfile(supabase, u).catch(() => {});
        }
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      const u = nextSession?.user;
      if (u) {
        syncAuthProviderToProfile(supabase, u).catch(() => {});
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => {
    return {
      session,
      user,
      loading,
      signInWithProvider: async (provider) => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: window.location.origin,
          },
        });

        if (error) {
          throw error;
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
    };
  }, [loading, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
