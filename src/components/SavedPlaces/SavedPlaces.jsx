import { useState } from "react";

import { createFolder, deleteFolder, updateFolder } from "../../utils/storage";
import { PlacePickButton } from "../PlacePick/PlacePickButton";

const COLOR_OPTIONS = [
  "#2ECC71",
  "#FF5A5F",
  "#8E44AD",
  "#3498DB",
  "#F39C12",
  "#1ABC9C",
];

export default function SavedPlaces({
  open,
  folders,
  savedPlacesByFolder = {},
  onClose,
  onOpenPlaceDetail,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  loading = false,
  emptyHint = "",
  requiresLogin = false,
  onLoginRequest,
}) {
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(COLOR_OPTIONS[0]);
  const [errorMessage, setErrorMessage] = useState("");

  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderColor, setEditFolderColor] = useState(COLOR_OPTIONS[0]);

  if (!open) return null;

  const safeFolders = Array.isArray(folders) ? folders : [];

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

  const handleCreate = async () => {
    try {
      if (typeof onCreateFolder === "function") {
        await onCreateFolder(newFolderName, newFolderColor);
      } else {
        createFolder(newFolderName, newFolderColor);
      }
      setNewFolderName("");
      setErrorMessage("");
    } catch (e) {
      setErrorMessage(e?.message || "폴더 생성에 실패했습니다.");
    }
  };

  const handleUpdate = async () => {
    try {
      if (typeof onUpdateFolder === "function") {
        await onUpdateFolder(editingFolderId, {
          name: editFolderName,
          color: editFolderColor,
        });
      } else {
        updateFolder(editingFolderId, {
          name: editFolderName,
          color: editFolderColor,
        });
      }
      cancelEdit();
    } catch (e) {
      setErrorMessage(e?.message || "폴더 수정에 실패했습니다.");
    }
  };

  const handleDelete = async (folder) => {
    const ok = window.confirm(
      `'${folder.name}' 폴더를 삭제할까요?\n(이 폴더에 저장된 항목 연결도 함께 제거됩니다.)`
    );
    if (!ok) return;
    try {
      if (typeof onDeleteFolder === "function") {
        await onDeleteFolder(folder.id);
      } else {
        deleteFolder(folder.id);
      }
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
          {requiresLogin ? (
            <div style={styles.loginGate}>
              <div style={styles.loginTitle}>로그인이 필요해요</div>
              <div style={styles.loginBody}>
                로그인하면 홈에서 저장한 장소가 여기에 보여요.
              </div>
              {typeof onLoginRequest === "function" ? (
                <button
                  type="button"
                  onClick={onLoginRequest}
                  style={styles.loginButton}
                >
                  홈에서 로그인
                </button>
              ) : null}
            </div>
          ) : (
            <div>
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
          {emptyHint ? <div style={styles.emptyText}>{emptyHint}</div> : null}
          {loading ? (
            <div style={styles.emptyText}>저장 목록을 불러오는 중…</div>
          ) : null}

          {!loading && safeFolders.length === 0 ? (
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
                        <div key={place.id} style={styles.placeRow}>
                          <button
                            type="button"
                            onClick={() => onOpenPlaceDetail?.(place)}
                            style={styles.placeCardMain}
                          >
                            <img
                              src={place.image}
                              alt={place.name}
                              style={styles.placeImage}
                            />

                            <div style={styles.placeBody}>
                              <div style={styles.placeName}>{place.name}</div>
                              <div style={styles.folderTagLine}>
                                <span aria-hidden>📁</span>
                                <span style={styles.folderTagName}>
                                  {folder.name}
                                </span>
                              </div>
                              <div style={styles.placeMeta}>
                                {place.region} · 저장 {place.savedCount}
                              </div>
                              <div style={styles.placeComment}>
                                {place.comment}
                              </div>
                            </div>
                          </button>
                          <div style={styles.placePickAside}>
                            <PlacePickButton
                              place={place}
                              variant="folderChip"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
            </div>
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
  loginGate: {
    padding: "28px 12px 20px",
    textAlign: "center",
  },
  loginTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: 8,
  },
  loginBody: {
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(255,255,255,0.72)",
    marginBottom: 16,
  },
  loginButton: {
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111",
    borderRadius: 999,
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
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
  placeRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    gap: "8px",
    width: "100%",
  },
  placeCardMain: {
    flex: 1,
    minWidth: 0,
    width: "100%",
    border: "1px solid rgba(255,255,255,0.06)",
    backgroundColor: "#151515",
    borderRadius: "16px",
    padding: "10px",
    display: "flex",
    gap: "10px",
    textAlign: "left",
    cursor: "pointer",
    color: "inherit",
    font: "inherit",
  },
  placePickAside: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    paddingTop: "10px",
    flexShrink: 0,
  },
  folderTagLine: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginBottom: "6px",
    fontSize: "12px",
    color: "#c8c8c8",
    fontWeight: 600,
  },
  folderTagName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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