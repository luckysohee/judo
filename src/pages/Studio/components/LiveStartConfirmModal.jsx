import React, { useEffect } from "react";

/**
 * 라이브 시작 확인 모달 — 알림 발송 여부를 묻는다. ×·바깥 클릭·Esc 로 취소.
 *
 * @param {{ open: boolean, onClose: () => void, onConfirmWithNotification: () => void, onConfirmWithoutNotification: () => void }} props
 */
export default function LiveStartConfirmModal({
  open,
  onClose,
  onConfirmWithNotification,
  onConfirmWithoutNotification,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-start-dialog-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "340px",
          backgroundColor: "#2a2a2a",
          borderRadius: "12px",
          padding: "20px 18px 16px",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
          textAlign: "left",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          title="닫기"
          aria-label="닫기"
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            width: "32px",
            height: "32px",
            padding: 0,
            margin: 0,
            border: "none",
            borderRadius: "8px",
            backgroundColor: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.9)",
            fontSize: "22px",
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
        <h2
          id="live-start-dialog-title"
          style={{
            margin: "0 36px 10px 0",
            fontSize: "17px",
            fontWeight: 700,
            color: "#fff",
          }}
        >
          라이브 시작
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: "13px",
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          팔로워에게 알림을 보낼까요?
          <br />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
            × 또는 바깥 영역을 누르면 취소됩니다.
          </span>
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={onConfirmWithNotification}
            style={{
              padding: "10px 14px",
              backgroundColor: "#3498DB",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            알림 보내고 시작
          </button>
          <button
            type="button"
            onClick={onConfirmWithoutNotification}
            style={{
              padding: "10px 14px",
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            알림 없이 라이브 시작
          </button>
        </div>
      </div>
    </div>
  );
}
