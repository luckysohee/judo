import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../Toast/ToastProvider";
import { supabase } from "../../lib/supabase";
import { fetchMutualCheckins } from "../../utils/userActivity";
import {
  getJudoModeCopy,
  JUDO_CHECKIN_SCHEDULE_TOAST,
  JUDO_DAY_SIDE_STRIP_HINT,
} from "../../utils/judoOperationMode";
import PickUserButton from "../PickUserButton/PickUserButton";

const THREE_H_MS = 3 * 60 * 60 * 1000;
const POLL_MS = 90_000;

function userInitial(label) {
  const s = String(label || "?").trim();
  if (!s) return "?";
  const c = s.replace(/^@\s*/, "").charAt(0);
  return c ? c.toUpperCase() : "?";
}

function canonicalPlaceGroupKey(row) {
  const pid = row?.place_id;
  if (pid) return `id:${String(pid)}`;
  const raw = String(row?.raw_place_name || "").trim().toLowerCase().slice(0, 160);
  return `raw:${raw || "__blank"}`;
}

function pickRepresentativeRow(rows) {
  let best = null;
  for (const r of rows) {
    const t = Date.parse(String(r?.created_at ?? ""));
    const bt =
      best != null ? Date.parse(String(best?.created_at ?? "")) : NaN;
    if (best == null || (Number.isFinite(t) && t > bt)) best = r;
  }
  return best ?? rows[0];
}

function displayNick(row, profilesById) {
  const p = profilesById[row.user_id];
  const raw = String(p?.display_name || p?.username || "").trim();
  return raw || "아는 사람";
}

function maxCreatedMs(rows) {
  let t = 0;
  for (const r of rows) {
    const n = Date.parse(String(r.created_at ?? ""));
    if (Number.isFinite(n) && n > t) t = n;
  }
  return t;
}

function isRecentTier(rows) {
  const mx = maxCreatedMs(rows);
  return mx && Date.now() - mx <= THREE_H_MS;
}

/** “지금” / “N분 전” 등 — 상황 톤 */
function relativePresenceLabel(rows) {
  const mx = maxCreatedMs(rows);
  if (!mx) return null;
  const diff = Date.now() - mx;
  if (diff < 8 * 60 * 1000) return "지금";
  if (diff < 60 * 60 * 1000) {
    const m = Math.max(1, Math.floor(diff / 60000));
    return `${m}분 전`;
  }
  if (diff < THREE_H_MS) {
    const h = Math.floor(diff / (60 * 60 * 1000));
    const m = Math.floor((diff % (60 * 60 * 1000)) / 60000);
    return m > 0 ? `${h}시간 ${m}분 전` : `${h}시간 전`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const h = Math.max(1, Math.floor(diff / (60 * 60 * 1000)));
    return `${h}시간 전`;
  }
  return "오늘";
}

/** 장소별 2명+ 묶음 + 단건(place_id 또는 raw 이름 기준) */
function groupRowsForUi(rows) {
  const sorted = [...rows].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  const byKey = new Map();
  for (const r of sorted) {
    const k = canonicalPlaceGroupKey(r);
    if (!byKey.has(k)) byKey.set(k, []);
    const list = byKey.get(k);
    const seenUid = list.some((x) => x.user_id === r.user_id);
    if (!seenUid) list.push(r);
  }

  /** @type {Array<{ kind: 'group' | 'single', groupKey: string, rows: typeof rows }>} */
  const cards = [];

  const multiKeys = [...byKey.keys()].filter(
    (key) => byKey.get(key).length >= 2,
  );
  for (const key of multiKeys) {
    cards.push({
      kind: "group",
      groupKey: key,
      rows: byKey.get(key),
    });
  }

  for (const [key, list] of byKey) {
    if (list.length !== 1) continue;
    cards.push({
      kind: "single",
      groupKey: key,
      rows: [...list],
    });
  }

  cards.sort((a, b) => {
    const ar = isRecentTier(a.rows) ? 0 : 1;
    const br = isRecentTier(b.rows) ? 0 : 1;
    if (ar !== br) return ar - br;
    return maxCreatedMs(b.rows) - maxCreatedMs(a.rows);
  });

  return cards;
}

