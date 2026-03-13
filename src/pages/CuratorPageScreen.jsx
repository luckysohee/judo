import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CuratorPage from "../components/CuratorPage/CuratorPage";
import PlaceDetail from "../components/PlaceDetail/PlaceDetail";
import { curators } from "../data/curators";
import { places } from "../data/places";
import { getCustomPlaces } from "../utils/customPlacesStorage";
import {
  getFolders,
  getPrimarySavedFolderColor,
  isPlaceSaved,
  toggleFollowCurator,
  isCuratorFollowed,
} from "../utils/storage";

export default function CuratorPageScreen() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [detailPlace, setDetailPlace] = useState(null);
  const [followState, setFollowState] = useState(
    name ? isCuratorFollowed(decodeURIComponent(name)) : false
  );

  const allPlaces = useMemo(() => {
    return [...getCustomPlaces(), ...places];
  }, []);

  const folders = useMemo(() => getFolders(), []);

  const curator = curators.find(
    (item) => item.name === decodeURIComponent(name || "")
  );

  const curatorPlaces = useMemo(() => {
    if (!curator) return [];
    return allPlaces.filter((place) => place.curators.includes(curator.name));
  }, [curator, allPlaces]);

  const curatorColorMap = useMemo(() => {
    return curators.reduce((acc, item) => {
      acc[item.name] = item.color;
      return acc;
    }, {});
  }, []);

  const savedColorMap = useMemo(() => {
    return allPlaces.reduce((acc, place) => {
      acc[place.id] = getPrimarySavedFolderColor(place.id, folders);
      return acc;
    }, {});
  }, [allPlaces, folders]);

  if (!curator) {
    return (
      <div style={styles.emptyPage}>
        <div style={styles.emptyText}>해당 큐레이터를 찾을 수 없습니다.</div>
        <button type="button" onClick={() => navigate("/")} style={styles.button}>
          홈으로
        </button>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button type="button" onClick={() => navigate(-1)} style={styles.backButton}>
          ← 뒤로
        </button>
      </div>

      <CuratorPage
        open={true}
        curator={curator}
        places={curatorPlaces}
        curatorColorMap={curatorColorMap}
        savedColorMap={savedColorMap}
        onClose={() => navigate(-1)}
        onOpenPlaceDetail={setDetailPlace}
        onSelectPlace={setDetailPlace}
        followState={followState}
        onToggleFollow={() => {
          const next = toggleFollowCurator(curator.name);
          setFollowState(next.includes(curator.name));
        }}
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
  emptyPage: {
    minHeight: "100vh",
    backgroundColor: "#111111",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px",
    padding: "20px",
  },
  emptyText: {
    fontSize: "16px",
  },
  button: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: 700,
  },
};