import React from "react";

const sectionInnerStyle = {
  textAlign: "left",
  margin: "0 auto",
  width: "min(920px, 100%)",
  maxWidth: "100%",
  minWidth: 0,
  padding: "0 4px",
  boxSizing: "border-box",
};

/**
 * 잔 채우기(임시저장) 탭 본문 — localStorage `studio_drafts` 기반.
 * 카드 클릭 동작은 부모가 주도하므로 onEdit/onDelete 콜백만 받는다.
 *
 * @param {{ drafts: Array<{ id: string|number, basicInfo: { name_address: string, category?: string }, createdAt?: string }>, onEdit: (draft: any) => void, onDelete: (draftId: string|number) => void }} props
 */
export default function StudioDraftsSection({ drafts, onEdit, onDelete }) {
  return (
    <div style={sectionInnerStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {drafts.map((draft) => (
          <div
            key={draft.id}
            style={{
              backgroundColor: "#222",
              padding: "12px 14px",
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "15px",
                  fontWeight: "bold",
                }}
              >
                {draft.basicInfo.name_address}
              </h3>
              <p
                style={{
                  margin: "0 0 4px 0",
                  color: "#888",
                  fontSize: "12px",
                }}
              >
                {draft.basicInfo.category} • {draft.createdAt}
              </p>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 8px",
                  backgroundColor: "#F39C12",
                  color: "white",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                초안
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => onEdit(draft)}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#3498DB",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                수정
              </button>

              <button
                onClick={() => onDelete(draft.id)}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#E74C3C",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                삭제
              </button>
            </div>
          </div>
        ))}

        {drafts.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "24px 16px",
              backgroundColor: "#222",
              borderRadius: "8px",
              color: "#666",
              fontSize: "13px",
            }}
          >
            임시저장된 초안이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
