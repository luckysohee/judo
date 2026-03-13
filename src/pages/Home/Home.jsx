import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import SearchBar from "../../components/SearchBar/SearchBar";
import CuratorFilterBar from "../../components/CuratorFilterBar/CuratorFilterBar";
import MapView from "../../components/Map/MapView";
import PlacePreviewCard from "../../components/PlaceCard/PlacePreviewCard";
import PlaceDetail from "../../components/PlaceDetail/PlaceDetail";
import SaveFolderModal from "../../components/SaveFolderModal/SaveFolderModal";
import SavedPlaces from "../../components/SavedPlaces/SavedPlaces";
import CuratorPage from "../../components/CuratorPage/CuratorPage";
import PlaceList from "../../components/PlaceList/PlaceList";
import AddPlaceForm from "../../components/AddPlaceForm/AddPlaceForm";
import CuratorApplyForm from "../../components/CuratorApplyForm/CuratorApplyForm";

import { fetchSupabaseCurators } from "../../utils/supabaseCurators";
import { places } from "../../data/places";
import { curators as baseCurators } from "../../data/curators";
import {
  getFolders,
  getSavedPlacesMap,
  getPlaceFolderIds,
  getPrimarySavedFolderColor,
  isPlaceSaved,
  isCuratorFollowed,
  savePlaceToFolder,
  toggleFollowCurator,
} from "../../utils/storage";
import parseNaturalQuery from "../../utils/parseNaturalQuery";
import { getCustomPlaces } from "../../utils/customPlacesStorage";
import normalizeText from "../../utils/normalizeText";
import { isFuzzyMatch, levenshteinDistance } from "../../utils/fuzzyMatch";

const DEFAULT_TAG_POOL = [
  "노포",
  "소주",
  "맥주",
  "와인",
  "하이볼",
  "데이트",
  "2차",
  "1차",
  "혼술",
  "회식",
  "해산물",
  "안주맛집",
  "분위기",
  "심야",
];

function normalizeCurator(curator) {
  if (!curator) return null;

  return {
    id: curator.id || curator.slug || curator.name,
    name: curator.name || curator.slug || "",
    displayName:
      curator.displayName || curator.display_name || curator.name || "",
    aliases: Array.isArray(curator.aliases) ? curator.aliases : [],
    color: curator.color || "#2ECC71",
    subtitle: curator.subtitle || "주도 큐레이터",
    bio: curator.bio || "주도 큐레이터입니다.",
    avatar:
      curator.avatar ||
      curator.avatar_url ||
      "https://placehold.co/240x240?text=JU-DO",
    followers: curator.followers || curator.followers_count || 0,
    isPower: Boolean(curator.isPower || curator.is_power),
    createdAt: curator.createdAt || curator.created_at || null,
  };
}

const DEFAULT_SELECTED_CURATORS = (baseCurators || [])
  .map(normalizeCurator)
  .filter((curator) => curator?.isPower)
  .map((curator) => curator.name);

