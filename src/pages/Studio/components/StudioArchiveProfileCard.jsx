import React from "react";

/**
 * 잔 아카이브 상단 큐레이터 프로필 카드 (보기·수정·라이브 버튼).
 *
 * @param {object} props
 */
export default function StudioArchiveProfileCard({
  curatorProfile,
  isEditingProfile,
  editProfile,
  setEditProfile,
  usernameError,
  profileEditAvatarFileRef,
  onProfileAvatarFileChange,
  onUsernameChange,
  onUpdateUsername,
  onSaveProfile,
  onCancelEdit,
  onEditProfile,
  stats,
  onEndLive,
  onOpenLiveConfirm,
}) {
  return (
    <div
      style={{
        backgroundColor: "#222",
        padding: "16px 14px",
        borderRadius: "10px",
        marginBottom: "16px",
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {isEditingProfile && (
          <input
            ref={profileEditAvatarFileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onProfileAvatarFileChange}
          />
        )}
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "#333",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
            fontSize: "14px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {(isEditingProfile ? editProfile.image : curatorProfile.image) ? (
            <img
              src={isEditingProfile ? editProfile.image : curatorProfile.image}
              alt={curatorProfile.displayName || curatorProfile.username}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div style={{ textAlign: "center", fontSize: "12px" }}>사진</div>
          )}
        </div>
        {isEditingProfile && (
          <button
            type="button"
            title="프로필 사진 올리기"
            aria-label="프로필 사진 올리기"
            onClick={() => profileEditAvatarFileRef.current?.click()}
            style={{
              margin: 0,
              padding: "5px 10px",
              fontSize: "11px",
              fontWeight: 600,
              color: "#fff",
              backgroundColor: "#444",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "6px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            사진 올리기
          </button>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, maxWidth: "100%" }}>
        {isEditingProfile ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              maxWidth: "400px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label
                style={{ color: "#ccc", fontSize: "12px", fontWeight: "600" }}
              >
                @큐레이터명 (주소)
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{ color: "#3498DB", fontSize: "16px", fontWeight: "600" }}
                >
                  @
                </span>
                <input
                  type="text"
                  value={editProfile.username}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  placeholder="영문 소문자·숫자·_"
                  style={{
                    flex: 1,
                    minWidth: "140px",
                    padding: "8px 12px",
                    backgroundColor: "#333",
                    color: "white",
                    border: usernameError
                      ? "1px solid #E74C3C"
                      : "1px solid #444",
                    borderRadius: "4px",
                    fontSize: "16px",
                    fontWeight: "600",
                    boxSizing: "border-box",
                    maxWidth: "280px",
                  }}
                />
                <button
                  type="button"
                  onClick={onUpdateUsername}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#95A5A6",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "600",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  자동생성
                </button>
              </div>
              {usernameError && (
                <div
                  style={{ color: "#E74C3C", fontSize: "12px", marginTop: "4px" }}
                >
                  {usernameError}
                </div>
              )}
              <div style={{ color: "#666", fontSize: "11px" }}>
                3–20자, 영문 소문자·숫자·밑줄만
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                style={{ color: "#ccc", fontSize: "12px", fontWeight: "600" }}
              >
                별명
              </label>
              <input
                type="text"
                value={editProfile.displayName}
                onChange={(e) =>
                  setEditProfile((prev) => ({
                    ...prev,
                    displayName: e.target.value,
                  }))
                }
                placeholder="화면에 보이는 이름"
                style={{
                  padding: "7px 10px",
                  backgroundColor: "#333",
                  color: "white",
                  border: "1px solid #444",
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontWeight: "600",
                  width: "100%",
                  boxSizing: "border-box",
                  maxWidth: "100%",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                style={{ color: "#ccc", fontSize: "12px", fontWeight: "600" }}
              >
                한줄 소개
              </label>
              <input
                type="text"
                value={editProfile.bio}
                onChange={(e) =>
                  setEditProfile((prev) => ({ ...prev, bio: e.target.value }))
                }
                placeholder="한 줄로 소개해 보세요"
                maxLength={200}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#333",
                  color: "white",
                  border: "1px solid #444",
                  borderRadius: "4px",
                  fontSize: "14px",
                  width: "100%",
                  boxSizing: "border-box",
                  maxWidth: "100%",
                }}
              />
              <div style={{ color: "#666", fontSize: "11px", textAlign: "right" }}>
                {(editProfile.bio || "").length}/200
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={onSaveProfile}
                disabled={!!usernameError}
                style={{
                  padding: "6px 12px",
                  backgroundColor: usernameError ? "#95A5A6" : "#2ECC71",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: usernameError ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                저장
              </button>
              <button
                onClick={onCancelEdit}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#E74C3C",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                alignItems: "baseline",
                gap: 0,
                width: "100%",
                margin: "0 0 8px 0",
                minWidth: 0,
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              <span
                style={{
                  flex: "0 0 50%",
                  minWidth: 0,
                  maxWidth: "50%",
                  fontSize: "clamp(15px, 3.5vw, 17px)",
                  fontWeight: 700,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "left",
                  boxSizing: "border-box",
                }}
                title={curatorProfile.displayName || ""}
              >
                {curatorProfile.displayName}
              </span>
              <span
                style={{
                  flex: "0 0 50%",
                  minWidth: 0,
                  maxWidth: "50%",
                  fontSize: "clamp(12px, 3vw, 14px)",
                  fontWeight: 600,
                  color: "#3498DB",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "left",
                  boxSizing: "border-box",
                }}
                title={`@${curatorProfile.username || ""}`}
              >
                @{curatorProfile.username}
              </span>
            </div>
            <p
              style={{
                margin: "0 0 12px 0",
                color: "#ccc",
                fontSize: "clamp(11px, 2.8vw, 13px)",
                lineHeight: 1.45,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                maxWidth: "100%",
              }}
            >
              {curatorProfile.bio}
            </p>

            <div
              style={{
                backgroundColor: "#333",
                padding: "5px 10px",
                borderRadius: "6px",
                marginBottom: "12px",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "4px 8px",
                minWidth: 0,
                maxWidth: "100%",
                boxSizing: "border-box",
                lineHeight: 1.2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    filter: "grayscale(0%) brightness(1.15)",
                    lineHeight: 1,
                  }}
                >
                  {curatorProfile.grade === "diamond"
                    ? "👑"
                    : curatorProfile.grade === "platinum"
                      ? "🏆"
                      : curatorProfile.grade === "gold"
                        ? "⭐"
                        : curatorProfile.grade === "silver"
                          ? "🌟"
                          : "🌱"}
                </span>
                <span
                  style={{
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {curatorProfile.grade === "diamond"
                    ? "다이아몬드"
                    : curatorProfile.grade === "platinum"
                      ? "플래티넘"
                      : curatorProfile.grade === "gold"
                        ? "골드"
                        : curatorProfile.grade === "silver"
                          ? "실버"
                          : "브론즈"}{" "}
                  큐레이터
                </span>
              </div>
              <span
                style={{
                  color: "rgba(255,255,255,0.32)",
                  fontSize: "11px",
                  fontWeight: 500,
                  userSelect: "none",
                  flexShrink: 0,
                }}
                aria-hidden
              >
                {" "}-{" "}
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  backgroundColor:
                    curatorProfile.status === "active"
                      ? "#1a3d2a"
                      : curatorProfile.status === "warning"
                        ? "#3d2a1a"
                        : curatorProfile.status === "suspended"
                          ? "#3d1a1a"
                          : "#2a2a2a",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color:
                      curatorProfile.status === "active"
                        ? "#2ECC71"
                        : curatorProfile.status === "warning"
                          ? "#F39C12"
                          : curatorProfile.status === "suspended"
                            ? "#E74C3C"
                            : "#95A5A6",
                    whiteSpace: "nowrap",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {curatorProfile.status === "active"
                    ? "✅ 활동중"
                    : curatorProfile.status === "warning"
                      ? "⚠️ 경고"
                      : curatorProfile.status === "suspended"
                        ? "🚫 활동중지"
                        : "💤 휴면"}
                </span>
                {curatorProfile.warning_count > 0 && (
                  <span
                    style={{
                      color: "#F39C12",
                      fontSize: "10px",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    경고 {curatorProfile.warning_count}회
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: "12px",
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                alignItems: "stretch",
                gap: "6px",
                width: "100%",
                minWidth: 0,
                maxWidth: "100%",
              }}
            >
              <button
                type="button"
                onClick={onEditProfile}
                style={{
                  padding: "6px 10px",
                  backgroundColor: "transparent",
                  color: "rgba(255,255,255,0.88)",
                  border: "1px solid rgba(255,255,255,0.28)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: "600",
                  flex: "0 0 auto",
                  transition:
                    "background-color 0.15s ease, border-color 0.15s ease",
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = "rgba(255,255,255,0.06)";
                  e.target.style.borderColor = "rgba(255,255,255,0.4)";
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = "transparent";
                  e.target.style.borderColor = "rgba(255,255,255,0.28)";
                }}
              >
                프로필 수정
              </button>
              <button
                type="button"
                onClick={stats.isLive ? onEndLive : onOpenLiveConfirm}
                title={
                  stats.isLive
                    ? `라이브 중지 — ${stats.notificationSent ? "알림 발송됨" : "알림 미발송"}`
                    : "라이브 시작"
                }
                style={{
                  flex: "1 1 0%",
                  minWidth: 0,
                  maxWidth: "100%",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: "600",
                  boxSizing: "border-box",
                  border: stats.isLive
                    ? "1px solid rgba(0,0,0,0.15)"
                    : "1px solid transparent",
                  backgroundColor: stats.isLive ? "#C0392B" : "#2ECC71",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    width: "100%",
                    textAlign: "center",
                    lineHeight: 1.25,
                  }}
                >
                  {stats.isLive ? (
                    <>
                      <span aria-hidden style={{ marginRight: "3px" }}>
                        🔴
                      </span>
                      라이브
                      <span style={{ fontWeight: 500, opacity: 0.9 }}>
                        {stats.notificationSent ? " · 발송" : " · 미발송"}
                      </span>
                    </>
                  ) : (
                    "라이브 시작"
                  )}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
