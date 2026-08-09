import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchUserPickedPlaces } from "../api/placePicks";
import { getPickCounts } from "../utils/userProfileFollows";
import PickUserButton, {
  PickCountsRow,
} from "../components/PickUserButton/PickUserButton";
import PlacePicksPublicList from "../components/PlacePick/PlacePicksPublicList";
import UserTastePreferencesSection from "../components/Onboarding/UserTastePreferencesSection";
import {
  studioCoursesBtnGhost,
  studioCoursesBtnPrimary,
  studioCoursesCard,
  studioCoursesShell,
} from "./Studio/studioCoursesSharedStyles";
import { rewriteLegacySupabaseStorageUrl } from "../utils/rewriteLegacySupabaseStorageUrl";

const STUDIO = {
  shell: "#111111",
  card: "#1a1a1a",
  cell: "#222222",
  border: "rgba(255,255,255,0.1)",
  textMuted: "rgba(255,255,255,0.55)",
  textSoft: "rgba(255,255,255,0.65)",
  accent: "#2ECC71",
  accentBg: "rgba(46, 204, 113, 0.18)",
  accentBorder: "rgba(46, 204, 113, 0.45)",
};

function ProfileAvatar({ url, name, size = 88 }) {
  const initial = String(name || "?").charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        padding: 2,
        background: STUDIO.cell,
        flexShrink: 0,
        border: `1px solid ${STUDIO.border}`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          backgroundColor: STUDIO.cell,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.36,
          fontWeight: 800,
          color: "rgba(255,255,255,0.92)",
        }}
      >
        {url ? (
          <img
            src={url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            referrerPolicy="no-referrer"
          />
        ) : (
          initial
        )}
      </div>
    </div>
  );
}

