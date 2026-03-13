import { useMemo, useState } from "react";
import { createFolder } from "../../utils/storage";

const COLOR_OPTIONS = [
  "#2ECC71",
  "#FF5A5F",
  "#8E44AD",
  "#3498DB",
  "#F39C12",
  "#1ABC9C",
];

export default function SaveFolderModal({
  open,
  place,
  folders,
  savedFolderIds,
  onClose,
  onSaveToFolder,
  onFoldersUpdated,
}) {
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(COLOR_OPTIONS[0]);
  const [errorMessage, setErrorMessage] = useState("");

  const availableFolders = useMemo(() => folders || [], [folders]);

  if (!open || !place) return null;

  const handleCreateFolder = () => {
    try {
      const created = createFolder(newFolderName, newFolderColor);
      onFoldersUpdated();
      setSelectedFolderId(created.id);
      setNewFolderName("");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleSave = () => {
    if (!selectedFolderId) {
      setErrorMessage("저장할 폴더를 선택해 주세요.");
      return;
    }

    onSaveToFolder(place.id, selectedFolderId);
    setErrorMessage("");
    onClose();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.title}>저장 폴더 선택</div>
        <div style={styles.placeName}>{place.name}</div>

        <div style={styles.sectionTitle}>기존 폴더</div>
        <div style={styles.folderList}>
          {availableFolders.map((folder) => {
            const alreadySaved = savedFolderIds.includes(folder.id);

            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => setSelectedFolderId(folder.id)}
                style={{
                  ...styles.folderButton,
                  borderColor:
                    selectedFolderId === folder.id ? folder.color : "#333333",
                  backgroundColor:
                    selectedFolderId === folder.id ? "#1f1f1f" : "#151515",
                }}
              >
                <span
                  style={{
                    ...styles.colorDot,
                    backgroundColor: folder.color,
                  }}
                />
                <span>{folder.name}</span>
                {alreadySaved ? (
                  <span style={styles.savedBadge}>저장됨</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div style={styles.sectionTitle}>새 폴더 만들기</div>
        <input
          type="text"
          value={newFolderName}
          onChange={(event) => setNewFolderName(event.target.value)}
          placeholder="폴더 이름 입력"
          style={styles.input}
        />

        <div style={styles.colorRow}>
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setNewFolderColor(color)}
              style={{
                ...styles.colorButton,
                backgroundColor: color,
                outline:
                  newFolderColor === color ? "2px solid #ffffff" : "none",
              }}
            />
          ))}
        </div>

        <button type="button" onClick={handleCreateFolder} style={styles.createButton}>
          + 새 폴더 만들기
        </button>

        {errorMessage ? (
          <div style={styles.errorText}>{errorMessage}</div>
        ) : null}

        <div style={styles.bottomRow}>
          <button type="button" onClick={onClose} style={styles.cancelButton}>
            취소
          </button>
          <button type="button" onClick={handleSave} style={styles.saveButton}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  },
  modal: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: "20px",
    padding: "18px",
  },
  title: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#ffffff",
  },
  placeName: {
    marginTop: "6px",
    fontSize: "14px",
    color: "#bdbdbd",
  },
  sectionTitle: {
    marginTop: "16px",
    marginBottom: "8px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#ffffff",
  },
  folderList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  folderButton: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    border: "1px solid #333333",
    borderRadius: "12px",
    padding: "12px",
    color: "#ffffff",
  },
  colorDot: {
    width: "12px",
    height: "12px",
    borderRadius: "999px",
    flexShrink: 0,
  },
  savedBadge: {
    marginLeft: "auto",
    fontSize: "11px",
    color: "#FFD54F",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: "44px",
    border: "1px solid #333333",
    borderRadius: "12px",
    padding: "0 12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    outline: "none",
  },
  colorRow: {
    marginTop: "10px",
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  colorButton: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    border: "none",
  },
  createButton: {
    marginTop: "12px",
    width: "100%",
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 700,
  },
  errorText: {
    marginTop: "10px",
    color: "#FF6B6B",
    fontSize: "13px",
  },
  bottomRow: {
    marginTop: "18px",
    display: "flex",
    gap: "10px",
  },
  cancelButton: {
    flex: 1,
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 700,
  },
  saveButton: {
    flex: 1,
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 800,
  },
};