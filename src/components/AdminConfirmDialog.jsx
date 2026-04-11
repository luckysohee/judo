/**
 * 관리자용 확인 모달 — window.confirm 대신 앱 톤에 맞춤 (ToastProvider 위에 두면 됨)
 */
export default function AdminConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-confirm-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10050,
        backgroundColor: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
      }}
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          borderRadius: "16px",
          border: "1px solid #333",
          backgroundColor: "#1a1a1a",
          color: "#fff",
          padding: "20px 22px",
          boxSizing: "border-box",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="admin-confirm-title"
          style={{
            margin: "0 0 12px",
            fontSize: "17px",
            fontWeight: 800,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "14px",
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.82)",
            whiteSpace: "pre-line",
          }}
        >
          {message}
        </p>
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              border: "1px solid #444",
              backgroundColor: "#252525",
              color: "#fff",
              borderRadius: "10px",
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              border: "none",
              backgroundColor: danger ? "#c0392b" : "#2ECC71",
              color: danger ? "#fff" : "#111",
              borderRadius: "10px",
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