/** 짧은 장소 토막(한 줄 톤용) */
function placeSpot(row, placeNamesMap) {
  if (row.place_id && placeNamesMap[row.place_id]) {
    const s = String(placeNamesMap[row.place_id]).trim();
    if (!s) return "";
    return s.length > 20 ? `${s.slice(0, 19)}…` : s;
  }
  const raw = String(row.raw_place_name || "").trim();
  if (!raw || raw === "근처 술집") return "";
  const first = raw.split(/[|,·/]/)[0].trim();
  if (!first) return "";
  return first.length > 20 ? `${first.slice(0, 19)}…` : first;
}

function primaryLine(card, profilesById, placeNamesMap) {
  const recent = isRecentTier(card.rows);
  const representative = pickRepresentativeRow(card.rows);
  const spot = representative
    ? placeSpot(representative, placeNamesMap)
    : "";

  const names = card.rows.map((r) => displayNick(r, profilesById));
  const uniqueNames = [...new Set(names)];

  if (card.kind === "group" && uniqueNames.length >= 2) {
    const [n1, n2] = uniqueNames;
    const extra =
      uniqueNames.length > 2 ? ` 외${uniqueNames.length - 2}` : "";
    if (recent) {
      return spot ? `방금 ${n1}, ${n2}${extra} · ${spot}` : `${n1}, ${n2} 여기 있음`;
    }
    return spot ? `${n1}, ${n2} · ${spot} 근처 한잔` : `${n1}, ${n2} 여기 갔네`;
  }

  const one = uniqueNames[0] || "아는 사람";
  if (recent) {
    if (spot) return `${one} 방금 ${spot}`;
    return `${one} 여기 있음`;
  }
  if (spot) return `${one} ${spot} 근처에서 한잔함`;
  return `${one} 지금 한잔 중`;
}

function subtitleLine(card, profilesById, placeNamesMap) {
  const rel = relativePresenceLabel(card.rows);
  const representative = pickRepresentativeRow(card.rows);
  const addr = representative?.raw_address
    ? String(representative.raw_address).slice(0, 42)
    : "";
  const spot = representative ? placeSpot(representative, placeNamesMap) : "";
  const parts = [];
  if (rel && rel !== "지금") parts.push(rel);
  if (spot) parts.push(spot);
  else if (!representative?.place_id && representative?.raw_place_name)
    parts.push(String(representative.raw_place_name).slice(0, 44));
  if (addr) parts.push(addr);
  return parts.join(" · ") || "";
}

/**
 * 홈 우측: 맞픽 유저의 최근 한잔 한 줄(피드 아님).
 */
