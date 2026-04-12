import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { fetchStudioFollowersEnriched } from "../../utils/studioFollowersFetch";

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
  const { user } = useAuth();
  const [curatorId, setCuratorId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    if (!curatorId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const list = await fetchStudioFollowersEnriched(supabase, curatorId);
      setRows(list);
    } catch (e) {
      console.warn("팔로워 목록:", e?.message || e);
      setErrorMessage(e?.message || "목록을 불러오지 못했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [curatorId]);

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
    if (!curatorId) return undefined;
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
  }, [curatorId, load]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button type="button" onClick={() => navigate("/studio")} style={styles.backButton}>
          ← 스튜디오
        </button>
        <h1 style={styles.title}>팔로워</h1>
      </div>

      <div style={styles.content}>
        <p style={styles.sub}>
          최신순 · 최대 200명 · 닉네임과 @핸들 표시 · 큐레이터 팔로워는 뱃지로 구분
        </p>

        {loading ? (
          <div style={styles.muted}>불러오는 중…</div>
        ) : errorMessage ? (
          <div style={styles.error}>{errorMessage}</div>
        ) : rows.length === 0 ? (
          <div style={styles.muted}>아직 팔로워가 없어요.</div>
        ) : (
          <div style={styles.list}>
            {rows.map((f, idx) => (
              <FollowerRow key={`${f.user_id}-${idx}`} follower={f} />
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 14px",
    borderRadius: "10px",
    backgroundColor: "#222",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  rowMain: {
    display: "flex",
    alignItems: "flex-start",
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
    marginTop: "2px",
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
    alignItems: "flex-start",
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
    marginTop: "2px",
    color: "#f1c40f",
    backgroundColor: "rgba(241, 196, 15, 0.12)",
    border: "1px solid rgba(241, 196, 15, 0.45)",
  },
  date: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.45)",
    flexShrink: 0,
    paddingTop: "3px",
    lineHeight: 1.35,
  },
};
