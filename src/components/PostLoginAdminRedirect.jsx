import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const STORAGE_KEY = "adminRedirectPath";

/**
 * 비로그인으로 /admin 접근 시 저장된 경로로 복귀 (로그인 완료 후).
 * OAuth로 홈에 돌아올 때는 Router state 대신 sessionStorage를 씁니다.
 */
export default function PostLoginAdminRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user?.id) return;

    let stored = null;
    try {
      stored = sessionStorage.getItem(STORAGE_KEY);
    } catch (_) {}

    if (stored && stored.startsWith("/admin")) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
      const here = `${location.pathname}${location.search || ""}`;
      if (here !== stored) {
        navigate(stored, { replace: true });
      }
      return;
    }

    const from = location.state?.adminRedirectFrom;
    if (typeof from === "string" && from.startsWith("/admin")) {
      const here = `${location.pathname}${location.search || ""}`;
      if (here !== from) {
        navigate(from, {
          replace: true,
          state: { ...location.state, adminRedirectFrom: undefined },
        });
      }
    }
  }, [loading, user?.id, navigate, location.pathname, location.search, location.state]);

  return null;
}
