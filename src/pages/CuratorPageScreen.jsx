import { useCallback, useEffect, useMemo, useState } from "react";
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
import { syncAuthProviderToProfile } from "../lib/syncAuthProviderToProfile";
import { getPickCounts } from "../utils/userProfileFollows";
import { fetchPlacesForCuratorPage } from "../utils/supabasePlaces";
import {
  fetchCuratorLiveStatus,
  setCuratorLiveStatus,
  subscribeCuratorLiveStatus,
} from "../utils/supabaseLive";
import { fetchUserPickedPlaces } from "../api/placePicks";
import { rewriteLegacySupabaseStorageUrl } from "../utils/rewriteLegacySupabaseStorageUrl";

export default function CuratorPageScreen() {
  const { name } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [detailPlace, setDetailPlace] = useState(null);
  const [curator, setCurator] = useState(null);
  const [curatorPlaces, setCuratorPlaces] = useState([]);
  const [curatorPickRows, setCuratorPickRows] = useState([]);
  const [receivedPickCount, setReceivedPickCount] = useState(0);
  const [outgoingPickCount, setOutgoingPickCount] = useState(0);
  const [mutual, setMutual] = useState(false);
  const [liveState, setLiveState] = useState(false);
  const [canEditLive, setCanEditLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const folders = useMemo(() => getFolders(), []);

  const onPickCountsChange = useCallback(({ received, outgoing }) => {
    setReceivedPickCount(received);
    setOutgoingPickCount(outgoing);
  }, []);

  const onRelationshipChange = useCallback(({ mutual: m }) => {
    setMutual(Boolean(m));
  }, []);

  const onBecomePicking = useCallback(() => {
    if (user) void syncAuthProviderToProfile(supabase, user).catch(() => {});
  }, [user]);

  useEffect(() => {
    const slug = decodeURIComponent(name || "");
    if (!slug) {
      setCurator(null);
      setCuratorPlaces([]);
      setCuratorPickRows([]);
      setReceivedPickCount(0);
      setOutgoingPickCount(0);
      setMutual(false);
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
          setCuratorPickRows([]);
          setReceivedPickCount(0);
          setOutgoingPickCount(0);
          setMutual(false);
          setLiveState(false);
          setCanEditLive(false);
          return;
        }

        const mappedCurator = {
          id: curatorRow.id,
          /** pick 관계의 대상 auth.users.id (모든 유저 pick 확장과 동일 키) */
          userId: curatorRow.user_id,
          name: curatorRow.name,
          displayName: curatorRow.display_name,
          subtitle: curatorRow.subtitle,
          bio: curatorRow.bio,
          avatar: rewriteLegacySupabaseStorageUrl(
            String(curatorRow.avatar_url || "").trim()
          ),
          color: curatorRow.color,
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

        const uid = curatorRow.user_id;
        const [placesRows, pickRowsRaw] = await Promise.all([
          fetchPlacesForCuratorPage(curatorRow),
          uid
            ? fetchUserPickedPlaces(uid, { limit: 200 }).catch((err) => {
                console.error("curator place_picks fetch:", err);
                return [];
              })
            : Promise.resolve([]),
        ]);

        if (!mounted) return;

        setCuratorPickRows(Array.isArray(pickRowsRaw) ? pickRowsRaw : []);

        try {
          if (uid) {
            const c = await getPickCounts(supabase, uid);
            if (!mounted) return;
            setReceivedPickCount(c.followers_count);
            setOutgoingPickCount(c.following_count);
          } else {
            setReceivedPickCount(0);
            setOutgoingPickCount(0);
          }
        } catch (countsErr) {
          console.warn("CuratorPageScreen pick counts:", countsErr);
        }
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
      } catch (error) {
        console.error("curator page fetch error:", error);
        if (!mounted) return;
        setCurator(null);
        setCuratorPlaces([]);
        setCuratorPickRows([]);
        setReceivedPickCount(0);
        setOutgoingPickCount(0);
        setMutual(false);
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

  useEffect(() => {
    if (!user?.id) setMutual(false);
  }, [user?.id]);

  const profileUserId = curator?.userId ?? null;
  const pickMutualVisible = Boolean(
    user?.id && profileUserId && user.id !== profileUserId && mutual,
  );

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
        pickedPlacesRows={curatorPickRows}
        pickedPlacesLoading={false}
        curatorColorMap={curatorColorMap}
        savedColorMap={savedColorMap}
        onClose={() => navigate(-1)}
        onOpenPlaceDetail={setDetailPlace}
        onSelectPlace={setDetailPlace}
        profileUserId={profileUserId}
        pickReceivedCount={receivedPickCount}
        pickOutgoingCount={outgoingPickCount}
        pickMutualVisible={pickMutualVisible}
        onPickCountsChange={onPickCountsChange}
        onRelationshipChange={onRelationshipChange}
        onBecomePicking={onBecomePicking}
        liveState={liveState}
        canEditLive={canEditLive}
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