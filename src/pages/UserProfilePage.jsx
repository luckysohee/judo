import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { getPickCounts } from "../utils/userProfileFollows";
import PickUserButton, {
  PickCountsRow,
} from "../components/PickUserButton/PickUserButton";
import UserTastePreferencesSection from "../components/Onboarding/UserTastePreferencesSection";

export default function UserProfilePage() {
  const { userId: userIdParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isCurator, setIsCurator] = useState(false);
  const [receivedPickCount, setReceivedPickCount] = useState(0);
  const [outgoingPickCount, setOutgoingPickCount] = useState(0);
  const [mutual, setMutual] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const targetId = userIdParam ? String(userIdParam).trim() : "";
  const isSelf = Boolean(user?.id && targetId && user.id === targetId);

  const syncCounts = useCallback(async () => {
    if (!targetId) return;
    const c = await getPickCounts(supabase, targetId);
    setReceivedPickCount(c.followers_count);
    setOutgoingPickCount(c.following_count);
  }, [targetId]);

  useEffect(() => {
    let cancelled = false;
    if (!targetId) {
      setNotFound(true);
      setLoading(false);
      return undefined;
    }

    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const [{ data: prof }, { data: cur }] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name, username, avatar_url")
            .eq("id", targetId)
            .maybeSingle(),
          supabase
            .from("curators")
            .select("display_name, username, name, avatar_url")
            .eq("user_id", targetId)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (!prof && !cur) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const nick =
          String(
            cur?.display_name || cur?.name || prof?.display_name || ""
          ).trim() || "사용자";
        const rawHandle = String(cur?.username || prof?.username || "").trim();

        setDisplayName(nick);
        setHandle(rawHandle);
        setAvatarUrl(
          String(cur?.avatar_url || prof?.avatar_url || "").trim() || null
        );
        setIsCurator(Boolean(cur));

        await syncCounts();
      } catch (e) {
        console.warn("UserProfilePage:", e);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetId, syncCounts]);

  useEffect(() => {
    if (!user?.id) setMutual(false);
  }, [user?.id]);

  const onPickCountsChange = useCallback(
    ({ received, outgoing }) => {
      setReceivedPickCount(received);
      setOutgoingPickCount(outgoing);
    },
    []
  );

  const onRelationshipChange = useCallback(({ mutual: m }) => {
    setMutual(Boolean(m));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#fff" }}>
        불러오는 중…
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#fff" }}>
        프로필을 찾을 수 없습니다.
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              border: "1px solid #444",
              background: "#1a1a1a",
              color: "#fff",
              padding: "8px 14px",
              borderRadius: 8,
            }}
          >
            뒤로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "#eee",
        padding: 20,
      }}
    >
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          marginBottom: 16,
          border: "1px solid #444",
          background: "#1a1a1a",
          color: "#fff",
          padding: "8px 14px",
          borderRadius: 999,
        }}
      >
        ← 뒤로
      </button>

      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "#333",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}
            >
              {(displayName || "?").charAt(0)}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{displayName}</div>
          {handle ? (
            <div style={{ opacity: 0.75, marginTop: 4 }}>@{handle}</div>
          ) : null}
          {isCurator ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "#f1c40f" }}>
              큐레이터
            </div>
          ) : null}
        </div>
      </div>

      <PickCountsRow
        profileUserId={targetId}
        receivedCount={receivedPickCount}
        outgoingCount={outgoingPickCount}
        mutual={Boolean(user?.id && !isSelf && mutual)}
        style={{ marginTop: 20 }}
      />

      <PickUserButton
        key={targetId}
        profileUserId={targetId}
        onPickCountsChange={onPickCountsChange}
        onRelationshipChange={onRelationshipChange}
      />

      {isSelf ? (
        <div style={{ marginTop: 24, maxWidth: 420 }}>
          <UserTastePreferencesSection
            userId={user?.id}
            variant="studio"
          />
        </div>
      ) : null}
    </div>
  );
}
