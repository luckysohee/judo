/**
 * 큐레이터/일반 사용자 카드 클릭 시 띄우는 미니 프로필 + 팔로우 모달.
 * Home에서 inline JSX로 약 260줄을 차지하던 영역을 분리.
 */
export default function HomeFollowCuratorModal({
  open,
  onClose,
  roleLabel,
  bioText,
  gradeMeta,
  curator,
  currentUserUsername,
  onFollow,
}) {
  if (!open) return null;
  const isSelf = Boolean(
    curator?.username && currentUserUsername && curator.username === currentUserUsername
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(18,18,20,0.98) 0%, rgba(8,8,10,0.98) 100%)",
          borderRadius: "18px",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
          padding: "20px",
          width: "min(420px, calc(100vw - 28px))",
          maxWidth: "100%",
          boxSizing: "border-box",
          overflowWrap: "break-word",
          backdropFilter: "blur(18px) saturate(150%)",
          WebkitBackdropFilter: "blur(18px) saturate(150%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: 14 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "rgba(255,255,255,0.9)",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            {roleLabel}
          </span>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "14px",
              minWidth: 0,
            }}
          >
            {curator?.avatar ? (
              <img
                src={curator.avatar}
                alt={curator.displayName}
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid rgba(255,255,255,0.28)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, rgba(26,26,30,0.94) 0%, rgba(52,52,60,0.96) 100%)",
                  color: "white",
                  fontSize: "20px",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid rgba(255,255,255,0.85)",
                  boxShadow: "0 8px 18px rgba(0,0,0,0.45)",
                }}
              >
                {String(curator?.displayName ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <h3
                style={{
                  margin: "0 0 2px 0",
                  fontSize: "18px",
                  color: "#ffffff",
                  fontWeight: 900,
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
                }}
              >
                @{curator?.username}
              </h3>
              <div
                style={{
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.82)",
                  fontWeight: 800,
                  marginBottom: 2,
                }}
              >
                {curator?.displayName || "아는 사람"}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "#ffffff",
                  fontWeight: 800,
                  textShadow: "0 1px 3px rgba(0,0,0,0.38)",
                }}
              >
                {`${gradeMeta?.emoji ?? ""} ${gradeMeta?.label ?? ""}`}
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.84)",
              lineHeight: 1.55,
              marginBottom: "14px",
              padding: "12px",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.12)",
              textAlign: "left",
            }}
          >
            {bioText}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "10px 6px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "18px", fontWeight: 900, color: "#ffffff" }}>
                {curator?.saveCount ?? 0}
              </div>
              <div
                style={{ fontSize: "11px", color: "rgba(255,255,255,0.58)", fontWeight: 600 }}
              >
                잔 반응
              </div>
            </div>
            <div
              style={{
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "10px 6px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "18px", fontWeight: 900, color: "#ffffff" }}>
                {curator?.placeCount ?? 0}
              </div>
              <div
                style={{ fontSize: "11px", color: "rgba(255,255,255,0.58)", fontWeight: 600 }}
              >
                추천 장소
              </div>
            </div>
            <div
              style={{
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "10px 6px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "18px", fontWeight: 900, color: "#ffffff" }}>
                {curator?.followerCount ?? 0}
              </div>
              <div
                style={{ fontSize: "11px", color: "rgba(255,255,255,0.58)", fontWeight: 600 }}
              >
                팔로워
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}>
          {isSelf ? (
            <div
              style={{
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                padding: "14px 12px",
                background: "rgba(100,116,139,0.14)",
                color: "#64748b",
                border: "1px solid rgba(100,116,139,0.2)",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 700,
                textAlign: "center",
                cursor: "not-allowed",
                overflowWrap: "break-word",
                wordBreak: "break-word",
                lineHeight: 1.35,
              }}
            >
              자기 자신은 팔로우할 수 없습니다
            </div>
          ) : (
            <button
              type="button"
              style={{
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                padding: "14px 16px",
                background: "linear-gradient(135deg, #111111 0%, #2b2b2b 100%)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "15px",
                fontWeight: 800,
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 10px 20px rgba(0,0,0,0.42)",
                overflowWrap: "break-word",
                wordBreak: "break-word",
              }}
              onMouseOver={(e) => {
                e.target.style.transform = "translateY(-1px)";
                e.target.style.boxShadow = "0 12px 24px rgba(0,0,0,0.5)";
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 10px 20px rgba(0,0,0,0.42)";
              }}
              onClick={() => onFollow?.(curator?.username)}
            >
              팔로우하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
