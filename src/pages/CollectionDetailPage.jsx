import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchCollectionDetail } from "../api/collections";
import CollectionCourseMap from "../components/Collections/CollectionCourseMap";

/**
 * 컬렉션 상세 — 제목/설명 + 코스 지도(번호 마커·Polyline) + 포함 장소 리스트(`order_index` 정렬).
 *
 * 비공개 컬렉션은 RLS 가 가리므로 본인 외에는 `null` 로 보이고 "찾을 수 없음" UI 가 노출된다.
 */
export default function CollectionDetailPage() {
  const { collectionId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!collectionId) {
        if (!cancelled) {
          setCollection(null);
          setErrorMsg("");
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setErrorMsg("");
      try {
        const row = await fetchCollectionDetail(collectionId);
        if (cancelled) return;
        setCollection(row);
      } catch (e) {
        if (cancelled) return;
        console.error("CollectionDetailPage load:", e);
        setErrorMsg(e?.message || "컬렉션을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  if (loading) {
    return (
      <div style={styles.page}>
        <BackButton onClick={() => navigate(-1)} />
        <div style={styles.helper}>불러오는 중…</div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={styles.page}>
        <BackButton onClick={() => navigate(-1)} />
        <div style={{ ...styles.helper, color: "#e74c3c" }}>{errorMsg}</div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div style={styles.page}>
        <BackButton onClick={() => navigate(-1)} />
        <div style={styles.helper}>해당 컬렉션을 찾을 수 없습니다.</div>
      </div>
    );
  }

  const description =
    typeof collection.description === "string"
      ? collection.description.trim()
      : "";
  const places = Array.isArray(collection.collection_places)
    ? collection.collection_places
    : [];

  return (
    <div style={styles.page}>
      <BackButton onClick={() => navigate(-1)} />

      <header style={styles.header}>
        <h1 style={styles.title}>{collection.title || "(제목 없음)"}</h1>
        {description ? (
          <p style={styles.desc}>{description}</p>
        ) : null}
        <div style={styles.metaRow}>
          <span style={styles.countChip}>장소 {places.length}</span>
          <span style={styles.publicChip}>
            {collection.visibility === "public" ? "공개" : "비공개"}
          </span>
        </div>
      </header>

      {places.length > 0 ? (
        <CollectionCourseMap collectionPlaces={places} />
      ) : null}

      <ol style={styles.list}>
        {places.length === 0 ? (
          <li style={styles.emptyItem}>이 컬렉션에 아직 장소가 없습니다.</li>
        ) : (
          places.map((row, idx) => (
            <PlaceRow key={row.id} order={idx + 1} row={row} />
          ))
        )}
      </ol>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} style={styles.backBtn}>
      ← 뒤로
    </button>
  );
}

function PlaceRow({ order, row }) {
  const place = row?.places || {};
  const memo = typeof row?.memo === "string" ? row.memo.trim() : "";
  const name =
    String(place.name || place.display_name || "이름 없음").trim() || "이름 없음";
  const address = String(place.address || place.road_address_name || "").trim();
  const image = String(place.image_url || place.thumbnail_url || "").trim();
  const placeId = String(place.id || "").trim();

  return (
    <li style={styles.row}>
      <div style={styles.rowOrder}>{order}</div>
      <div style={styles.rowThumb} aria-hidden="true">
        {image ? (
          <img
            src={image}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span style={styles.rowThumbInitial}>{name.charAt(0) || "·"}</span>
        )}
      </div>
      <div style={styles.rowBody}>
        {placeId ? (
          <a href={`/place/${placeId}`} style={styles.rowTitleLink}>
            {name}
          </a>
        ) : (
          <span style={styles.rowTitle}>{name}</span>
        )}
        {address ? <div style={styles.rowAddr}>{address}</div> : null}
        {memo ? <div style={styles.rowMemo}>“{memo}”</div> : null}
      </div>
    </li>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#111",
    color: "#eee",
    padding: 20,
    paddingBottom: 40,
  },
  backBtn: {
    border: "1px solid #444",
    background: "#1a1a1a",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 999,
    fontWeight: 700,
    marginBottom: 18,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    margin: "0 0 8px",
    color: "#fff",
    lineHeight: 1.25,
  },
  desc: {
    margin: "0 0 10px",
    color: "#bdbdbd",
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  countChip: {
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.4)",
    borderRadius: 999,
    padding: "3px 10px",
  },
  publicChip: {
    fontSize: 12,
    fontWeight: 700,
    color: "#bdbdbd",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 999,
    padding: "3px 10px",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  row: {
    display: "flex",
    gap: 12,
    alignItems: "stretch",
    background: "#1a1a1a",
    border: "1px solid #262626",
    borderRadius: 12,
    padding: 12,
  },
  rowOrder: {
    flexShrink: 0,
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.4)",
    color: "#2ecc71",
    fontWeight: 800,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  rowThumb: {
    flexShrink: 0,
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    background:
      "linear-gradient(135deg, rgba(46,204,113,0.3), rgba(52,152,219,0.3))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  rowThumbInitial: {
    fontSize: 20,
    fontWeight: 800,
    color: "rgba(255,255,255,0.85)",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
  },
  rowTitleLink: {
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
    textDecoration: "none",
  },
  rowAddr: {
    fontSize: 12,
    color: "#bdbdbd",
  },
  rowMemo: {
    fontSize: 12,
    color: "#9ad3a4",
    fontStyle: "italic",
    marginTop: 2,
  },
  emptyItem: {
    background: "#1a1a1a",
    border: "1px dashed #333",
    borderRadius: 12,
    padding: 24,
    textAlign: "center",
    color: "#888",
  },
  helper: {
    color: "#bdbdbd",
    padding: "20px 0",
    textAlign: "center",
  },
};
