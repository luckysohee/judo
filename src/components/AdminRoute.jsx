import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { adminTopNavButtonStyle } from "../styles/adminTopNavButton";

const ADMIN_REDIRECT_STORAGE_KEY = "adminRedirectPath";

/**
 * `/admin/*` 전용 — 로그인 + profiles.role === admin 만 통과.
 * 하위 라우트는 `<Outlet />` 으로 렌더합니다.
 */
export default function AdminRoute() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [gate, setGate] = useState({
    checking: true,
    allowed: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      try {
        const path = `${location.pathname}${location.search || ""}`;
        if (path.startsWith("/admin")) {
          sessionStorage.setItem(ADMIN_REDIRECT_STORAGE_KEY, path);
        }
      } catch (_) {}
    }
  }, [authLoading, user?.id, location.pathname, location.search]);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setGate({ checking: false, allowed: false });
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("AdminRoute role check:", error);
        setGate({ checking: false, allowed: false });
        return;
      }

      setGate({
        checking: false,
        allowed: data?.role === "admin",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  if (authLoading || gate.checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#111111",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: "15px",
        }}
      >
        관리자 권한 확인 중…
      </div>
    );
  }

  if (!user?.id) {
    return <Navigate to="/" replace state={{ adminRedirectFrom: location.pathname }} />;
  }

  if (!gate.allowed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#111111",
          color: "#ffffff",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <p style={{ color: "#FF6B6B", fontSize: "16px", fontWeight: 700 }}>
          관리자만 접근할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{ ...adminTopNavButtonStyle, marginTop: "16px" }}
          aria-label="이전 페이지로"
          title="이전 페이지로"
        >
          ←
        </button>
      </div>
    );
  }

  return <Outlet context={{ isAdmin: true }} />;
}
