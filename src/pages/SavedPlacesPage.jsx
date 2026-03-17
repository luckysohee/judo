import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SavedPlaces from "../components/SavedPlaces/SavedPlaces";
import PlaceDetail from "../components/PlaceDetail/PlaceDetail";
import { places } from "../data/places";
import { getCustomPlaces } from "../utils/customPlacesStorage";
import {
  getFolders,
  getSavedPlacesMap,
  isPlaceSaved,
} from "../utils/storage";

export default function SavedPlacesPage() {
  const navigate = useNavigate();
  const [detailPlace, setDetailPlace] = useState(null);

  const [folders, setFolders] = useState(() => getFolders());
  const [savedMap, setSavedMap] = useState(() => getSavedPlacesMap());

  const allPlaces = useMemo(() => [...getCustomPlaces(), ...places], []);

  useEffect(() => {
    const refresh = () => {
      setFolders(getFolders());
      setSavedMap(getSavedPlacesMap());
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("judo_storage_updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("judo_storage_updated", refresh);
    };
  }, []);

  const savedPlacesByFolder = useMemo(() => {
    const result = {};

    folders.forEach((folder) => {
      result[folder.id] = allPlaces.filter((place) => {
        const ids = savedMap[place.id] || [];
        return ids.includes(folder.id);
      });
    });

    return result;
  }, [folders, savedMap, allPlaces]);

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button type="button" onClick={() => navigate(-1)} style={styles.backButton}>
          ← 뒤로
        </button>
      </div>

      <SavedPlaces
        open={true}
        folders={folders}
        savedPlacesByFolder={savedPlacesByFolder}
        onClose={() => navigate(-1)}
        onOpenPlaceDetail={setDetailPlace}
      />

      <PlaceDetail
        place={detailPlace}
        isSaved={detailPlace ? isPlaceSaved(detailPlace.id) : false}
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