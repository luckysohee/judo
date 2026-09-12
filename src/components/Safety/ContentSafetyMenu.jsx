import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast/ToastProvider";
import { blockUser } from "../../api/userBlocks";
import ReportContentSheet from "./ReportContentSheet";

/**
 * 신고 / 차단 메뉴 (코스·장소·프로필 공통).
 *
 * @param {{
 *   targetType: string,
 *   targetId: string,
 *   targetOwnerId?: string|null,
 *   targetLabel?: string,
 *   showBlock?: boolean,
 *   buttonStyle?: object,
 *   compact?: boolean,
 * }} props
 */
export default function ContentSafetyMenu({
  targetType,
  targetId,
  targetOwnerId = null,
  targetLabel = "콘텐츠",
  showBlock = true,
  buttonStyle,
  compact = false,
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const ownerId = targetOwnerId ? String(targetOwnerId) : null;
  const isSelf =
    Boolean(user?.id) &&
    ((ownerId && ownerId === user.id) ||
      (String(targetId) === String(user.id) &&
        (targetType === "user" || targetType === "profile")));

  if (isSelf) return null;

  const handleReport = () => {
    setOpen(false);
    if (!user?.id) {
      showToast("로그인 후 신고할 수 있어요.", "info", 2800);
      return;
    }
    setReportOpen(true);
  };

  const handleBlock = async () => {
    setOpen(false);
    if (!user?.id) {
      showToast("로그인 후 차단할 수 있어요.", "info", 2800);
      return;
    }
    const blockId = ownerId || (targetType === "user" || targetType === "profile" ? targetId : null);
    if (!blockId) {
      showToast("차단할 사용자를 확인할 수 없어요.", "warning", 2800);
      return;
    }
    if (
      !window.confirm(
        "이 사용자를 차단할까요? 해당 사용자의 콘텐츠가 목록에서 숨겨집니다."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await blockUser(user.id, blockId);
      showToast("사용자를 차단했어요.", "success", 2600);
    } catch (e) {
      showToast(e?.message || "차단에 실패했어요.", "warning", 3200);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ position: "relative", display: "inline-flex" }}>
        <button
          type="button"
          aria-label="신고 · 차단"
          title="신고 · 차단"
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          style={{
            minWidth: compact ? 32 : 40,
            minHeight: compact ? 32 : 36,
            padding: compact ? "0 8px" : "0 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(0,0,0,0.35)",
            color: "rgba(255,255,255,0.85)",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            lineHeight: 1,
            ...buttonStyle,
          }}
        >
          ⋯
        </button>
        {open ? (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 50 }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                zIndex: 51,
                minWidth: 148,
                background: "#1c1c1c",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
              }}
            >
              <button type="button" role="menuitem" style={menuItem} onClick={handleReport}>
                신고하기
              </button>
              {showBlock && (ownerId || targetType === "user" || targetType === "profile") ? (
                <button
                  type="button"
                  role="menuitem"
                  style={{ ...menuItem, color: "#f87171" }}
                  onClick={() => void handleBlock()}
                >
                  사용자 차단
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <ReportContentSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        reporterId={user?.id}
        targetType={targetType}
        targetId={String(targetId || "")}
        targetOwnerId={ownerId}
        targetLabel={targetLabel}
      />
    </>
  );
}

const menuItem = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "12px 14px",
  border: "none",
  background: "transparent",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
