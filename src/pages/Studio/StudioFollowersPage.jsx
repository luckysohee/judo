import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import PickUserButton from "../../components/PickUserButton/PickUserButton";
import StudioScrollLayout from "../../components/Studio/StudioScrollLayout";
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
  const effectivePrimary =
    follower.isCurator && follower.curatorName
      ? follower.curatorName
      : (follower.primaryText ?? follower.label);
  const effectiveSecondary =
    follower.isCurator && follower.curatorSlug
      ? `@${String(follower.curatorSlug).replace(/^@+/, "")}`
      : follower.secondaryText;
  const initial = followerInitial(effectivePrimary || follower.label);
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
                {effectivePrimary}
              </div>
              {effectiveSecondary ? (
                <div style={styles.secondary}>{effectiveSecondary}</div>
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
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [handleQuery, setHandleQuery] = useState("");
  const [handleSearchLoading, setHandleSearchLoading] = useState(false);
  const [handleSearchError, setHandleSearchError] = useState("");
  const [handleSearchResults, setHandleSearchResults] = useState([]);
  const discoverMode = searchParams.get("discover") === "1";

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  }, [navigate]);

  /** tab picked | picks (URL ?tab=picks, 예전 following 호환) */
  const tab =
    searchParams.get("tab") === "picks" ||
    searchParams.get("tab") === "following"
      ? "picks"
      : "picked";

  const setTab = (next) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "picks") {
      nextParams.set("tab", "picks");
    } else {
      nextParams.delete("tab");
    }
    if (!discoverMode) {
      nextParams.delete("discover");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const load = useCallback(async () => {
    if (!user?.id) {
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
          : await fetchStudioFollowersEnriched(supabase, user.id, {
              byFollowingUserId: user.id,
            });
      setRows(list);
    } catch (e) {
      console.warn("picked / picks 목록:", e?.message || e);
      setErrorMessage(e?.message || "목록을 불러오지 못했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, tab]);

  const runHandleSearch = useCallback(async () => {
    const normalized = String(handleQuery || "")
      .replace(/^@+/, "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      setHandleSearchError("핸들을 입력해 주세요.");
      setHandleSearchResults([]);
      return;
    }

    setHandleSearchLoading(true);
    setHandleSearchError("");
    try {
      const [{ data: profiles, error: profileErr }, { data: curators, error: curErr }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .ilike("username", `${normalized}%`)
            .limit(30),
          supabase
            .from("curators")
            .select("user_id, username, name, avatar_url")
            .ilike("username", `${normalized}%`)
            .limit(30),
        ]);
      if (profileErr) throw profileErr;
      if (curErr) throw curErr;

      const byUserId = new Map();
      const selfId = String(user?.id || "");
      for (const p of profiles || []) {
        const userId = String(p?.id || "").trim();
        if (!userId || userId === selfId) continue;
        const username = String(p?.username || "").trim();
        if (!username) continue;
        const displayName = String(p?.display_name || "").trim();
        byUserId.set(userId, {
          userId,
          username,
          displayName: displayName || username || "사용자",
          avatarUrl: String(p?.avatar_url || "").trim() || null,
          isCurator: false,
        });
      }
      for (const c of curators || []) {
        const userId = String(c?.user_id || "").trim();
        if (!userId || userId === selfId) continue;
        const username = String(c?.username || "").trim();
        if (!username) continue;
        const displayName = String(c?.name || "").trim();
        const prev = byUserId.get(userId);
        byUserId.set(userId, {
          userId,
          username: prev?.username || username,
          displayName: displayName || prev?.displayName || username || "사용자",
          avatarUrl:
            String(c?.avatar_url || "").trim() ||
            prev?.avatarUrl ||
            null,
          isCurator: true,
        });
      }

      const mapped = [...byUserId.values()]
        .sort((a, b) => {
          const aExact = a.username.toLowerCase() === normalized ? 0 : 1;
          const bExact = b.username.toLowerCase() === normalized ? 0 : 1;
          if (aExact !== bExact) return aExact - bExact;
          return a.username.localeCompare(b.username, "ko");
        })
        .slice(0, 20);
      setHandleSearchResults(mapped);
      if (mapped.length === 0) {
        setHandleSearchError("일치하는 @닉네임이 없어요.");
      }
    } catch (e) {
      console.warn("handle search:", e?.message || e);
      setHandleSearchError(e?.message || "사용자 검색에 실패했습니다.");
      setHandleSearchResults([]);
    } finally {
      setHandleSearchLoading(false);
    }
  }, [handleQuery, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id || tab !== "picked") return undefined;
    const channel = supabase
      .channel(`studio_followers_page:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_profile_follows",
          filter: `following_id=eq.${user.id}`,
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

  useEffect(() => {
    if (!user?.id || tab !== "picks") return undefined;
    const channel = supabase
      .channel(`studio_following_page:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_profile_follows",
          filter: `follower_id=eq.${user.id}`,
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

  const listFilter = String(handleQuery || "")
    .replace(/^@+/, "")
    .trim()
    .toLowerCase();
  const filteredRows =
    !listFilter || discoverMode
      ? rows
      : rows.filter((r) => {
          const p = String(r?.primaryText || "").replace(/^@+/, "").toLowerCase();
          const s = String(r?.secondaryText || "").replace(/^@+/, "").toLowerCase();
          const l = String(r?.label || "").replace(/^@+/, "").toLowerCase();
          return p.includes(listFilter) || s.includes(listFilter) || l.includes(listFilter);
        });

  const subText =
    tab === "picks"
      ? "최신순 · 최대 200명 · 팔로우 중인 프로필(큐레이터/일반)"
      : "최신순 · 최대 200명 · 나를 팔로우한 사람 · 큐레이터는 뱃지";

  return (
    <StudioScrollLayout
      header={
        <div style={styles.header}>
          <button type="button" onClick={handleBack} style={styles.backButton}>
            ← 뒤로
          </button>
          <h1 style={styles.title}>picked · picks</h1>
        </div>
      }
      shellStyle={{ backgroundColor: "#1a1a1a", color: "#eee" }}
      mainStyle={{ padding: 0 }}
    >

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

        <div style={styles.searchCard}>
          <div style={styles.searchTitle}>
            {discoverMode ? "사용자 통합 검색 (@닉네임)" : "내 목록 검색 (@닉네임)"}
          </div>
          <div style={styles.searchRow}>
            <input
              value={handleQuery}
              onChange={(e) => setHandleQuery(e.target.value)}
              placeholder="@닉네임"
              style={styles.searchInput}
              onKeyDown={(e) => {
                if (discoverMode && e.key === "Enter") {
                  e.preventDefault();
                  void runHandleSearch();
                }
              }}
            />
            {discoverMode ? (
              <button
                type="button"
                onClick={() => void runHandleSearch()}
                style={styles.searchButton}
                disabled={handleSearchLoading}
              >
                {handleSearchLoading ? "검색 중…" : "검색"}
              </button>
            ) : null}
          </div>
          {!discoverMode ? (
            <div style={styles.searchHelp}>현재 picked/picks 목록에서만 필터링해요.</div>
          ) : null}
          {discoverMode && handleSearchError ? (
            <div style={styles.searchError}>{handleSearchError}</div>
          ) : null}
          {discoverMode && handleSearchResults.length > 0 ? (
            <div style={styles.searchResultList}>
              {handleSearchResults.map((u) => (
                <div key={u.userId} style={styles.searchResultRow}>
                  <button
                    type="button"
                    onClick={() => navigate(`/u/${u.userId}`)}
                    style={styles.searchResultMain}
                  >
                    <div
                      style={{
                        ...styles.avatarWrap,
                        ...(u.isCurator ? styles.avatarWrapCurator : {}),
                      }}
                      aria-hidden
                    >
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt=""
                          style={styles.avatarImg}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span
                          style={{
                            ...styles.avatarFallback,
                            ...(u.isCurator ? styles.avatarFallbackCurator : {}),
                          }}
                        >
                          {followerInitial(u.displayName)}
                        </span>
                      )}
                    </div>
                    <div style={styles.nameBlock}>
                      <div style={styles.primary}>{u.displayName}</div>
                      <div style={styles.secondary}>
                        @{u.username}
                        {u.isCurator ? " · 큐레이터" : ""}
                      </div>
                    </div>
                  </button>
                  <PickUserButton
                    profileUserId={u.userId}
                    onBecomePicking={() => {
                      void load();
                    }}
                    buttonStyle={styles.inlinePickButton}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {loading ? (
          <div style={styles.muted}>불러오는 중…</div>
        ) : errorMessage ? (
          <div style={styles.error}>{errorMessage}</div>
        ) : filteredRows.length === 0 ? (
          <div style={styles.muted}>{emptyMessage}</div>
        ) : (
          <div style={styles.list}>
            {filteredRows.map((f, idx) => (
              <FollowerRow
                key={`${tab}-${String(f.curator_id ?? f.user_id)}-${idx}`}
                follower={f}
              />
            ))}
          </div>
        )}
      </div>
    </StudioScrollLayout>
  );
}

const styles = {
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
  searchCard: {
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: "12px",
    marginBottom: "14px",
  },
  searchTitle: {
    fontSize: "13px",
    fontWeight: 700,
    marginBottom: "8px",
    color: "rgba(255,255,255,0.84)",
  },
  searchRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#141414",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px",
    outline: "none",
  },
  searchButton: {
    border: "none",
    borderRadius: "10px",
    padding: "10px 12px",
    backgroundColor: "#2f80ed",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },
  searchError: {
    marginTop: "8px",
    fontSize: "12px",
    color: "#ff8d8d",
  },
  searchHelp: {
    marginTop: "8px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.5)",
  },
  searchResultList: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  searchResultRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    backgroundColor: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    padding: "8px",
  },
  searchResultMain: {
    border: "none",
    background: "transparent",
    color: "inherit",
    padding: 0,
    minWidth: 0,
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    textAlign: "left",
  },
  inlinePickButton: {
    marginTop: 0,
    padding: "9px 14px",
    fontSize: "13px",
    whiteSpace: "nowrap",
    flexShrink: 0,
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
