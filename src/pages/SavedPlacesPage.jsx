import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SavedPlaces from "../components/SavedPlaces/SavedPlaces";
import PlaceDetail from "../components/PlaceDetail/PlaceDetail";
import { useAuth } from "../context/AuthContext";
import { useSupabaseSavedFolderSheet } from "../hooks/useSupabaseSavedFolderSheet";

export default function SavedPlacesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [detailPlace, setDetailPlace] = useState(null);
  const sheet = useSupabaseSavedFolderSheet(user?.id);

  const emptyHint = authLoading
    ? ""
    : user
      ? sheet.error
      : "로그인하면 홈에서 저장한 장소가 여기에 보여요.";

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button type="button" onClick={() => navigate(-1)} style={styles.backButton}>
          ← 뒤로
        </button>
      </div>

      <SavedPlaces
        open={true}
        folders={sheet.folders}
        savedPlacesByFolder={sheet.savedPlacesByFolder}
        onClose={() => navigate(-1)}
        onOpenPlaceDetail={setDetailPlace}
        onCreateFolder={user ? sheet.createFolder : undefined}
        onUpdateFolder={user ? sheet.updateFolder : undefined}
        onDeleteFolder={user ? sheet.deleteFolder : undefined}
        loading={authLoading || sheet.loading}
        emptyHint={emptyHint}
      />

      <PlaceDetail
        place={detailPlace}
        isSaved={Boolean(detailPlace)}
        onClose={() => setDetailPlace(null)}
        onSave={() => {}}
      />
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#111111",
  },
  topBar: {
    position: "fixed",
    top: 12,
    left: 0,
    right: 0,
    zIndex: 100,
    display: "flex",
    justifyContent: "flex-start",
    padding: "0 16px",
    pointerEvents: "none",
  },
  backButton: {
    pointerEvents: "auto",
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "10px 14px",
    fontWeight: 700,
  },
};
