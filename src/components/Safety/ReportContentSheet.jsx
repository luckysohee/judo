import { useState } from "react";
import { motion } from "framer-motion";
import { REPORT_REASONS, submitContentReport } from "../../api/contentReports";
import { LEGAL } from "../../config/legal";

/**
 * UGC 신고 시트 (Guideline 1.2).
 */
export default function ReportContentSheet({
  open,
  onClose,
  reporterId,
  targetType,
  targetId,
  targetOwnerId = null,
  targetLabel = "콘텐츠",
  onSubmitted,
}) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setError("");
    if (!reason) {
      setError("신고 사유를 선택해 주세요.");
      return;
    }
    if (!reporterId) {
      setError("로그인이 필요해요.");
      return;
    }
    setBusy(true);
    try {
      await submitContentReport({
        reporterId,
        targetType,
        targetId,
        targetOwnerId,
        reason,
        detail,
      });
      setDone(true);
      onSubmitted?.();
    } catch (e) {
      setError(e?.message || "신고를 접수하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setDetail("");
    setError("");
    setDone(false);
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="콘텐츠 신고"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40000,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={handleClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "88dvh",
          overflowY: "auto",
          background: "#161616",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "20px 18px calc(20px + env(safe-area-inset-bottom))",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 999,
            background: "rgba(255,255,255,0.2)",
            margin: "0 auto 14px",
          }}
        />
        <h2
          style={{
            margin: "0 0 6px",
            fontSize: 18,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          {done ? "신고가 접수됐어요" : `${targetLabel} 신고`}
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          {done
            ? "운영팀이 검토합니다. 보통 24시간 이내에 처리하며, 필요 시 콘텐츠 삭제·계정 제한을 진행합니다."
            : "불쾌하거나 정책에 위반되는 콘텐츠를 알려 주세요. 허위 신고는 이용이 제한될 수 있습니다."}
        </p>

        {done ? (
          <button
            type="button"
            onClick={handleClose}
            style={primaryBtn}
          >
            확인
          </button>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  style={{
                    ...choiceBtn,
                    borderColor:
                      reason === r.id
                        ? "rgba(124,255,107,0.55)"
                        : "rgba(255,255,255,0.12)",
                    background:
                      reason === r.id
                        ? "rgba(124,255,107,0.12)"
                        : "rgba(255,255,255,0.04)",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value.slice(0, 500))}
              placeholder="추가 설명 (선택, 최대 500자)"
              rows={3}
              style={{
                width: "100%",
                marginTop: 12,
                boxSizing: "border-box",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#0e0e0e",
                color: "#fff",
                padding: 12,
                fontSize: 14,
                resize: "vertical",
              }}
            />
            {error ? (
              <p style={{ color: "#f87171", fontSize: 13, margin: "10px 0 0" }}>
                {error}
              </p>
            ) : null}
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1.4,
              }}
            >
              긴급 문의:{" "}
              <a
                href={`mailto:${LEGAL.contactEmail}`}
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                {LEGAL.contactEmail}
              </a>
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="button" onClick={handleClose} style={ghostBtn}>
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSubmit()}
                style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "접수 중…" : "신고 제출"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

const primaryBtn = {
  flex: 1,
  minHeight: 46,
  borderRadius: 12,
  border: "none",
  background: "#7CFF6B",
  color: "#111",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  width: "100%",
};

const ghostBtn = {
  flex: 1,
  minHeight: 46,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "transparent",
  color: "rgba(255,255,255,0.75)",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
};

const choiceBtn = {
  textAlign: "left",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
