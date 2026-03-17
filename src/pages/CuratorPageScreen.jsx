import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CuratorPage from "../components/CuratorPage/CuratorPage";
import PlaceDetail from "../components/PlaceDetail/PlaceDetail";
import {
  getFolders,
  getPrimarySavedFolderColor,
  isPlaceSaved,
} from "../utils/storage";

import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  fetchMyFollowedCuratorIds,
  followCurator,
  unfollowCurator,
} from "../utils/supabaseFollows";
import { fetchPlacesByPrimaryCuratorId } from "../utils/supabasePlaces";
import {
  fetchCuratorLiveStatus,
  setCuratorLiveStatus,
  subscribeCuratorLiveStatus,
} from "../utils/supabaseLive";

export default function CuratorPageScreen() {
  const { name } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [detailPlace, setDetailPlace] = useState(null);
  const [curator, setCurator] = useState(null);
  const [curatorPlaces, setCuratorPlaces] = useState([]);
  const [followState, setFollowState] = useState(false);
  const [liveState, setLiveState] = useState(false);
  const [canEditLive, setCanEditLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const folders = useMemo(() => getFolders(), []);

  useEffect(() => {
    const slug = decodeURIComponent(name || "");
    if (!slug) {
      setCurator(null);
      setCuratorPlaces([]);
      setFollowState(false);
      setLiveState(false);
      setCanEditLive(false);
      setLoading(false);
      return;
    }

    let mounted = true;

    let unsubscribeLive = null;

    (async () => {
      try {
        setLoading(true);

        const { data: curatorRow, error: curatorError } = await supabase
          .from("curators")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (curatorError) {
          throw curatorError;
        }

        if (!mounted) return;

        if (!curatorRow) {
          setCurator(null);
          setCuratorPlaces([]);
          setFollowState(false);
          setLiveState(false);
          setCanEditLive(false);
          return;
        }

        const mappedCurator = {
          id: curatorRow.id,
          name: curatorRow.name,
          displayName: curatorRow.display_name,
          subtitle: curatorRow.subtitle,
          bio: curatorRow.bio,
          avatar: curatorRow.avatar_url,
          color: curatorRow.color,
          followers: Number(curatorRow.followers_count || 0),
        };

        setCurator(mappedCurator);

        setCanEditLive(Boolean(user?.id && curatorRow.user_id && curatorRow.user_id === user.id));

        try {
          const status = await fetchCuratorLiveStatus(curatorRow.id);
          if (!mounted) return;
          setLiveState(Boolean(status?.is_live));

          unsubscribeLive = subscribeCuratorLiveStatus(curatorRow.id, async () => {
            try {
              const next = await fetchCuratorLiveStatus(curatorRow.id);
              if (!mounted) return;
              setLiveState(Boolean(next?.is_live));
            } catch (error) {
              console.error("live status refresh error:", error);
            }
          });
        } catch (error) {
          console.error("fetchCuratorLiveStatus error:", error);
          setLiveState(false);
        }

        const placesRows = await fetchPlacesByPrimaryCuratorId(curatorRow.id);

        if (!mounted) return;

        const mappedPlaces = placesRows.map((row) => ({
          id: row.id,
          name: row.name,
          region: row.region,
          address: row.address,
          image: row.image_url,
          comment: row.comment,
          lat: row.lat,
          lng: row.lng,
          savedCount: Number(row.save_count || 0),
          curators: [curatorRow.name].filter(Boolean),
          primaryCurator: curatorRow.name,
          tags: [],
        }));

        setCuratorPlaces(mappedPlaces);

        if (user?.id) {
          const followedIds = await fetchMyFollowedCuratorIds(user.id);
          if (!mounted) return;
          setFollowState(followedIds.includes(curatorRow.id));
        } else {
          setFollowState(false);
        }
      } catch (error) {
        console.error("curator page fetch error:", error);
        if (!mounted) return;
        setCurator(null);
        setCuratorPlaces([]);
        setFollowState(false);
        setLiveState(false);
        setCanEditLive(false);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (typeof unsubscribeLive === "function") {
        unsubscribeLive();
      }
    };
  }, [name, user?.id]);

  const curatorColorMap = useMemo(() => {
    if (!curator) return {};
    return {
      [curator.name]: curator.color,
    };
  }, [curator]);

  const savedColorMap = useMemo(() => {
    return curatorPlaces.reduce((acc, place) => {
      acc[place.id] = getPrimarySavedFolderColor(place.id, folders);
      return acc;
    }, {});
  }, [curatorPlaces, folders]);

  if (loading) {
    return (
      <div style={styles.emptyPage}>
        <div style={styles.emptyText}>불러오는 중...</div>
      </div>
    );
  }

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
        liveState={liveState}
        canEditLive={canEditLive}
        onToggleFollow={async () => {
          if (!user?.id) {
            alert("팔로우하려면 로그인이 필요합니다.");
            return;
          }

          try {
            if (followState) {
              await unfollowCurator({ userId: user.id, curatorId: curator.id });
              setFollowState(false);
            } else {
              await followCurator({ userId: user.id, curatorId: curator.id });
              setFollowState(true);
            }
          } catch (error) {
            console.error("follow toggle error:", error);
            alert(error?.message || "팔로우 처리 중 오류가 발생했습니다.");
          }
        }}
        onToggleLive={async () => {
          try {
            await setCuratorLiveStatus({ curatorId: curator.id, isLive: !liveState });
            setLiveState((prev) => !prev);
          } catch (error) {
            console.error("toggle live error:", error);
            alert(error?.message || "LIVE 상태 변경 중 오류가 발생했습니다.");
          }
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