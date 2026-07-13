import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useToast } from "../Toast/ToastProvider";
import { supabase } from "../../lib/supabase";
import { fetchMutualCheckins } from "../../utils/userActivity";
import {
  mergeCheckinProfileLabelRow,
  resolveCheckinRowDisplayName,
} from "../../utils/checkinDisplayName";
import { HOME_HOT_STRIP_CONTENT_SLOT_PX } from "../../utils/homeHotStripLayout";
import PickUserButton from "../PickUserButton/PickUserButton";

const THREE_H_MS = 3 * 60 * 60 * 1000;
const POLL_MS = 90_000;
const SEARCH_DEBOUNCE_MS = 200;

/** PostgREST `.or()` / `ilike` 와일드카드·구분자 이스케이프 */
function sanitizeMutualSearchTerm(raw) {
  return String(raw || "")
    .replace(/^@+/, "")
    .trim()
    .replace(/[%_,().]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

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
  return resolveCheckinRowDisplayName(row, profilesById);
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
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [placeNames, setPlaceNames] = useState({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const searchInputRef = useRef(null);
  const stripRootRef = useRef(null);
  const [stripSuggestAnchor, setStripSuggestAnchor] = useState(null);

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
          const handle = String(c.slug || c.username || prev.username || "").trim();
          pmap[uid] = mergeCheckinProfileLabelRow(
            {
              ...prev,
              id: uid,
              display_name: prev.display_name,
              username: handle || prev.username,
              avatar_url: String(c.avatar_url || "").trim() || prev.avatar_url,
            },
            c,
          );
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

  const runHandleSearch = useCallback(async (rawQuery) => {
    const normalized = sanitizeMutualSearchTerm(rawQuery).toLowerCase();
    if (!normalized) {
      setSearchError("");
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    try {
      const term = normalized.replace(/"/g, "");
      const [{ data: profiles, error: profileErr }, { data: curRows, error: curErr }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
            .limit(30),
          supabase
            .from("curators")
            .select("user_id, slug, username, display_name, name, avatar_url")
            .or(
              `slug.ilike.%${term}%,username.ilike.%${term}%,display_name.ilike.%${term}%,name.ilike.%${term}%`
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
  }, [user?.id]);

  const trimmedSearchQuery = useMemo(
    () => sanitizeMutualSearchTerm(searchQuery),
    [searchQuery]
  );

  const showSearchSuggest =
    searchOpen &&
    Boolean(trimmedSearchQuery) &&
    (searchLoading || searchResults.length > 0 || Boolean(searchError));

  useEffect(() => {
    if (!searchOpen) return undefined;
    if (!trimmedSearchQuery) {
      setSearchResults([]);
      setSearchError("");
      setSearchLoading(false);
      return undefined;
    }
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void runHandleSearch(trimmedSearchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchOpen, trimmedSearchQuery, runHandleSearch]);

  useEffect(() => {
    if (!stripMode || !searchOpen || !showSearchSuggest) {
      setStripSuggestAnchor(null);
      return undefined;
    }
    const update = () => {
      const bar = stripRootRef.current?.closest("[data-home-hot-strip-bar]");
      if (!bar) {
        setStripSuggestAnchor(null);
        return;
      }
      const r = bar.getBoundingClientRect();
      setStripSuggestAnchor({
        left: r.left,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
      });
    };
    update();
    const t = window.setTimeout(update, 0);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [stripMode, searchOpen, showSearchSuggest, trimmedSearchQuery]);

  useEffect(() => {
    if (!stripMode || !searchOpen) return undefined;
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [stripMode, searchOpen]);

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
    searchInputWrap: {
      flex: "1 1 auto",
      minWidth: 0,
      position: "relative",
      display: "flex",
      alignItems: "center",
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
      boxSizing: "border-box",
    },
    searchInputWithClear: {
      paddingRight: compact ? 26 : 28,
    },
    searchClearInInput: {
      position: "absolute",
      right: 4,
      top: "50%",
      transform: "translateY(-50%)",
      border: "none",
      background: "transparent",
      color: "#9ca3af",
      width: 22,
      height: 22,
      borderRadius: 999,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 15,
      lineHeight: 1,
      cursor: "pointer",
      padding: 0,
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
    searchLoading: {
      padding: compact ? "8px 6px" : "10px 8px",
      fontSize: compact ? "10px" : "11px",
      fontWeight: 600,
      color: "rgba(15,23,42,0.5)",
      textAlign: "center",
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
      /** `HotCheckinStrip` contentSlot과 동일 — 탭 전환 시 높이·탭 위치 통일 */
      minHeight: compact ? `${HOME_HOT_STRIP_CONTENT_SLOT_PX}px` : "32px",
      height: compact ? `${HOME_HOT_STRIP_CONTENT_SLOT_PX}px` : "auto",
      maxHeight: compact ? `${HOME_HOT_STRIP_CONTENT_SLOT_PX}px` : "none",
      display: "flex",
      alignItems: "center",
      gap: 6,
      overflowX: "auto",
      overflowY: "hidden",
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
    searchSuggestPortal: (anchor) => {
      const gap = 6;
      const viewportW =
        typeof window !== "undefined" ? window.innerWidth : 400;
      const viewportH =
        typeof window !== "undefined" ? window.innerHeight : 800;
      const width = Math.min(Math.max(anchor.width, 220), viewportW - 16);
      const left = Math.max(8, Math.min(anchor.left, viewportW - width - 8));
      const maxHeight = Math.min(
        220,
        Math.max(96, viewportH - anchor.bottom - gap - 12)
      );
      return {
        position: "fixed",
        top: anchor.bottom + gap,
        left,
        width,
        maxHeight,
        overflowY: "auto",
        zIndex: 500,
        boxSizing: "border-box",
      };
    },
  };

  const handleSearchClearClick = useCallback(() => {
    if (trimmedSearchQuery) {
      setSearchQuery("");
      setSearchResults([]);
      setSearchError("");
      return;
    }
    setSearchOpen(false);
  }, [trimmedSearchQuery]);

  const renderSearchField = (inputStyle = {}) => (
    <div style={styles.searchInputWrap}>
      <input
        ref={stripMode ? searchInputRef : undefined}
        value={String(searchQuery || "").replace(/^@+/, "")}
        onChange={(e) =>
          setSearchQuery(String(e.target.value || "").replace(/^@+/, ""))
        }
        placeholder={
          stripMode ? "닉네임·@핸들 검색" : "닉네임 또는 한글 별명으로 찾기"
        }
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls="mutual-search-suggest"
        style={{
          ...styles.searchInput,
          ...styles.searchInputWithClear,
          ...inputStyle,
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void runHandleSearch(trimmedSearchQuery);
          }
        }}
      />
      <button
        type="button"
        style={styles.searchClearInInput}
        onClick={handleSearchClearClick}
        aria-label={trimmedSearchQuery ? "검색어 지우기" : "검색 닫기"}
        title={trimmedSearchQuery ? "지우기" : "닫기"}
      >
        ×
      </button>
    </div>
  );

  const renderSearchSuggestPanel = (panelStyle = {}) => (
    <div style={{ ...styles.searchPanel, ...panelStyle }} role="listbox" aria-label="닉네임 자동완성">
      {searchLoading && searchResults.length === 0 && !searchError ? (
        <div style={styles.searchLoading}>검색 중…</div>
      ) : null}
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
  );

  if (stripMode) {
    return (
      <div
        ref={stripRootRef}
        style={{
          position: "relative",
          width: "100%",
          height: compact ? `${HOME_HOT_STRIP_CONTENT_SLOT_PX}px` : "auto",
          minHeight: compact ? `${HOME_HOT_STRIP_CONTENT_SLOT_PX}px` : 0,
          boxSizing: "border-box",
        }}
      >
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
              {renderSearchField({
                minHeight: 28,
                height: 28,
                padding: "4px 26px 4px 8px",
                fontSize: 11,
                borderRadius: 12,
              })}
              <button
                type="button"
                style={{
                  ...styles.searchButton,
                  minHeight: 28,
                  height: 28,
                  padding: "4px 8px",
                  fontSize: 11,
                  borderRadius: 12,
                }}
                onClick={() => void runHandleSearch(trimmedSearchQuery)}
                disabled={searchLoading}
              >
                {searchLoading ? "검색중" : "검색"}
              </button>
            </div>
          </div>
          {cards.length > 0 ? (
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
        {showSearchSuggest &&
        stripSuggestAnchor &&
        typeof document !== "undefined"
          ? createPortal(
              <div id="mutual-search-suggest">
                {renderSearchSuggestPanel(
                  styles.searchSuggestPortal(stripSuggestAnchor)
                )}
              </div>,
              document.body
            )
          : null}
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
            {renderSearchField()}
            <button
              type="button"
              style={styles.searchButton}
              onClick={() => void runHandleSearch(trimmedSearchQuery)}
              disabled={searchLoading}
            >
              {searchLoading ? "검색중" : "검색"}
            </button>
          </div>
          {showSearchSuggest ? renderSearchSuggestPanel() : null}
        </div>
      ) : null}

      {!loading && rows.length === 0 ? (
        <div style={styles.empty}>
          아는 사람 활동이 아직 없어요
        </div>
      ) : null}

      {cards.length > 0 ? (
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
