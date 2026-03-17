import { useMemo, useState } from "react";

import { createFolder, deleteFolder, updateFolder } from "../../utils/storage";

export default function SavedPlaces({
  open,
  folders,
  savedPlacesByFolder = {},
  onClose,
  onOpenPlaceDetail,
}) {
  if (!open) return null;

  const safeFolders = Array.isArray(folders) ? folders : [];

  const COLOR_OPTIONS = useMemo(
    () => ["#2ECC71", "#FF5A5F", "#8E44AD", "#3498DB", "#F39C12", "#1ABC9C"],
    []
  );

  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(COLOR_OPTIONS[0]);
  const [errorMessage, setErrorMessage] = useState("");

  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderColor, setEditFolderColor] = useState(COLOR_OPTIONS[0]);

  const startEdit = (folder) => {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name || "");
    setEditFolderColor(folder.color || COLOR_OPTIONS[0]);
    setErrorMessage("");
  };

  const cancelEdit = () => {
    setEditingFolderId(null);
    setEditFolderName("");
    setErrorMessage("");
  };

  const handleCreate = () => {
    try {
      createFolder(newFolderName, newFolderColor);
      setNewFolderName("");
      setErrorMessage("");
    } catch (e) {
      setErrorMessage(e?.message || "폴더 생성에 실패했습니다.");
    }
  };

  const handleUpdate = () => {
    try {
      updateFolder(editingFolderId, { name: editFolderName, color: editFolderColor });
      cancelEdit();
    } catch (e) {
      setErrorMessage(e?.message || "폴더 수정에 실패했습니다.");
    }
  };

  const handleDelete = (folder) => {
    const ok = window.confirm(`'${folder.name}' 폴더를 삭제할까요?\n(이 폴더에 저장된 항목 연결도 함께 제거됩니다.)`);
    if (!ok) return;
    try {
      deleteFolder(folder.id);
      if (editingFolderId === folder.id) cancelEdit();
      setErrorMessage("");
    } catch (e) {
      setErrorMessage(e?.message || "폴더 삭제에 실패했습니다.");
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.backdrop} />

      <div style={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div style={styles.handleWrap}>
          <button
            type="button"
            onClick={onClose}
            style={styles.handleButton}
            aria-label="내 저장 닫기"
          >
            <span style={styles.handleBar} />
          </button>
        </div>

        <div style={styles.header}>
          <div style={styles.title}>내 저장</div>
          <button type="button" onClick={onClose} style={styles.closeButton}>
            닫기
          </button>
        </div>

        <div style={styles.content}>
          <div style={styles.manageSection}>
            <div style={styles.manageTitle}>폴더 만들기</div>
            <div style={styles.createRow}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="폴더 이름"
                style={styles.input}
              />
              <button type="button" onClick={handleCreate} style={styles.primaryButton}>
                + 생성
              </button>
            </div>

            <div style={styles.colorRow}>
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewFolderColor(color)}
                  style={{
                    ...styles.colorButton,
                    backgroundColor: color,
                    outline: newFolderColor === color ? "2px solid #ffffff" : "none",
                  }}
                  aria-label={`폴더 색상 ${color}`}
                />
              ))}
            </div>
          </div>

          {editingFolderId ? (
            <div style={styles.manageSection}>
              <div style={styles.manageTitle}>폴더 수정</div>
              <div style={styles.createRow}>
                <input
                  type="text"
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  placeholder="폴더 이름"
                  style={styles.input}
                />
                <button type="button" onClick={handleUpdate} style={styles.primaryButton}>
                  저장
                </button>
                <button type="button" onClick={cancelEdit} style={styles.secondaryButton}>
                  취소
                </button>
              </div>

              <div style={styles.colorRow}>
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditFolderColor(color)}
                    style={{
                      ...styles.colorButton,
                      backgroundColor: color,
                      outline: editFolderColor === color ? "2px solid #ffffff" : "none",
                    }}
                    aria-label={`폴더 색상 ${color}`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {errorMessage ? <div style={styles.errorText}>{errorMessage}</div> : null}

          {safeFolders.length === 0 ? (
            <div style={styles.emptyText}>아직 만든 저장 폴더가 없습니다.</div>
          ) : (
            safeFolders.map((folder) => {
              const items = savedPlacesByFolder[folder.id] || [];

              return (
                <section key={folder.id} style={styles.folderSection}>
                  <div style={styles.folderHeader}>
                    <div style={styles.folderLeft}>
                      <span
                        style={{
                          ...styles.folderDot,
                          backgroundColor: folder.color || "#2ECC71",
                        }}
                      />
                      <span style={styles.folderName}>{folder.name}</span>
                    </div>
                    <div style={styles.folderRight}>
                      <span style={styles.folderCount}>{items.length}곳</span>
                      <button
                        type="button"
                        onClick={() => startEdit(folder)}
                        style={styles.folderActionButton}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(folder)}
                        style={styles.folderActionButton}
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div style={styles.emptyFolderText}>
                      이 폴더엔 아직 저장한 술집이 없습니다.
                    </div>
                  ) : (
                    <div style={styles.placeList}>
                      {items.map((place) => (
                        <button
                          key={place.id}
                          type="button"
                          onClick={() => onOpenPlaceDetail?.(place)}
                          style={styles.placeCard}
                        >
                          <img
                            src={place.image}
                            alt={place.name}
                            style={styles.placeImage}
                          />

                          <div style={styles.placeBody}>
                            <div style={styles.placeName}>{place.name}</div>
                            <div style={styles.placeMeta}>
                              {place.region} · 저장 {place.savedCount}
                            </div>
                            <div style={styles.placeComment}>{place.comment}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 300,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "relative",
    width: "100%",
    maxHeight: "80vh",
    backgroundColor: "rgba(18,18,18,0.98)",
    borderTopLeftRadius: "24px",
    borderTopRightRadius: "24px",
    boxShadow: "0 -10px 30px rgba(0,0,0,0.35)",
    overflow: "hidden",
    animation: "judoBottomSheetUp 260ms ease-out",
    backdropFilter: "blur(12px)",
  },
  handleWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "8px",
    paddingBottom: "2px",
  },
  handleButton: {
    width: "100%",
    border: "none",
    backgroundColor: "transparent",
    display: "flex",
    justifyContent: "center",
    padding: "4px 0 6px",
    cursor: "pointer",
  },
  handleBar: {
    width: "48px",
    height: "5px",
    borderRadius: "999px",
    backgroundColor: "#5e5e5e",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  title: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#ffffff",
  },
  closeButton: {
    border: "1px solid #3a3a3a",
    backgroundColor: "#171717",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
  },
  content: {
    padding: "14px 16px 24px",
    overflowY: "auto",
    maxHeight: "calc(80vh - 64px)",
  },
  manageSection: {
    border: "1px solid rgba(255,255,255,0.06)",
    backgroundColor: "rgba(21,21,21,0.92)",
    borderRadius: "16px",
    padding: "12px",
    marginBottom: "12px",
  },
  manageTitle: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: "10px",
  },
  createRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginBottom: "10px",
  },
  input: {
    flex: 1,
    height: "38px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.12)",
    backgroundColor: "#101010",
    color: "#ffffff",
    padding: "0 12px",
    fontSize: "13px",
    outline: "none",
  },
  primaryButton: {
    height: "38px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    fontSize: "12px",
    fontWeight: 900,
    flexShrink: 0,
  },
  secondaryButton: {
    height: "38px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid #3a3a3a",
    backgroundColor: "#171717",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 800,
    flexShrink: 0,
  },
  colorRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  colorButton: {
    width: "20px",
    height: "20px",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: "12px",
    marginBottom: "10px",
  },
  emptyText: {
    color: "#bdbdbd",
    fontSize: "14px",
    padding: "12px 0",
  },
  folderSection: {
    marginBottom: "18px",
  },
  folderHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  folderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  folderDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
  },
  folderName: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#ffffff",
  },
  folderCount: {
    fontSize: "12px",
    color: "#a9a9a9",
  },
  folderRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  folderActionButton: {
    border: "1px solid rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "11px",
    fontWeight: 800,
  },
  emptyFolderText: {
    fontSize: "13px",
    color: "#8f8f8f",
    padding: "6px 0 2px",
  },
  placeList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  placeCard: {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.06)",
    backgroundColor: "#151515",
    borderRadius: "16px",
    padding: "10px",
    display: "flex",
    gap: "10px",
    textAlign: "left",
  },
  placeImage: {
    width: "76px",
    height: "76px",
    borderRadius: "12px",
    objectFit: "cover",
    flexShrink: 0,
    backgroundColor: "#242424",
  },
  placeBody: {
    minWidth: 0,
    flex: 1,
  },
  placeName: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: "4px",
  },
  placeMeta: {
    fontSize: "12px",
    color: "#b8b8b8",
    marginBottom: "6px",
  },
  placeComment: {
    fontSize: "12px",
    color: "#e5e5e5",
    lineHeight: 1.45,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
};