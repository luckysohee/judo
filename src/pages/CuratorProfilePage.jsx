import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchCuratorRowByRouteKey } from "../utils/curatorRoute";
import { syncAuthProviderToProfile } from "../lib/syncAuthProviderToProfile";
import { useAuth } from "../context/AuthContext";
import { fetchUserPickedPlaces } from "../api/placePicks";
import PickUserButton, {
  PickCountsRow,
} from "../components/PickUserButton/PickUserButton";
import PlacePicksPublicList from "../components/PlacePick/PlacePicksPublicList";
import MapView from "../components/Map/MapView";
import {
  buildHomeCuratorPlaceFocusState,
} from "../utils/homeCuratorPlaceNavigation";
import { formatCuratorProfilePlacesForMapView } from "../utils/formatCuratorProfilePlacesForHomeMap";
import { fetchPlacesForCuratorPage } from "../utils/supabasePlaces";
import { placePickJoinRowToDetailPlace } from "../utils/placePickRowDisplay";
import PlaceDetail from "../components/PlaceDetail/PlaceDetail";
import { isPlaceSaved } from "../utils/storage";
import { getPickCounts } from "../utils/userProfileFollows";
import {
  getCuratorArchiveStats,
  buildCuratorArchiveVibes,
} from "../api/courseCompletionStats";