function StatPill({ value, label }) {
  return (
    <div style={styles.statPill}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

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
  const [profilePickRows, setProfilePickRows] = useState([]);
  const [profilePicksLoading, setProfilePicksLoading] = useState(false);

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
          rewriteLegacySupabaseStorageUrl(
            String(cur?.avatar_url || prof?.avatar_url || "").trim()
          ) || null
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
    if (!targetId) {
      setProfilePickRows([]);
      return undefined;
    }
    let cancelled = false;
    setProfilePicksLoading(true);
    fetchUserPickedPlaces(targetId, { limit: 80 })
      .then((rows) => {
        if (!cancelled) setProfilePickRows(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        console.warn("UserProfilePage place_picks:", e);
        if (!cancelled) setProfilePickRows([]);
      })
      .finally(() => {
        if (!cancelled) setProfilePicksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  useEffect(() => {
    if (!user?.id) setMutual(false);
  }, [user?.id]);

  const onPickCountsChange = useCallback(({ received, outgoing }) => {
    setReceivedPickCount(received);
    setOutgoingPickCount(outgoing);
  }, []);

  const onRelationshipChange = useCallback(({ mutual: m }) => {
    setMutual(Boolean(m));
  }, []);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.headerBar}>
          <div style={styles.skeletonBack} />
        </div>
        <div style={styles.content}>
          <div style={styles.heroCard}>
            <div style={styles.skeletonAvatar} />
            <div style={styles.skeletonLineWide} />
            <div style={styles.skeletonLineNarrow} />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={styles.page}>
        <div style={styles.headerBar}>
          <button type="button" onClick={() => navigate(-1)} style={styles.backBtn}>
            ←
          </button>
        </div>
        <div style={styles.emptyWrap}>
          <div style={styles.emptyIcon}>👤</div>
          <p style={styles.emptyTitle}>프로필을 찾을 수 없어요</p>
          <p style={styles.emptyHint}>삭제되었거나 주소가 잘못됐을 수 있어요.</p>
          <button type="button" onClick={() => navigate(-1)} style={styles.backBtnPrimary}>
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerBar}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={styles.backBtn}
          aria-label="뒤로"
        >
          ←
        </button>
        <span style={styles.headerTitle}>프로필</span>
        <div style={{ width: 40 }} aria-hidden />
      </div>

      <div style={styles.content}>
        <div style={styles.heroCard}>
          <ProfileAvatar url={avatarUrl} name={displayName} size={92} />

          <h1 style={styles.displayName}>{displayName}</h1>
          {handle ? (
            <p style={styles.handle}>@{handle}</p>
          ) : (
            <p style={styles.handleMuted}>핸들 미설정</p>
          )}

          {isCurator ? (
            <span style={styles.curatorBadge}>큐레이터</span>
          ) : (
            <span style={styles.memberBadge}>잔 멤버</span>
          )}

          <div style={styles.statsRow}>
            <StatPill value={receivedPickCount} label="받은 픽" />
            <StatPill value={outgoingPickCount} label="내 픽" />
          </div>

          {mutual && !isSelf ? (
            <span style={styles.mutualBadge}>맞픽 — 서로 픽 중</span>
          ) : null}

          {!isSelf ? (
            <div style={styles.pickBtnWrap}>
              <PickUserButton
                key={targetId}
                profileUserId={targetId}
                onPickCountsChange={onPickCountsChange}
                onRelationshipChange={onRelationshipChange}
                buttonStyle={styles.pickBtn}
              />
            </div>
          ) : null}

          <PickCountsRow
            profileUserId={targetId}
            receivedCount={receivedPickCount}
            outgoingCount={outgoingPickCount}
            mutual={Boolean(user?.id && !isSelf && mutual)}
            style={styles.srOnlyPickCounts}
          />
        </div>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            픽한 가게
            {profilePickRows.length > 0 ? ` · ${profilePickRows.length}` : ""}
          </h2>
          <p style={styles.sectionHint}>
            공개로 올린 추천 장소예요. 저장 폴더와는 별개입니다.
          </p>
          <PlacePicksPublicList
            rows={profilePickRows}
            loading={profilePicksLoading}
          />
        </section>

        {isSelf ? (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>내 취향</h2>
            <p style={styles.sectionHint}>
              홈 추천·코스 초안에 반영돼요. 언제든 바꿀 수 있어요.
            </p>
            <div style={styles.tasteCard}>
              <UserTastePreferencesSection userId={user?.id} variant="studio" />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  page: {
    ...studioCoursesShell,
    position: "relative",
    minHeight: "100vh",
    paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
  },
  headerBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "max(12px, env(safe-area-inset-top, 0px)) 16px 12px",
    borderBottom: `1px solid ${STUDIO.border}`,
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: STUDIO.shell,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 750,
    letterSpacing: "-0.02em",
    color: "rgba(255,255,255,0.88)",
  },
  backBtn: {
    ...studioCoursesBtnGhost,
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderRadius: 8,
    fontSize: 18,
    fontWeight: 700,
  },
  backBtnPrimary: {
    ...studioCoursesBtnPrimary,
    marginTop: 8,
    padding: "12px 22px",
    borderRadius: 8,
    fontSize: 14,
  },
  content: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "20px 16px 32px",
  },
  heroCard: {
    ...studioCoursesCard,
    textAlign: "center",
    padding: "28px 20px 24px",
    marginBottom: 24,
  },
  displayName: {
    margin: "16px 0 4px",
    fontSize: 24,
    fontWeight: 850,
    letterSpacing: "-0.03em",
    lineHeight: 1.2,
    color: "#fff",
  },
  handle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: STUDIO.textSoft,
  },
  handleMuted: {
    margin: 0,
    fontSize: 13,
    color: STUDIO.textMuted,
  },
  memberBadge: {
    display: "inline-block",
    marginTop: 10,
    padding: "4px 11px",
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 750,
    letterSpacing: "0.02em",
    color: "rgba(255,255,255,0.78)",
    background: "rgba(255,255,255,0.07)",
    border: `1px solid ${STUDIO.border}`,
  },
  curatorBadge: {
    display: "inline-block",
    marginTop: 10,
    padding: "4px 11px",
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 750,
    color: STUDIO.accent,
    background: STUDIO.accentBg,
    border: `1px solid ${STUDIO.accentBorder}`,
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 20,
    maxWidth: 280,
    marginLeft: "auto",
    marginRight: "auto",
  },
  statPill: {
    padding: "12px 10px",
    borderRadius: 12,
    backgroundColor: STUDIO.cell,
    border: `1px solid ${STUDIO.border}`,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 850,
    fontVariantNumeric: "tabular-nums",
    color: "#fff",
    lineHeight: 1.1,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: 650,
    color: STUDIO.textMuted,
    letterSpacing: "-0.01em",
  },
  mutualBadge: {
    display: "inline-block",
    marginTop: 12,
    padding: "5px 12px",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 800,
    color: STUDIO.accent,
    background: STUDIO.accentBg,
    border: `1px solid ${STUDIO.accentBorder}`,
  },
  pickBtnWrap: {
    marginTop: 18,
    maxWidth: 280,
    marginLeft: "auto",
    marginRight: "auto",
  },
  pickBtn: {
    width: "100%",
    padding: "13px 20px",
    fontSize: 15,
    fontWeight: 800,
    borderRadius: 8,
    marginTop: 0,
  },
  srOnlyPickCounts: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    margin: "0 0 6px",
    fontSize: 17,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "rgba(255,255,255,0.95)",
  },
  sectionHint: {
    margin: "0 0 14px",
    fontSize: 12,
    lineHeight: 1.45,
    color: STUDIO.textMuted,
  },
  tasteCard: {
    ...studioCoursesCard,
    padding: "14px 14px 12px",
    marginBottom: 0,
  },
  emptyWrap: {
    padding: "48px 24px",
    textAlign: "center",
    maxWidth: 320,
    margin: "0 auto",
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
    opacity: 0.6,
  },
  emptyTitle: {
    margin: "0 0 8px",
    fontSize: 18,
    fontWeight: 800,
    color: "#fff",
  },
  emptyHint: {
    margin: "0 0 20px",
    fontSize: 13,
    lineHeight: 1.5,
    color: STUDIO.textMuted,
  },
  skeletonBack: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: STUDIO.cell,
  },
  skeletonAvatar: {
    width: 92,
    height: 92,
    borderRadius: "50%",
    margin: "0 auto",
    backgroundColor: STUDIO.cell,
  },
  skeletonLineWide: {
    height: 22,
    width: "55%",
    margin: "16px auto 8px",
    borderRadius: 8,
    backgroundColor: STUDIO.cell,
  },
  skeletonLineNarrow: {
    height: 14,
    width: "32%",
    margin: "0 auto",
    borderRadius: 6,
    backgroundColor: STUDIO.cell,
  },
};
