import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  fetchStudioFollowersEnriched,
  fetchStudioFollowingEnriched,
} from "../../utils/studioFollowersFetch";

function followerInitial(label) {
  const s = String(label || "?").trim();
  if (!s) return "?";
  const c = s.replace(/^@\s*/, "").charAt(0);
  return c ? c.toUpperCase() : "?";
}

function FollowerRow({ follower }) {
  const [imgErr, setImgErr] = useState(false);
  const initial = followerInitial(follower.primaryText || follower.label);
  return (
    <div style={styles.row}>
      <div style={styles.rowMain}>
        <div
          style={{
            ...styles.avatarWrap,
            ...(follower.isCurator ? styles.avatarWrapCurator : {}),
          }}
          aria-hidden
        >
          {follower.avatarUrl && !imgErr ? (
            <img
              src={follower.avatarUrl}
              alt=""
              style={styles.avatarImg}
              onError={() => setImgErr(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              style={{
                ...styles.avatarFallback,
                ...(follower.isCurator ? styles.avatarFallbackCurator : {}),
              }}
            >
              {initial}
            </span>
          )}
        </div>
        <div style={styles.textCol} title={follower.label}>
          <div style={styles.labelRow}>
            <div style={styles.nameBlock}>
              <div style={styles.primary}>
                {follower.primaryText ?? follower.label}
              </div>
              {follower.secondaryText ? (
                <div style={styles.secondary}>{follower.secondaryText}</div>
              ) : null}
            </div>
            {follower.isCurator ? (
              <span style={styles.curatorBadge}>큐레이터</span>
            ) : null}
          </div>
        </div>
      </div>
      <div style={styles.date}>
        {follower.created_at
          ? new Date(follower.created_at).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "—"}
      </div>
    </div>
  );
}

export default function StudioFollowersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [curatorId, setCuratorId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  /** tab picked | picks (URL ?tab=picks, 예전 following 호환) */
  const tab =
    searchParams.get("tab") === "picks" ||
    searchParams.get("tab") === "following"
      ? "picks"
      : "picked";

  const setTab = (next) => {
    if (next === "picks") {
      setSearchParams({ tab: "picks" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const load = useCallback(async () => {
    if (!curatorId || !user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const list =
        tab === "picks"
          ? await fetchStudioFollowingEnriched(supabase, user.id)
          : await fetchStudioFollowersEnriched(supabase, curatorId);
      setRows(list);
    } catch (e) {
      console.warn("picked / picks 목록:", e?.message || e);
      setErrorMessage(e?.message || "목록을 불러오지 못했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [curatorId, user?.id, tab]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setCuratorId(null);
      setLoading(false);
      return undefined;
    }
    (async () => {
      const { data, error } = await supabase
        .from("curators")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data?.id) {
        navigate("/studio", { replace: true });
        return;
      }
      setCuratorId(data.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!curatorId || tab !== "picked") return undefined;
    const channel = supabase
      .channel(`studio_followers_page:${curatorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_follows",
          filter: `curator_id=eq.${curatorId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [curatorId, tab, load]);

  useEffect(() => {
    if (!user?.id || tab !== "picks") return undefined;
    const channel = supabase
      .channel(`studio_following_page:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_follows",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, tab, load]);

  const emptyMessage =
    tab === "picks"
      ? "아직 picks가 없어요."
      : "아직 picked가 없어요.";

  const subText =
    tab === "picks"
      ? "최신순 · 최대 200명 · picks 큐레이터 닉네임과 @핸들"
      : "최신순 · 최대 200명 · 닉네임과 @핸들 · 큐레이터는 뱃지로 구분";

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button type="button" onClick={() => navigate("/studio")} style={styles.backButton}>
          ← 스튜디오
        </button>
        <h1 style={styles.title}>picked · picks</h1>
      </div>

      <div style={styles.content}>
        <div style={styles.tabBar} role="tablist" aria-label="picked 또는 picks">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "picked"}
            style={{
              ...styles.tab,
              ...(tab === "picked" ? styles.tabActive : {}),
            }}
            onClick={() => setTab("picked")}
          >
            picked
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "picks"}
            style={{
              ...styles.tab,
              ...(tab === "picks" ? styles.tabActive : {}),
            }}
            onClick={() => setTab("picks")}
          >
            picks
          </button>
        </div>

        <p style={styles.sub}>{subText}</p>

        {loading ? (
          <div style={styles.muted}>불러오는 중…</div>
        ) : errorMessage ? (
          <div style={styles.error}>{errorMessage}</div>
        ) : rows.length === 0 ? (
          <div style={styles.muted}>{emptyMessage}</div>
        ) : (
          <div style={styles.list}>
            {rows.map((f, idx) => (
              <FollowerRow
                key={`${tab}-${String(f.curator_id ?? f.user_id)}-${idx}`}
                follower={f}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#1a1a1a",
    color: "#eee",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px 20px",
    borderBottom: "1px solid #333",
    position: "sticky",
    top: 0,
    backgroundColor: "#1a1a1a",
    zIndex: 2,
  },
  backButton: {
    border: "none",
    background: "#333",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
  },
  title: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 800,
  },
  content: {
    maxWidth: "520px",
    margin: "0 auto",
    padding: "20px 18px 40px",
    boxSizing: "border-box",
  },
  tabBar: {
    display: "flex",
    gap: "8px",
    marginBottom: "14px",
    padding: "4px",
    borderRadius: "12px",
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  tab: {
    flex: 1,
    border: "none",
    borderRadius: "9px",
    padding: "10px 12px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "rgba(255,255,255,0.45)",
  },
  tabActive: {
    backgroundColor: "#333",
    color: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
  },
  sub: {
    margin: "0 0 16px 0",
    fontSize: "13px",
    color: "rgba(255,255,255,0.45)",
  },
  muted: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.5)",
    padding: "12px 0",
  },
  error: {
    fontSize: "14px",
    color: "#e74c3c",
    padding: "12px 0",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 14px",
    borderRadius: "10px",
    backgroundColor: "#222",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  rowMain: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
    flex: 1,
  },
  avatarWrap: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    backgroundColor: "#2c3e50",
    border: "2px solid rgba(255,255,255,0.12)",
  },
  avatarWrapCurator: {
    borderColor: "rgba(241, 196, 15, 0.55)",
    boxShadow: "0 0 0 1px rgba(241, 196, 15, 0.2)",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "17px",
    fontWeight: 800,
    color: "#ecf0f1",
    background: "linear-gradient(135deg, #3498db 0%, #8e44ad 100%)",
  },
  avatarFallbackCurator: {
    background: "linear-gradient(135deg, #f39c12 0%, #d35400 100%)",
  },
  textCol: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  labelRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
  nameBlock: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  primary: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#ecf0f1",
    lineHeight: 1.35,
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  secondary: {
    fontSize: "13px",
    fontWeight: 500,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.3,
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  curatorBadge: {
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.02em",
    padding: "3px 8px",
    borderRadius: "999px",
    flexShrink: 0,
    color: "#f1c40f",
    backgroundColor: "rgba(241, 196, 15, 0.12)",
    border: "1px solid rgba(241, 196, 15, 0.45)",
  },
  date: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.45)",
    flexShrink: 0,
    lineHeight: 1.35,
  },
};