export default function CuratorProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const decodedSlug = slug ? decodeURIComponent(slug) : "";

  const [curator, setCurator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profilePickRows, setProfilePickRows] = useState([]);
  const [profilePicksLoading, setProfilePicksLoading] = useState(false);
  const [recommendedPlaces, setRecommendedPlaces] = useState([]);
  const [recommendedPlacesLoading, setRecommendedPlacesLoading] = useState(false);
  const [pickDetailPlace, setPickDetailPlace] = useState(null);
  const [receivedPickCount, setReceivedPickCount] = useState(0);
  const [outgoingPickCount, setOutgoingPickCount] = useState(0);
  const [mutual, setMutual] = useState(false);
  const [routeArchiveVibe, setRouteArchiveVibe] = useState({
    headline: null,
    whisper: null,
  });

  const profileUserId = curator?.user_id ?? null;
  const isSelf = Boolean(user?.id && profileUserId && user.id === profileUserId);

  const onPickCountsChange = useCallback(({ received, outgoing }) => {
    setReceivedPickCount(received);
    setOutgoingPickCount(outgoing);
  }, []);

  const onRelationshipChange = useCallback(({ mutual: m }) => {
    setMutual(Boolean(m));
  }, []);

  const fetchCurator = useCallback(async () => {
    if (!decodedSlug) {
      setCurator(null);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchCuratorRowByRouteKey(supabase, decodedSlug);
      setCurator(data);
    } catch (error) {
      console.error("fetch curator error:", error);
    } finally {
      setLoading(false);
    }
  }, [decodedSlug]);

  useEffect(() => {
    setLoading(true);
    void fetchCurator();
  }, [fetchCurator]);

  useEffect(() => {
    const uid = curator?.user_id;
    if (!uid) {
      setProfilePickRows([]);
      return undefined;
    }
    let cancelled = false;
    setProfilePicksLoading(true);
    fetchUserPickedPlaces(uid, { limit: 200 })
      .then((rows) => {
        if (!cancelled) setProfilePickRows(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        console.warn("CuratorProfilePage place_picks:", e);
        if (!cancelled) setProfilePickRows([]);
      })
      .finally(() => {
        if (!cancelled) setProfilePicksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [curator?.user_id]);

  useEffect(() => {
    if (!curator) {
      setRecommendedPlaces([]);
      return undefined;
    }
    let cancelled = false;
    setRecommendedPlacesLoading(true);
    void fetchPlacesForCuratorPage(curator)
      .then((rows) => {
        if (!cancelled) setRecommendedPlaces(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        console.warn("CuratorProfilePage curator_places:", e);
        if (!cancelled) setRecommendedPlaces([]);
      })
      .finally(() => {
        if (!cancelled) setRecommendedPlacesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [curator]);

  const recommendedMapPlaces = useMemo(
    () =>
      formatCuratorProfilePlacesForMapView(
        recommendedPlaces,
        curator?.display_name || curator?.name
      ),
    [recommendedPlaces, curator?.display_name, curator?.name]
  );

  const openRecommendedPlaceOnHomeMap = useCallback(
    (place) => {
      const placeId = String(place?.id ?? "").trim();
      const navState = buildHomeCuratorPlaceFocusState({
        curatorUserId: curator?.user_id,
        placeId,
      });
      if (navState && placeId) navigate("/", { state: navState });
    },
    [curator?.user_id, navigate]
  );

  useEffect(() => {
    const uid = curator?.user_id;
    if (!uid) {
      setRouteArchiveVibe({ headline: null, whisper: null });
      return undefined;
    }
    let cancelled = false;
    void getCuratorArchiveStats(uid).then((stats) => {
      if (cancelled) return;
      setRouteArchiveVibe(buildCuratorArchiveVibes(stats));
    });
    return () => {
      cancelled = true;
    };
  }, [curator?.user_id]);

  useEffect(() => {
    let cancelled = false;
    const uid = curator?.user_id;
    if (!uid) {
      setReceivedPickCount(0);
      setOutgoingPickCount(0);
      return undefined;
    }
    (async () => {
      try {
        const c = await getPickCounts(supabase, uid);
        if (!cancelled) {
          setReceivedPickCount(c.followers_count);
          setOutgoingPickCount(c.following_count);
        }
      } catch (e) {
        console.warn("CuratorProfilePage pick counts:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [curator?.user_id]);

  useEffect(() => {
    if (!user?.id) setMutual(false);
  }, [user?.id]);

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        불러오는 중...
      </div>
    );
  }

  if (!curator) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        큐레이터를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={styles.backButton}
        >
          ← 뒤로
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.profile}>
          <div style={styles.name}>{curator.display_name}</div>
          <div style={styles.bio}>{curator.bio || "주도 큐레이터입니다."}</div>

          {routeArchiveVibe.headline || routeArchiveVibe.whisper ? (
            <div style={styles.routeArchive}>
              {routeArchiveVibe.headline ? (
                <p style={styles.routeArchiveHeadline}>
                  {routeArchiveVibe.headline}
                </p>
              ) : null}
              {routeArchiveVibe.whisper ? (
                <p style={styles.routeArchiveWhisper}>
                  {routeArchiveVibe.whisper}
                </p>
              ) : null}
            </div>
          ) : null}

          <PickCountsRow
            profileUserId={profileUserId}
            receivedCount={receivedPickCount}
            outgoingCount={outgoingPickCount}
            mutual={Boolean(user?.id && !isSelf && mutual)}
            style={{ justifyContent: "center", marginBottom: 8 }}
          />

          {profileUserId ? (
            <div style={{ marginTop: 4 }}>
              <PickUserButton
                key={profileUserId}
                profileUserId={profileUserId}
                onPickCountsChange={onPickCountsChange}
                onRelationshipChange={onRelationshipChange}
                onBecomePicking={() => {
                  if (user)
                    void syncAuthProviderToProfile(supabase, user).catch(() => {});
                }}
                buttonStyle={{
                  padding: "12px 24px",
                  fontSize: 16,
                  borderRadius: 12,
                  marginTop: 0,
                }}
              />
            </div>
          ) : null}
        </div>

        <div style={styles.picksSection}>
          <div style={styles.picksTitle}>
            추천 장소
            {recommendedPlaces.length > 0 ? ` (${recommendedPlaces.length})` : ""}
          </div>
          <p style={styles.picksHint}>
            큐레이터가 등록한 추천 술집입니다. 마커를 누르면 홈 지도에서 볼 수
            있어요.
          </p>
          {recommendedPlacesLoading ? (
            <div style={styles.mapPlaceholder}>지도 불러오는 중…</div>
          ) : recommendedMapPlaces.length === 0 ? (
            <div style={styles.mapPlaceholder}>추천 장소가 없습니다</div>
          ) : (
            <div style={styles.mapWrap}>
              <MapView
                places={recommendedMapPlaces}
                selectedPlace={null}
                setSelectedPlace={(place) => {
                  if (place) openRecommendedPlaceOnHomeMap(place);
                }}
                showFloatingLocationButton={false}
                closePlacePreviewOnMapClick={false}
                skipKoreaBBoxForCuratorPins
                placesFitBoundsPadding={56}
              />
            </div>
          )}
        </div>

        <div style={{ ...styles.picksSection, marginTop: 32 }}>
          <div style={styles.picksTitle}>픽한 가게</div>
          <p style={styles.picksHint}>
            공개 추천(place_picks). 개인 저장 폴더와 별도입니다.
          </p>
          <PlacePicksPublicList
            rows={profilePickRows}
            loading={profilePicksLoading}
            showCuratorPickBadge
            onRowClick={(row) => {
              const placeId = String(
                row?.place_id ?? row?.places?.id ?? ""
              ).trim();
              const navState = buildHomeCuratorPlaceFocusState({
                curatorUserId: curator?.user_id,
                placeId,
              });
              if (navState && placeId) {
                navigate("/", { state: navState });
                return;
              }
              const p = placePickJoinRowToDetailPlace(row);
              if (p) setPickDetailPlace(p);
            }}
          />
        </div>
      </div>

      {pickDetailPlace ? (
        <PlaceDetail
          place={pickDetailPlace}
          isSaved={isPlaceSaved(pickDetailPlace.id)}
          onClose={() => setPickDetailPlace(null)}
          onSave={() => {}}
        />
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#111111",
    color: "#ffffff",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    padding: "16px",
    borderBottom: "1px solid #222222",
  },
  backButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: 700,
  },
  content: {
    padding: "20px",
  },
  profile: {
    textAlign: "center",
  },
  name: {
    fontSize: "28px",
    fontWeight: 800,
    marginBottom: "8px",
  },
  bio: {
    fontSize: "16px",
    color: "#bdbdbd",
    marginBottom: "16px",
    lineHeight: 1.5,
  },
  routeArchive: {
    maxWidth: "420px",
    margin: "0 auto 18px",
    padding: "12px 14px",
    borderRadius: "14px",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(26,26,30,0.95) 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  routeArchiveHeadline: {
    margin: "0 0 6px",
    fontSize: "14px",
    fontWeight: 750,
    lineHeight: 1.45,
    color: "rgba(250,250,255,0.92)",
    letterSpacing: "-0.02em",
  },
  routeArchiveWhisper: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "-0.01em",
  },
  picksSection: {
    marginTop: "28px",
    textAlign: "left",
    maxWidth: "480px",
    marginLeft: "auto",
    marginRight: "auto",
    padding: "0 4px",
  },
  picksTitle: {
    fontSize: "18px",
    fontWeight: 800,
    marginBottom: "6px",
  },
  picksHint: {
    fontSize: "13px",
    color: "#9a9a9a",
    margin: "0 0 12px",
    lineHeight: 1.45,
  },
  mapWrap: {
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #2a2a2a",
  },
  mapPlaceholder: {
    fontSize: 13,
    color: "#9a9a9a",
    textAlign: "center",
    padding: "56px 16px",
    borderRadius: 16,
    border: "1px solid #2a2a2a",
    background: "#171717",
  },
};
