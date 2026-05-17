import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyActiveCourseSession } from "../../api/courseSessions";

function scheduleIdleTask(fn) {
  if (typeof globalThis.requestIdleCallback === "function") {
    const id = globalThis.requestIdleCallback(() => fn(), { timeout: 2400 });
    return () => globalThis.cancelIdleCallback(id);
  }
  const t = globalThis.setTimeout(() => fn(), 0);
  return () => globalThis.clearTimeout(t);
}

/**
 * 진행 중인 코스 따라가기 세션이 있을 때만, 지도 위 얇은 링크 칩.
 */
export default function HomeActiveCourseFollowChip({ visible = true }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const cancelRef = useRef(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const s = await getMyActiveCourseSession();
      setSession(s);
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    if (loadedRef.current) return undefined;
    loadedRef.current = true;
    cancelRef.current = scheduleIdleTask(() => void load());
    return () => {
      if (typeof cancelRef.current === "function") cancelRef.current();
      cancelRef.current = null;
    };
  }, [visible, load]);

  useEffect(() => {
    if (!visible || typeof window === "undefined") return undefined;
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [visible, load]);

  if (!visible || !session?.course_id) return null;

  const cid = String(session.course_id || "").trim();
  const title =
    String(session.course?.title || "").trim() || "코스 따라가는 중";

  return (
    <div
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        top: "calc(124px + env(safe-area-inset-top, 0px))",
        zIndex: 87,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        boxSizing: "border-box",
      }}
      aria-live="polite"
    >
      <button
        type="button"
        onClick={() => {
          if (!cid) return;
          navigate(`/courses/${encodeURIComponent(cid)}`);
        }}
        style={{
          pointerEvents: "auto",
          maxWidth: "100%",
          border: "1px solid rgba(255,255,255,0.55)",
          background: "rgba(15,23,42,0.42)",
          color: "rgba(255,255,255,0.95)",
          borderRadius: 999,
          padding: "5px 12px 6px",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          cursor: "pointer",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
          WebkitTapHighlightColor: "transparent",
        }}
        title={title}
      >
        지금 <span style={{ color: "#fde68a" }}>{title}</span> 따라가는 중
      </button>
    </div>
  );
}