export default function MutualCheckinsHomeSection({
  user,
  onOpenPlaceDetail,
  onPickUserFromSearch,
  compact = false,
  stripMode = false,
  onSearchOpenChange,
  judoMode = null,
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const dayLocked = Boolean(judoMode?.isDayMode);
  const dayScheduleToast = useCallback(() => {
    const t = judoMode ? getJudoModeCopy(judoMode).checkInDisabledText : "";
    showToast(t || JUDO_CHECKIN_SCHEDULE_TOAST, "info", 3200);
  }, [judoMode, showToast]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [placeNames, setPlaceNames] = useState({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (typeof onSearchOpenChange === "function") {
      onSearchOpenChange(Boolean(searchOpen));
      return () => onSearchOpenChange(false);
    }
    return undefined;
  }, [searchOpen, onSearchOpenChange]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const list = await fetchMutualCheckins(supabase, { limit: 28 });
      setRows(list);
      const uids = [...new Set(list.map((r) => r.user_id))].filter(Boolean);
      const pids = [
        ...new Set(list.map((r) => r.place_id).filter(Boolean)),
      ];

      if (uids.length) {
        const pmap = {};
        const [{ data: profs, error: pe }, { data: curs, error: ce }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("id, display_name, username, avatar_url")
              .in("id", uids),
            supabase
              .from("curators")
              .select("user_id, slug, username, display_name, name, avatar_url")
              .in("user_id", uids),
          ]);
        if (pe) console.warn("mutual checkins profiles:", pe.message || pe);
        if (ce) console.warn("mutual checkins curators:", ce.message || ce);
        for (const p of profs || []) {
          if (p?.id) pmap[String(p.id)] = { ...p };
        }
        for (const c of curs || []) {
          const uid = c?.user_id != null ? String(c.user_id) : "";
          if (!uid) continue;
          const prev = pmap[uid] || { id: uid };
          const nick = String(
            c.display_name || c.name || prev.display_name || prev.username || "",
          ).trim();
          const handle = String(c.slug || c.username || prev.username || "").trim();
          pmap[uid] = {
            ...prev,
            id: uid,
            display_name: nick || prev.display_name,
            username: handle || prev.username,
            avatar_url: String(c.avatar_url || "").trim() || prev.avatar_url,
          };
        }
        setProfilesById(pmap);
      } else {
        setProfilesById({});
      }

      if (pids.length) {
        const { data: places, error: ple } = await supabase
          .from("places")
          .select("id, name")
          .in("id", pids);
        if (ple) console.warn("mutual checkins places:", ple.message || ple);
        const nmap = {};
        for (const p of places || []) {
          if (p?.id) nmap[String(p.id)] = String(p.name || "").trim();
        }
        setPlaceNames(nmap);
      } else {
        setPlaceNames({});
      }
    } catch (e) {
      console.warn("fetchMutualCheckins:", e?.message || e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const runHandleSearch = useCallback(async (rawQuery = searchQuery) => {
    const normalized = String(rawQuery || "")
      .replace(/^@+/, "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      setSearchError("핸들을 입력해 주세요.");
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    try {
      const [{ data: profiles, error: profileErr }, { data: curRows, error: curErr }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .or(`username.ilike.%${normalized}%,display_name.ilike.%${normalized}%`)
            .limit(30),
          supabase
            .from("curators")
            .select("user_id, slug, username, display_name, name, avatar_url")
            .or(
              `slug.ilike.%${normalized}%,username.ilike.%${normalized}%,display_name.ilike.%${normalized}%,name.ilike.%${normalized}%`
            )
            .limit(30),
        ]);
      if (profileErr) throw profileErr;
      if (curErr) throw curErr;
      const curators = Array.isArray(curRows) ? curRows : [];

      const byUserId = new Map();
      const selfId = String(user?.id || "");
      for (const p of profiles || []) {
        const uid = String(p?.id || "").trim();
        const username = String(p?.username || "").trim();
        if (!uid || uid === selfId || !username) continue;
        const displayName = String(p?.display_name || "").trim();
        byUserId.set(uid, {
          userId: uid,
          slug: username,
          name: displayName || username || "사용자",
          username,
          displayName: displayName || username || "사용자",
          avatarUrl: String(p?.avatar_url || "").trim() || null,
          isCurator: false,
        });
      }
      for (const c of curators || []) {
        const uid = String(c?.user_id || "").trim();
        const username = String(c?.slug || c?.username || "").trim();
        if (!uid || uid === selfId || !username) continue;
        const displayName = String(c?.name || c?.display_name || "").trim();
        const prev = byUserId.get(uid);
        byUserId.set(uid, {
          userId: uid,
          slug: username,
          name: displayName || prev?.name || username || "사용자",
          username: prev?.username || username,
          displayName: displayName || prev?.displayName || username || "사용자",
          avatarUrl: String(c?.avatar_url || "").trim() || prev?.avatarUrl || null,
          isCurator: true,
        });
      }

      const mapped = [...byUserId.values()]
        .filter((row) => {
          const u = String(row?.username || "").toLowerCase();
          const d = String(row?.displayName || "").toLowerCase();
          return u.includes(normalized) || d.includes(normalized);
        })
        .sort((a, b) => {
          const aU = String(a.username || "").toLowerCase();
          const bU = String(b.username || "").toLowerCase();
          const aD = String(a.displayName || "").toLowerCase();
          const bD = String(b.displayName || "").toLowerCase();
          const aExact = aU === normalized || aD === normalized ? 0 : 1;
          const bExact = bU === normalized || bD === normalized ? 0 : 1;
          if (aExact !== bExact) return aExact - bExact;
          return a.username.localeCompare(b.username, "ko");
        })
        .slice(0, 16);
      setSearchResults(mapped);
      if (mapped.length === 0) setSearchError("일치하는 닉네임이 없어요.");
    } catch (e) {
      console.warn("mutual handle search:", e?.message || e);
      setSearchError(e?.message || "사용자 검색에 실패했습니다.");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, user?.id]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const q = String(searchQuery || "")
      .replace(/^@+/, "")
      .trim();
    if (!q) {
      setSearchResults([]);
      setSearchError("");
      setSearchLoading(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void runHandleSearch(q);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [searchOpen, searchQuery, runHandleSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [user?.id, load]);

  const cards = useMemo(() => groupRowsForUi(rows), [rows]);

  const openPlace = async (placeId) => {
    if (!placeId || typeof onOpenPlaceDetail !== "function") return;
    try {
      const { data, error } = await supabase
        .from("places")
        .select(
          "id,name,lat,lng,address,region,image_url,kakao_place_id,save_count",
        )
        .eq("id", placeId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) return;
      const p = {
        id: String(data.id),
        name: String(data.name || "").trim(),
        lat: data.lat != null ? Number(data.lat) : undefined,
        lng: data.lng != null ? Number(data.lng) : undefined,
        address: String(data.address || ""),
        region: String(data.region || ""),
        image: data.image_url != null ? String(data.image_url) : undefined,
        kakao_place_id:
          data.kakao_place_id != null ? String(data.kakao_place_id) : undefined,
        savedCount: Number(data.save_count ?? 0),
      };
      onOpenPlaceDetail(p, "mutual_checkin_strip");
    } catch (e) {
      console.warn("mutual open place:", e?.message || e);
    }
  };

  const onCardActivate = async (card) => {
    const uuid =
      card.rows.map((r) => r.place_id).find(Boolean) || null;
    if (uuid) {
      await openPlace(String(uuid));
      return;
    }
    showToast(
      "아직 지도 카드와 연결되지 않은 한잔이에요.\n카카오·내부 장소 매칭되면 바로 여기서 열릴 거예요.",
      "info",
      3400,
    );
  };

  const onSearchResultActivate = (row) => {
    if (typeof onPickUserFromSearch === "function") {
      onPickUserFromSearch(row);
      return;
    }
    navigate(`/u/${row.userId}`);
  };

  if (!user?.id) return null;

  const styles = {
    container: {
      width: "100%",
      boxSizing: "border-box",
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderRadius: "12px",
      padding: compact ? "9px 10px 8px" : "14px",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      maxHeight: compact ? "min(148px, 19vh)" : "min(340px, 42vh)",
      overflowY: "auto",
      flexShrink: 0,
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: compact ? "6px" : "8px",
      marginBottom: compact ? "5px" : "12px",
      paddingBottom: compact ? "5px" : "10px",
      borderBottom: compact ? "1px solid #5dade2" : "2px solid #5dade2",
    },
    title: {
      fontSize: compact ? "13px" : "16px",
      fontWeight: 800,
      color: "#222",
      display: "flex",
      alignItems: "center",
      gap: compact ? "4px" : "6px",
    },
    list: {
      display: "flex",
      flexDirection: "column",
      gap: compact ? "6px" : "10px",
    },
    card: {
      textAlign: "left",
      width: "100%",
      padding: compact ? "7px 8px" : "10px",
      borderRadius: compact ? "8px" : "10px",
      border: "1px solid rgba(0, 0, 0, 0.06)",
      backgroundColor: "#fafafa",
      cursor: "pointer",
      display: "flex",
      gap: compact ? "8px" : "10px",
      alignItems: "flex-start",
      boxSizing: "border-box",
    },
    avatars: {
      display: "flex",
      flexShrink: 0,
    },
    avatar: {
      width: compact ? "28px" : "36px",
      height: compact ? "28px" : "36px",
      borderRadius: "50%",
      objectFit: "cover",
      border: "2px solid #fff",
      marginLeft: compact ? "-7px" : "-10px",
      background: "#dfe6e9",
    },
    avatarFirst: {
      marginLeft: 0,
    },
    body: { flex: 1, minWidth: 0 },
    headline: {
      fontSize: compact ? "12px" : "13px",
      fontWeight: 700,
      color: "#222",
      lineHeight: 1.45,
    },
    sub: {
      marginTop: compact ? "2px" : "4px",
      fontSize: compact ? "10px" : "11px",
      color: "#666",
      fontWeight: 600,
    },
    empty: {
      textAlign: "center",
      color: "#666",
      fontSize: compact ? "12px" : "13px",
      lineHeight: 1.5,
      padding: compact ? "6px 4px" : "14px 4px",
    },
    cta: {
      marginTop: compact ? "6px" : "10px",
      width: "100%",
      padding: compact ? "7px" : "10px",
      borderRadius: "999px",
      border: "1px solid #3498db",
      backgroundColor: "#ebf7fe",
      color: "#2874a6",
      fontWeight: 800,
      fontSize: compact ? "11px" : "13px",
      cursor: "pointer",
    },
    searchPanel: {
      marginBottom: compact ? "6px" : "10px",
      borderRadius: compact ? "8px" : "10px",
      border: "1px solid rgba(52,152,219,0.25)",
      background: "rgba(52,152,219,0.08)",
      padding: compact ? "6px" : "8px",
    },
    searchRow: {
      display: "flex",
      gap: 6,
      alignItems: "center",
      position: "relative",
    },
    searchInput: {
      width: "100%",
      minWidth: 0,
      border: "1px solid rgba(0,0,0,0.12)",
      borderRadius: 8,
      background: "#fff",
      color: "#222",
      fontSize: compact ? "11px" : "12px",
      padding: compact ? "6px 8px" : "7px 10px",
      outline: "none",
    },
    searchClearButton: {
      border: "1px solid rgba(0,0,0,0.14)",
      background: "#fff",
      color: "#6b7280",
      borderRadius: "999px",
      width: compact ? "24px" : "26px",
      height: compact ? "24px" : "26px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: compact ? "12px" : "13px",
      lineHeight: 1,
      cursor: "pointer",
      flexShrink: 0,
    },
    searchButton: {
      border: "1px solid rgba(52,152,219,0.45)",
      background: "#fff",
      color: "#2874a6",
      borderRadius: 8,
      fontSize: compact ? "11px" : "12px",
      fontWeight: 700,
      padding: compact ? "6px 8px" : "7px 10px",
      cursor: "pointer",
      flexShrink: 0,
    },
    searchHint: {
      marginTop: 5,
      fontSize: compact ? "10px" : "11px",
      color: "#5b6b73",
    },
    searchError: {
      marginTop: 6,
      fontSize: compact ? "10px" : "11px",
      color: "#b91c1c",
      fontWeight: 700,
    },
    searchResultList: {
      marginTop: 7,
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    searchResultRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      background: "rgba(255,255,255,0.95)",
      border: "1px solid rgba(0,0,0,0.07)",
      borderRadius: 8,
      padding: compact ? "6px" : "7px",
    },
    searchResultMain: {
      border: "none",
      background: "transparent",
      padding: 0,
      minWidth: 0,
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: 8,
      textAlign: "left",
      cursor: "pointer",
    },
    searchAvatar: {
      width: compact ? "24px" : "30px",
      height: compact ? "24px" : "30px",
      borderRadius: "50%",
      overflow: "hidden",
      background: "#dfe6e9",
      flexShrink: 0,
      border: "1px solid rgba(0,0,0,0.08)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: compact ? "11px" : "12px",
      fontWeight: 800,
      color: "#4b5563",
    },
    searchAvatarCurator: {
      borderColor: "rgba(241,196,15,0.65)",
    },
    searchAvatarImg: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    },
    searchNameBlock: { minWidth: 0, flex: 1 },
    searchName: {
      fontSize: compact ? "11px" : "12px",
      fontWeight: 700,
      color: "#1f2937",
      lineHeight: 1.2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    searchHandle: {
      marginTop: 1,
      fontSize: compact ? "10px" : "11px",
      color: "#6b7280",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    inlinePickButton: {
      marginTop: 0,
      padding: compact ? "6px 10px" : "8px 12px",
      fontSize: compact ? "11px" : "12px",
      whiteSpace: "nowrap",
      flexShrink: 0,
    },
    stripWrap: {
      width: "100%",
      minHeight: compact ? "28px" : "32px",
      display: "flex",
      alignItems: "center",
      gap: 6,
      overflowX: "auto",
      scrollbarWidth: "thin",
      boxSizing: "border-box",
    },
    stripChip: {
      flexShrink: 0,
      maxWidth: compact ? 220 : 260,
      padding: compact ? "3px 10px" : "5px 10px",
      borderRadius: 999,
      border: "1px solid rgba(52,152,219,0.3)",
      background: "linear-gradient(135deg, #ecf6ff 0%, #f4fbff 100%)",
      color: "#1f4f77",
      fontSize: compact ? "11px" : "12px",
      fontWeight: 700,
      lineHeight: 1.2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      cursor: "pointer",
      textAlign: "left",
      minHeight: compact ? "28px" : "30px",
      display: "inline-flex",
      alignItems: "center",
      boxSizing: "border-box",
    },
    stripSearchChip: {
      flexShrink: 0,
      padding: compact ? "3px 10px" : "5px 10px",
      borderRadius: 999,
      border: "1px solid rgba(41,128,185,0.4)",
      background: "#fff",
      color: "#2874a6",
      fontSize: compact ? "11px" : "12px",
      fontWeight: 800,
      lineHeight: 1.2,
      cursor: "pointer",
      minHeight: compact ? "28px" : "30px",
      display: "inline-flex",
      alignItems: "center",
      boxSizing: "border-box",
    },
    stripEmpty: {
      fontSize: compact ? "11px" : "12px",
      fontWeight: 600,
      color: "#6b7280",
      minHeight: compact ? "28px" : "30px",
      display: "flex",
      alignItems: "center",
      padding: "0 2px",
    },
  };

  if (stripMode) {
    return (
      <div style={{ position: "relative" }}>
        <div style={styles.stripWrap}>
          <div
            style={{
              position: "relative",
              flexShrink: searchOpen ? 1 : 0,
              flex: searchOpen ? "1 1 auto" : "0 0 auto",
              minHeight: 28,
              height: 28,
              width: searchOpen ? "100%" : 98,
              transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <button
              type="button"
              style={{
                ...styles.stripSearchChip,
                position: "absolute",
                inset: 0,
                width: "100%",
                justifyContent: "center",
                opacity: searchOpen ? 0 : 1,
                pointerEvents: searchOpen ? "none" : "auto",
                transition: "opacity 520ms ease",
              }}
              onClick={() => setSearchOpen(true)}
            >
              검색하기
            </button>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
                opacity: searchOpen ? 1 : 0,
                pointerEvents: searchOpen ? "auto" : "none",
                transition: "opacity 520ms ease",
              }}
            >
              <input
                value={String(searchQuery || "").replace(/^@+/, "")}
                onChange={(e) =>
                  setSearchQuery(String(e.target.value || "").replace(/^@+/, ""))
                }
                placeholder="닉네임 검색"
                style={{
                  ...styles.searchInput,
                  minHeight: 28,
                  height: 28,
                  padding: "4px 8px",
                  fontSize: 11,
                  borderRadius: 12,
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runHandleSearch();
                  }
                }}
              />
              <button
                type="button"
                style={styles.searchButton}
                onClick={() => void runHandleSearch()}
                disabled={searchLoading}
              >
                {searchLoading ? "검색중" : "검색"}
              </button>
              <button
                type="button"
                style={styles.searchClearButton}
                onClick={() => {
                  if (String(searchQuery || "").trim()) {
                    setSearchQuery("");
                    setSearchResults([]);
                    setSearchError("");
                  } else {
                    setSearchOpen(false);
                  }
                }}
                aria-label={String(searchQuery || "").trim() ? "검색어 지우기" : "검색 닫기"}
                title={String(searchQuery || "").trim() ? "지우기" : "닫기"}
              >
                ×
              </button>
            </div>
          </div>
          {dayLocked ? (
            <button
              type="button"
              style={{
                ...styles.stripChip,
                opacity: 0.55,
                cursor: "not-allowed",
                filter: "grayscale(0.22)",
                flex: "1 1 auto",
                minWidth: 0,
              }}
              onClick={dayScheduleToast}
            >
              {JUDO_DAY_SIDE_STRIP_HINT}
            </button>
          ) : cards.length > 0 ? (
            cards.slice(0, 8).map((card, idx) => (
              <button
                key={`${card.kind}:${card.groupKey}:${idx}:${maxCreatedMs(card.rows)}`}
                type="button"
                style={styles.stripChip}
                onClick={() => void onCardActivate(card)}
                title={primaryLine(card, profilesById, placeNames)}
              >
                {primaryLine(card, profilesById, placeNames)}
              </button>
            ))
          ) : loading ? (
            <div style={styles.stripEmpty}>불러오는 중…</div>
          ) : !searchOpen ? (
            <div style={styles.stripEmpty}>아는 사람 활동이 아직 없어요</div>
          ) : null}
        </div>
        {searchOpen && (searchError || searchResults.length > 0) ? (
          <div
            style={{
              ...styles.searchPanel,
              position: "absolute",
              left: 0,
              right: 0,
              top: "100%",
              marginTop: 0,
              marginBottom: 0,
              zIndex: 12,
            }}
          >
            {searchError ? <div style={styles.searchError}>{searchError}</div> : null}
            {searchResults.length > 0 ? (
              <div style={styles.searchResultList}>
                {searchResults.map((u) => (
                  <div key={u.userId} style={styles.searchResultRow}>
                    <button
                      type="button"
                      style={styles.searchResultMain}
                      onClick={() => onSearchResultActivate(u)}
                    >
                      <div
                        style={{
                          ...styles.searchAvatar,
                          ...(u.isCurator ? styles.searchAvatarCurator : {}),
                        }}
                      >
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" style={styles.searchAvatarImg} />
                        ) : (
                          userInitial(u.displayName)
                        )}
                      </div>
                      <div style={styles.searchNameBlock}>
                        <div style={styles.searchName}>{u.displayName}</div>
                        <div style={styles.searchHandle}>
                          @{u.username}
                          {u.isCurator ? " · 큐레이터" : ""}
                        </div>
                      </div>
                    </button>
                    <PickUserButton
                      profileUserId={u.userId}
                      buttonStyle={styles.inlinePickButton}
                      onBecomePicking={() => void load()}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>
          <span aria-hidden>👀</span>
          아는 사람
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!loading ? (
            <span
              style={{ fontSize: compact ? "10px" : "11px", color: "#888" }}
            >
              최근 한잔
            </span>
          ) : (
            <span style={{ fontSize: "11px", color: "#aaa" }}>불러오는 중…</span>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            style={{
              border: "1px solid rgba(52,152,219,0.45)",
              background: "rgba(52,152,219,0.1)",
              color: "#2874a6",
              borderRadius: 999,
              padding: compact ? "4px 8px" : "5px 10px",
              fontSize: compact ? "10px" : "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {searchOpen ? "닫기" : "검색하기"}
          </button>
        </div>
      </div>

      {searchOpen ? (
        <div style={styles.searchPanel}>
          <div style={styles.searchRow}>
            <input
              value={String(searchQuery || "").replace(/^@+/, "")}
              onChange={(e) =>
                setSearchQuery(String(e.target.value || "").replace(/^@+/, ""))
              }
              placeholder="닉네임 또는 한글 별명으로 찾기"
              style={styles.searchInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runHandleSearch();
                }
              }}
            />
            {String(searchQuery || "").trim() ? (
              <button
                type="button"
                style={styles.searchClearButton}
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchError("");
                }}
                aria-label="검색어 지우기"
                title="지우기"
              >
                ×
              </button>
            ) : null}
            <button
              type="button"
              style={styles.searchButton}
              onClick={() => void runHandleSearch()}
              disabled={searchLoading}
            >
              {searchLoading ? "검색중" : "검색"}
            </button>
          </div>
          {searchError ? <div style={styles.searchError}>{searchError}</div> : null}
          {searchResults.length > 0 ? (
            <div style={styles.searchResultList}>
              {searchResults.map((u) => (
                <div key={u.userId} style={styles.searchResultRow}>
                  <button
                    type="button"
                    style={styles.searchResultMain}
                    onClick={() => onSearchResultActivate(u)}
                  >
                    <div
                      style={{
                        ...styles.searchAvatar,
                        ...(u.isCurator ? styles.searchAvatarCurator : {}),
                      }}
                    >
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" style={styles.searchAvatarImg} />
                      ) : (
                        userInitial(u.displayName)
                      )}
                    </div>
                    <div style={styles.searchNameBlock}>
                      <div style={styles.searchName}>{u.displayName}</div>
                      <div style={styles.searchHandle}>
                        @{u.username}
                        {u.isCurator ? " · 큐레이터" : ""}
                      </div>
                    </div>
                  </button>
                  <PickUserButton
                    profileUserId={u.userId}
                    buttonStyle={styles.inlinePickButton}
                    onBecomePicking={() => void load()}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!dayLocked && !loading && rows.length === 0 ? (
        <div style={styles.empty}>
          아는 사람 활동이 아직 없어요
        </div>
      ) : null}

      {dayLocked ? (
        <div
          style={{
            textAlign: "center",
            padding: compact ? "6px 6px 8px" : "10px 8px 12px",
            color: "#64748b",
            fontSize: compact ? 10 : 11,
            fontWeight: 650,
            lineHeight: 1.4,
          }}
        >
          {JUDO_DAY_SIDE_STRIP_HINT}
          <span style={{ display: "block", marginTop: compact ? 6 : 8 }}>
            <button
              type="button"
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(52,152,219,0.28)",
                background: "rgba(52,152,219,0.06)",
                color: "#2563ab",
                fontWeight: 750,
                fontSize: compact ? 10 : 11,
                cursor: "pointer",
                opacity: 0.92,
              }}
              onClick={dayScheduleToast}
            >
              한잔 시간 안내
            </button>
          </span>
        </div>
      ) : cards.length > 0 ? (
        <div style={styles.list}>
          {cards.map((card, idx) => {
            const head = primaryLine(card, profilesById, placeNames);
            const sub = subtitleLine(card, profilesById, placeNames);

            const avatars = card.rows.slice(0, 3).map((r, i) => {
              const avatar = profilesById[r.user_id]?.avatar_url;
              const nm = displayNick(r, profilesById);
              return avatar ? (
                <img
                  key={`${r.user_id}:${i}:${idx}`}
                  src={avatar}
                  alt=""
                  style={{
                    ...styles.avatar,
                    ...(i === 0 ? styles.avatarFirst : {}),
                  }}
                />
              ) : (
                <div
                  key={`${r.user_id}:${i}:${idx}`}
                  style={{
                    ...styles.avatar,
                    ...(i === 0 ? styles.avatarFirst : {}),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "#555",
                  }}
                  aria-hidden
                >
                  {(nm.charAt(0) || "?").toUpperCase()}
                </div>
              );
            });

            return (
              <button
                key={`${card.kind}:${card.groupKey}:${idx}:${maxCreatedMs(card.rows)}`}
                type="button"
                style={styles.card}
                onClick={() => void onCardActivate(card)}
              >
                <div style={styles.avatars}>{avatars}</div>
                <div style={styles.body}>
                  <div style={styles.headline}>{head}</div>
                  {sub ? <div style={styles.sub}>{sub}</div> : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : loading ? (
        <div style={{ ...styles.empty, paddingTop: "4px" }}>불러오는 중…</div>
      ) : null}
    </div>
  );
}
