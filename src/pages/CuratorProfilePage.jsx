import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { syncAuthProviderToProfile } from "../lib/syncAuthProviderToProfile";
import { useAuth } from "../context/AuthContext";
import { fetchUserPickedPlaces } from "../api/placePicks";
import PickUserButton, {
  PickCountsRow,
} from "../components/PickUserButton/PickUserButton";
import PlacePicksPublicList from "../components/PlacePick/PlacePicksPublicList";
import { placePickJoinRowToDetailPlace } from "../utils/placePickRowDisplay";
import PlaceDetail from "../components/PlaceDetail/PlaceDetail";
import { isPlaceSaved } from "../utils/storage";
import { getPickCounts } from "../utils/userProfileFollows";

export default function CuratorProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const decodedSlug = slug ? decodeURIComponent(slug) : "";

  const [curator, setCurator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profilePickRows, setProfilePickRows] = useState([]);
  const [profilePicksLoading, setProfilePicksLoading] = useState(false);
  const [pickDetailPlace, setPickDetailPlace] = useState(null);
  const [receivedPickCount, setReceivedPickCount] = useState(0);
  const [outgoingPickCount, setOutgoingPickCount] = useState(0);
  const [mutual, setMutual] = useState(false);

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
      const { data, error } = await supabase
        .from("curators")
        .select("*")
        .eq("slug", decodedSlug)
        .single();

      if (error) throw error;
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
          <div style={styles.picksTitle}>픽한 가게</div>
          <p style={styles.picksHint}>
            공개 추천(place_picks). 개인 저장 폴더와 별도입니다.
          </p>
          <PlacePicksPublicList
            rows={profilePickRows}
            loading={profilePicksLoading}
            showCuratorPickBadge
            onRowClick={(row) => {
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
};
