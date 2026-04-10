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
  const initial = followerInitial(follower.label);
  return (
    <div style={styles.row}>
      <div style={styles.rowMain}>
        <div style={styles.avatarWrap} aria-hidden>
          {follower.avatarUrl && !imgErr ? (
            <img
              src={follower.avatarUrl}
              alt=""
              style={styles.avatarImg}
              onError={() => setImgErr(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span style={styles.avatarFallback}>{initial}</span>
          )}
        </div>
        <div style={styles.label} title={follower.label}>
          {follower.label}
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
        <p style={styles.sub}>최신순 · 최대 200명 · 프로필 사진이 있으면 함께 표시돼요</p>

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
  label: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#ecf0f1",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flex: 1,
  },
  date: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.45)",
    flexShrink: 0,
  },
};