export default function Home() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [selectedCurators, setSelectedCurators] = useState(
    DEFAULT_SELECTED_CURATORS
  );
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [detailPlace, setDetailPlace] = useState(null);
  const [saveTargetPlace, setSaveTargetPlace] = useState(null);
  const [folders, setFolders] = useState([]);
  const [savedMap, setSavedMap] = useState({});
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);
  const [openedCurator, setOpenedCurator] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [customPlaces, setCustomPlaces] = useState([]);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [curatorApplyOpen, setCuratorApplyOpen] = useState(false);
  const [curatorFollowState, setCuratorFollowState] = useState(false);
  const [dbCurators, setDbCurators] = useState([]);

  useEffect(() => {
    refreshStorageState();
    refreshCustomPlaces();
    refreshDbCurators();
  }, []);

  useEffect(() => {
    if (openedCurator) {
      setCuratorFollowState(isCuratorFollowed(openedCurator.name));
    }
  }, [openedCurator]);

  const allPlaces = useMemo(() => {
    return [...customPlaces, ...places];
  }, [customPlaces]);

  const allCurators = useMemo(() => {
    const normalizedBase = (baseCurators || [])
      .map(normalizeCurator)
      .filter(Boolean);

    const normalizedDb = (dbCurators || [])
      .map(normalizeCurator)
      .filter(Boolean);

    const merged = [...normalizedBase, ...normalizedDb];
    const seen = new Set();

    return merged.filter((curator) => {
      if (!curator?.name) return false;
      if (seen.has(curator.name)) return false;
      seen.add(curator.name);
      return true;
    });
  }, [dbCurators]);

  const parsedQuery = useMemo(() => parseNaturalQuery(query), [query]);

  const searchSuggestions = useMemo(() => {
    try {
      const q = normalizeText(query);

      if (!q || q.length < 2) return [];

      const curatorSuggestions = (allCurators || [])
        .filter((curator) => {
          const candidateTexts = [
            curator?.name || "",
            curator?.displayName || "",
            ...(Array.isArray(curator?.aliases) ? curator.aliases : []),
          ];

          return candidateTexts.some((text) => {
            const normalized = normalizeText(text);
            return normalized.includes(q) || isFuzzyMatch(q, text);
          });
        })
        .map((curator) => {
          const candidateTexts = [
            curator?.name || "",
            curator?.displayName || "",
            ...(Array.isArray(curator?.aliases) ? curator.aliases : []),
          ].filter(Boolean);

          const score =
            candidateTexts.length > 0
              ? Math.min(
                  ...candidateTexts.map((text) => levenshteinDistance(q, text))
                )
              : 999;

          return {
            type: "큐레이터",
            label: curator?.displayName || curator?.name || "",
            actualName: curator?.name || "",
            score,
          };
        });

      const placeSuggestions = (allPlaces || [])
        .filter((place) => {
          const placeName = place?.name || "";
          return (
            normalizeText(placeName).includes(q) || isFuzzyMatch(q, placeName)
          );
        })
        .map((place) => ({
          type: "술집",
          label: place?.name || "",
          actualName: place?.name || "",
          score: levenshteinDistance(q, place?.name || ""),
        }));

      const tagSuggestions = DEFAULT_TAG_POOL.filter((tag) => {
        return normalizeText(tag).includes(q) || isFuzzyMatch(q, tag);
      }).map((tag) => ({
        type: "태그",
        label: tag,
        actualName: tag,
        score: levenshteinDistance(q, tag),
      }));

      const merged = [
        ...curatorSuggestions,
        ...placeSuggestions,
        ...tagSuggestions,
      ].filter((item) => item && item.label);

      const unique = [];
      const seen = new Set();

      for (const item of merged) {
        const key = `${item.type}-${normalizeText(item.label)}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
      }

      unique.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.label.length - b.label.length;
      });

      return unique.slice(0, 6).map(({ type, label, actualName }) => ({
        type,
        label,
        actualName,
      }));
    } catch (error) {
      console.error("searchSuggestions error:", error);
      return [];
    }
  }, [query, allPlaces, allCurators]);

  const filteredPlaces = useMemo(() => {
    let result = [...allPlaces];

    result = result.filter((place) => {
      return (
        selectedCurators.length === 0 ||
        place.curators.some((curatorName) =>
          selectedCurators.includes(curatorName)
        )
      );
    });

    if (parsedQuery.curator) {
      result = result.filter((place) =>
        place.curators.includes(parsedQuery.curator)
      );
    }

    if (parsedQuery.region) {
      result = result.filter((place) => place.region === parsedQuery.region);
    }

    if (parsedQuery.tags.length > 0) {
      result = result.filter((place) =>
        parsedQuery.tags.every((tag) => place.tags.includes(tag))
      );
    }

    if (parsedQuery.remainingText) {
      result = result.filter((place) => {
        const haystack = normalizeText(
          [
            place.name,
            place.region,
            place.primaryCurator,
            ...place.curators,
            ...place.tags,
            place.comment,
            place.address,
          ].join(" ")
        );

        return haystack.includes(normalizeText(parsedQuery.remainingText));
      });
    }

    if (parsedQuery.sortBySaved) {
      result.sort((a, b) => b.savedCount - a.savedCount);
    }

    if (parsedQuery.wantsWalkingDistance && currentLocation) {
      result.sort((a, b) => {
        const distanceA = getDistanceKm(currentLocation, {
          lat: a.lat,
          lng: a.lng,
        });
        const distanceB = getDistanceKm(currentLocation, {
          lat: b.lat,
          lng: b.lng,
        });
        return distanceA - distanceB;
      });
    }

    return result;
  }, [allPlaces, selectedCurators, parsedQuery, currentLocation]);

  useEffect(() => {
    if (!selectedPlace) return;

    const stillExists = filteredPlaces.some(
      (place) => place.id === selectedPlace.id
    );

    if (!stillExists) {
      setSelectedPlace(null);
    }
  }, [filteredPlaces, selectedPlace]);

  const todayCurator = useMemo(() => {
    const basePowerCurators = (baseCurators || [])
      .map(normalizeCurator)
      .filter((curator) => curator?.isPower);

    return basePowerCurators[0] || allCurators[0] || null;
  }, [allCurators]);

  const trendingCurators = useMemo(() => {
    const baseOnly = (baseCurators || [])
      .map(normalizeCurator)
      .filter((curator) => curator?.name !== todayCurator?.name);

    return baseOnly.slice(0, 3);
  }, [todayCurator]);

  const newCurators = useMemo(() => {
    const baseNames = new Set((baseCurators || []).map((item) => item.name));

    return (dbCurators || [])
      .map(normalizeCurator)
      .filter(Boolean)
      .filter((curator) => !baseNames.has(curator.name))
      .slice(0, 5);
  }, [dbCurators]);

  const newPlaces = useMemo(() => {
    return [...allPlaces]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);
  }, [allPlaces]);

  const curatorColorMap = useMemo(() => {
    return allCurators.reduce((acc, curator) => {
      acc[curator.name] = curator.color;
      return acc;
    }, {});
  }, [allCurators]);

  const savedColorMap = useMemo(() => {
    return allPlaces.reduce((acc, place) => {
      acc[place.id] = getPrimarySavedFolderColor(place.id, folders);
      return acc;
    }, {});
  }, [allPlaces, folders, savedMap]);

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

  const openedCuratorPlaces = useMemo(() => {
    if (!openedCurator) return [];
    return allPlaces.filter((place) =>
      place.curators.includes(openedCurator.name)
    );
  }, [openedCurator, allPlaces]);

  function refreshStorageState() {
    setFolders(getFolders());
    setSavedMap(getSavedPlacesMap());
  }

  function refreshCustomPlaces() {
    setCustomPlaces(getCustomPlaces());
  }

  async function refreshDbCurators() {
    try {
      const data = await fetchSupabaseCurators();
      setDbCurators(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("refreshDbCurators error:", error);
      setDbCurators([]);
    }
  }

  const handleCuratorToggle = (curatorName) => {
    setSelectedCurators((prev) => {
      if (prev.includes(curatorName)) {
        return prev.filter((name) => name !== curatorName);
      }
      return [...prev, curatorName];
    });
  };

  const handleSelectAllCurators = () => {
    setSelectedCurators(allCurators.map((curator) => curator.name));
  };

  const handleOpenSaveModal = (place) => {
    setSaveTargetPlace(place);
  };

  const handleSaveToFolder = (placeId, folderId) => {
    savePlaceToFolder(placeId, folderId);
    refreshStorageState();
  };

  const handleOpenCuratorByName = (curatorName) => {
    const curator = allCurators.find((item) => item.name === curatorName);

    if (curator) {
      setOpenedCurator(curator);
      setCuratorFollowState(isCuratorFollowed(curator.name));
    }
  };

  if (!todayCurator) {
    return (
      <div style={styles.page}>
        <Header />
        <div style={styles.content}>큐레이터 데이터를 불러오는 중입니다.</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Header />

      <div style={styles.content}>
        <TopActionRow
          onOpenSavedPlaces={() => navigate("/saved")}
          onOpenAddPlace={() => setAddPlaceOpen(true)}
          onOpenCuratorApply={() => setCuratorApplyOpen(true)}
          onOpenAdmin={() => navigate("/admin/applications")}
        />

        <SearchBar
          query={query}
          setQuery={setQuery}
          onExampleClick={setQuery}
          suggestions={searchSuggestions}
          placeholder="예: 을지로 2차 노포 / 도보로 가까운 해산물 안주"
        />

        {query.trim() ? (
          <SearchIntentSummary
            parsedQuery={parsedQuery}
            count={filteredPlaces.length}
          />
        ) : null}


        <div style={styles.mapSection}>
          <MapView
            places={filteredPlaces}
            selectedPlace={selectedPlace}
            setSelectedPlace={setSelectedPlace}
            curatorColorMap={curatorColorMap}
            savedColorMap={savedColorMap}
            onCurrentLocationChange={setCurrentLocation}
          />

          <div style={styles.mapFilterOverlay}>
            <CuratorFilterBar
              curators={allCurators}
              selectedCurators={selectedCurators}
              onToggle={handleCuratorToggle}
              onSelectAll={handleSelectAllCurators}
            />
          </div>
        </div>
{/* 
        <DiscoverySection
          todayCurator={todayCurator}
          trendingCurators={trendingCurators}
          newCurators={newCurators}
          // newPlaces={newPlaces}
          onCuratorClick={handleOpenCuratorByName}
          // onPlaceClick={setSelectedPlace}
        />        */}

{selectedPlace ? (
  <PlacePreviewCard
    place={selectedPlace}
    isSaved={isPlaceSaved(selectedPlace.id)}
    savedFolderColor={savedColorMap[selectedPlace.id]}
    onSave={handleOpenSaveModal}
    onOpenDetail={(place) => {
      setDetailPlace(place);
      navigate(`/place/${place.id}`);
    }}
    onOpenCurator={(curatorName) => {
      handleOpenCuratorByName(curatorName);
      navigate(`/curator/${encodeURIComponent(curatorName)}`);
    }}
    onClose={() => setSelectedPlace(null)}
  />
) : null}

{/* 기본 목록은 숨김. 마커 클릭 시 하단 카드로만 노출 */}
        {/*<PlaceList
          places={filteredPlaces}
          onSelectPlace={setSelectedPlace}
          onOpenDetail={(place) => {
            setDetailPlace(place);
            navigate(`/place/${place.id}`);
          }}
          onSave={handleOpenSaveModal}
          onOpenCurator={(curatorName) => {
            handleOpenCuratorByName(curatorName);
            navigate(`/curator/${encodeURIComponent(curatorName)}`);
          }}
          isPlaceSaved={isPlaceSaved}
          getSavedFolderColor={(placeId) => savedColorMap[placeId]}
        />*/}
      </div>

      <PlaceDetail
        place={detailPlace}
        isSaved={detailPlace ? isPlaceSaved(detailPlace.id) : false}
        onClose={() => setDetailPlace(null)}
        onSave={handleOpenSaveModal}
      />

      <SaveFolderModal
        open={!!saveTargetPlace}
        place={saveTargetPlace}
        folders={folders}
        savedFolderIds={
          saveTargetPlace ? getPlaceFolderIds(saveTargetPlace.id) : []
        }
        onClose={() => setSaveTargetPlace(null)}
        onSaveToFolder={handleSaveToFolder}
        onFoldersUpdated={refreshStorageState}
      />

      <SavedPlaces
        open={savedPlacesOpen}
        folders={folders}
        savedPlacesByFolder={savedPlacesByFolder}
        onClose={() => setSavedPlacesOpen(false)}
        onOpenPlaceDetail={(place) => {
          setSavedPlacesOpen(false);
          setDetailPlace(place);
          navigate(`/place/${place.id}`);
        }}
      />

      <CuratorPage
        open={!!openedCurator}
        curator={openedCurator}
        places={openedCuratorPlaces}
        curatorColorMap={curatorColorMap}
        savedColorMap={savedColorMap}
        onClose={() => setOpenedCurator(null)}
        onOpenPlaceDetail={(place) => {
          setOpenedCurator(null);
          setDetailPlace(place);
          navigate(`/place/${place.id}`);
        }}
        onSelectPlace={(place) => {
          setSelectedPlace(place);
        }}
        followState={curatorFollowState}
        onToggleFollow={() => {
          if (!openedCurator) return;
          const next = toggleFollowCurator(openedCurator.name);
          setCuratorFollowState(next.includes(openedCurator.name));
        }}
      />

      <AddPlaceForm
        open={addPlaceOpen}
        curators={allCurators}
        onClose={() => setAddPlaceOpen(false)}
        onAdded={refreshCustomPlaces}
      />

      <CuratorApplyForm
        open={curatorApplyOpen}
        onClose={() => setCuratorApplyOpen(false)}
      />
    </div>
  );
}

function TopActionRow({
  onOpenSavedPlaces,
  onOpenAddPlace,
  onOpenCuratorApply,
  onOpenAdmin,
}) {
  return (
    <div style={styles.topActionRow}>
      <button type="button" onClick={onOpenSavedPlaces} style={styles.actionButton}>
        ⭐ 내 저장
      </button>
      <button type="button" onClick={onOpenAddPlace} style={styles.actionButton}>
        + 술집 추가
      </button>
      <button type="button" onClick={onOpenCuratorApply} style={styles.actionButton}>
        신청
      </button>
      <button type="button" onClick={onOpenAdmin} style={styles.actionButton}>
        관리자
      </button>
    </div>
  );
}

function SearchIntentSummary({ parsedQuery, count }) {
  const chips = [];

  if (parsedQuery.region) chips.push(`지역: ${parsedQuery.region}`);
  if (parsedQuery.curator) chips.push(`큐레이터: ${parsedQuery.curator}`);
  parsedQuery.tags.forEach((tag) => chips.push(`태그: ${tag}`));
  if (parsedQuery.wantsWalkingDistance) chips.push("거리순");
  if (parsedQuery.sortBySaved) chips.push("저장순");

  return (
    <section style={styles.summaryWrap}>
      <div style={styles.summaryTop}>
        <div style={styles.summaryTitle}>AI 검색 해석</div>
        <div style={styles.summaryCount}>결과 {count}개</div>
      </div>

      <div style={styles.discoveryRow}>
        {chips.length > 0 ? (
          chips.map((chip) => (
            <span key={chip} style={styles.summaryChip}>
              {chip}
            </span>
          ))
        ) : (
          <span style={styles.summaryChip}>일반 키워드 검색</span>
        )}
      </div>
    </section>
  );
}

function DiscoverySection({
  todayCurator,
  trendingCurators,
  newCurators,
  // newPlaces,
  onCuratorClick,
  // onPlaceClick,
}) {
  return (
    <section style={styles.discoverySection}>
      <div style={styles.discoveryBlock}>
        <div style={styles.discoveryTitle}>🔥 오늘의 큐레이터</div>
        <button
          type="button"
          onClick={() => onCuratorClick(todayCurator.name)}
          style={{
            ...styles.discoveryCard,
            borderColor: todayCurator.color,
          }}
        >
          <div style={styles.discoveryCardTitle}>
            {todayCurator.displayName || todayCurator.name}
          </div>
          <div style={styles.discoveryCardText}>{todayCurator.subtitle}</div>
        </button>
      </div>

      <div style={styles.discoveryBlock}>
        <div style={styles.discoveryTitle}>📈 떠오르는 큐레이터</div>
        <div style={styles.discoveryRow}>
          {trendingCurators.map((curator) => (
            <button
              key={curator.id}
              type="button"
              onClick={() => onCuratorClick(curator.name)}
              style={{
                ...styles.smallChip,
                borderColor: curator.color,
              }}
            >
              {curator.displayName || curator.name}
            </button>
          ))}
        </div>
      </div>

      {Array.isArray(newCurators) && newCurators.length > 0 ? (
        <div style={styles.discoveryBlock}>
          <div style={styles.discoveryTitle}>🆕 NEW 큐레이터</div>
          <div style={styles.discoveryRow}>
            {newCurators.map((curator) => (
              <button
                key={curator.id}
                type="button"
                onClick={() => onCuratorClick(curator.name)}
                style={{
                  ...styles.smallChip,
                  borderColor: curator.color,
                }}
              >
                NEW · {curator.displayName || curator.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* <div style={styles.discoveryBlock}>
        <div style={styles.discoveryTitle}>🆕 신상 술집</div>
        <div style={styles.discoveryRow}>
          {newPlaces.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => onPlaceClick(place)}
              style={styles.smallChip}
            >
              {place.name}
            </button>
          ))}
        </div>
      </div> */}
    </section>
  );
}

function getDistanceKm(from, to) {
  const toRad = (value) => (value * Math.PI) / 180;

  const R = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#111111",
    color: "#ffffff",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  content: {
    padding: "12px 16px 24px",
  },
  topActionRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "14px",
    flexWrap: "wrap",
  },
  actionButton: {
    flex: 1,
    minWidth: "90px",
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 700,
  },
  summaryWrap: {
    marginBottom: "14px",
    border: "1px solid #2a2a2a",
    backgroundColor: "#161616",
    borderRadius: "14px",
    padding: "12px",
  },
  summaryTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  summaryTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#ffffff",
  },
  summaryCount: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  summaryChip: {
    border: "1px solid #333333",
    backgroundColor: "#1f1f1f",
    color: "#f4f4f4",
    borderRadius: "999px",
    padding: "7px 10px",
    fontSize: "12px",
  },
  discoverySection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "16px",
  },
  discoveryBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  discoveryTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#f4f4f4",
  },
  discoveryCard: {
    border: "1px solid #333333",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "12px",
    textAlign: "left",
  },
  discoveryCardTitle: {
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "4px",
  },
  discoveryCardText: {
    fontSize: "13px",
    color: "#c9c9c9",
  },
  discoveryRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  smallChip: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "13px",
  },
    mapSection: {
    position: "relative",
    marginBottom: "16px",
  },
  mapFilterOverlay: {       //지도위에 띄우기
    position: "absolute",
    top: "56px",
    left: "12px",
    right: "12px",
    zIndex: 20,
    pointerEvents: "none",
  },
};