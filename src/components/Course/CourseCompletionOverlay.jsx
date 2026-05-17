import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { shareOrCopyCourseLink } from "../../utils/courseDetailUi";
import { COURSE_COMPLETED_EVENT } from "../../lib/courseCompletionEvents";

const overlayShell = {
  position: "fixed",
  inset: 0,
  zIndex: 100002,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px 16px",
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  boxSizing: "border-box",
};

const card = {
  width: "100%",
  maxWidth: "360px",
  borderRadius: "20px",
  padding: "22px 20px 18px",
  background:
    "linear-gradient(165deg, rgba(30,27,75,0.92) 0%, rgba(15,23,42,0.96) 55%, rgba(30,58,138,0.88) 100%)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow:
    "0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
  color: "#f8fafc",
  textAlign: "center",
};

const actionBase = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  boxSizing: "border-box",
  borderRadius: "14px",
  padding: "12px 14px",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: 1.25,
  minHeight: "46px",
  cursor: "pointer",
  textDecoration: "none",
};

const actionPrimary = {
  ...actionBase,
  border: "none",
  background: "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)",
  color: "#1e1b4b",
  fontWeight: 800,
  boxShadow: "0 8px 24px rgba(251,191,36,0.35)",
};

const actionOutline = {
  ...actionBase,
  border: "1px solid rgba(147,197,253,0.35)",
  background: "rgba(255,255,255,0.06)",
  color: "#bae6fd",
};

const actionMuted = {
  ...actionBase,
  border: "none",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(248,250,252,0.92)",
  fontWeight: 650,
};

/**
 * 코스 완주 직후 축하 + 요약 + 공유 (전역 CustomEvent `judo:course-completed`).
 */
export default function CourseCompletionOverlay() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const close = useCallback(() => {
    setOpen(false);
    setDetail(null);
  }, []);

  useEffect(() => {
    const onEv = (e) => {
      const d = e?.detail;
      if (!d || typeof d !== "object" || !d.headline) return;
      setDetail(d);
      setOpen(true);
    };
    window.addEventListener(COURSE_COMPLETED_EVENT, onEv);
    return () => window.removeEventListener(COURSE_COMPLETED_EVENT, onEv);
  }, []);

  const onShare = async () => {
    if (!detail?.shareUrl) return;
    try {
      await shareOrCopyCourseLink({
        url: detail.shareUrl,
        title: detail.headline,
        text: detail.shareText,
      });
    } catch {
      window.prompt("링크를 복사해 주세요.", detail.shareUrl);
    }
  };

  if (!open || !detail) return null;

  return (
    <div
      style={overlayShell}
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) close();
      }}
    >
      <div style={card} role="dialog" aria-modal="true" aria-labelledby="cc-headline">
        <div
          id="cc-headline"
          style={{
            fontSize: "19px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.35,
            marginBottom: "10px",
            textShadow: "0 2px 18px rgba(0,0,0,0.35)",
          }}
        >
          {detail.headline}
        </div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "rgba(226,232,240,0.88)",
            lineHeight: 1.55,
            marginBottom: "18px",
            letterSpacing: "-0.02em",
          }}
        >
          {detail.summaryLine}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "6px",
          }}
        >
          <button type="button" onClick={() => void onShare()} style={actionPrimary}>
            공유하기
          </button>
          <Link
            to="/completed-courses"
            onClick={close}
            style={actionOutline}
          >
            완주 기록 보기
          </Link>
          <button
            type="button"
            onClick={() => {
              if (detail.courseId) {
                navigate(`/courses/${encodeURIComponent(detail.courseId)}`);
              }
              close();
            }}
            style={actionMuted}
          >
            코스 다시 보기
          </button>
        </div>
        <button
          type="button"
          onClick={close}
          style={{
            marginTop: "8px",
            border: "none",
            background: "none",
            color: "rgba(148,163,184,0.95)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
