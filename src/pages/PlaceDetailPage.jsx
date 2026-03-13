import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PlaceDetail from "../components/PlaceDetail/PlaceDetail";
import { places } from "../data/places";
import { getCustomPlaces } from "../utils/customPlacesStorage";
import { isPlaceSaved } from "../utils/storage";

export default function PlaceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const allPlaces = useMemo(() => {
    return [...getCustomPlaces(), ...places];
  }, []);

  const place = allPlaces.find((item) => String(item.id) === String(id));

  if (!place) {
    return (
      <div style={styles.emptyPage}>
        <div style={styles.emptyText}>해당 술집을 찾을 수 없습니다.</div>
        <button type="button" onClick={() => navigate("/")} style={styles.button}>
          홈으로
        </button>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <PlaceDetail
        place={place}
        isSaved={isPlaceSaved(place.id)}
        onClose={() => navigate(-1)}
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