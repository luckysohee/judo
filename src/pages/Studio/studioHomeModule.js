import { filterPlaceTagsForDisplay } from "../../utils/placeUiTags";
import { normalizeStudioPlaceCategory } from "../../utils/placeTaxonomy.js";

/** 프로덕션 번들에서 호출되어도 출력 없음 — 실패 추적은 `console.error` 유지 */
const _nativeConsole = globalThis.console;
const _devConsoleLog = _nativeConsole.log.bind(_nativeConsole);
const _devConsoleWarn = _nativeConsole.warn.bind(_nativeConsole);

export function devLog(...args) {
  if (import.meta.env.DEV) _devConsoleLog(...args);
}
export function devWarn(...args) {
  if (import.meta.env.DEV) _devConsoleWarn(...args);
}

/** DB·마이그레이션에 따라 프로필 사진 컬럼명이 다를 수 있음 */
function isLikelyMissingCuratorImageColumnError(error) {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const code = error.code;
  return (
    code === "42703" ||
    (msg.includes("column") && msg.includes("does not exist")) ||
    msg.includes("schema cache") ||
    msg.includes("could not find the") ||
    msg.includes("unknown column")
  );
}

export const FALLBACK_SAVED_FOLDER_DEFS = [
  { key: "after_party", name: "2차", color: "#FF8C42", icon: "🍺", sort_order: 1 },
  { key: "date", name: "데이트", color: "#FF69B4", icon: "💘", sort_order: 2 },
  { key: "hangover", name: "해장", color: "#87CEEB", icon: "🥣", sort_order: 3 },
  { key: "solo", name: "혼술", color: "#9B59B6", icon: "👤", sort_order: 4 },
  { key: "group", name: "회식", color: "#F1C40F", icon: "👥", sort_order: 5 },
  { key: "must_go", name: "찐맛집", color: "#27AE60", icon: "🌟", sort_order: 6 },
  { key: "terrace", name: "야외/뷰", color: "#5DADE2", icon: "🌅", sort_order: 7 },
];

/** 잔 리스트·편집: 이 7개만 삭제 불가, 그 외 키는 사용자 추가 폴더로 간주 */
const SYSTEM_SAVED_FOLDER_KEY_SET = new Set(
  FALLBACK_SAVED_FOLDER_DEFS.map((def) => def.key),
);

export function isDeletableUserSavedFolderKey(key) {
  return key != null && !SYSTEM_SAVED_FOLDER_KEY_SET.has(String(key));
}

/** 잔 리스트 — 사용자 폴더 편집 시 색 선택 */
export const SAVED_FOLDER_EDIT_COLOR_OPTIONS = [
  "#2ECC71",
  "#FF5A5F",
  "#8E44AD",
  "#3498DB",
  "#F39C12",
  "#1ABC9C",
  "#E74C3C",
  "#95A5A6",
];

export function studioSavedPlaceId(item) {
  if (!item || typeof item !== "object") return null;
  const row = item.places;
  if (row && row.id != null) return String(row.id);
  if (item.place_id != null) return String(item.place_id);
  return null;
}

/** 스튜디오 성장 추이 미니차트: 라벨·stroke가 박스 밖으로 안 나가게 y% 클램프 */
export function growthTrendLineYPercent(value, scale) {
  const s = Number(scale);
  if (!Number.isFinite(s) || s <= 0) return 50;
  const v = Math.max(0, Number(value) || 0);
  const pct = 100 - (v / s) * 100;
  return Math.min(96, Math.max(4, pct));
}

/** 같은 place에 본인 curator_id(auth uid) 중복이면 한 행만 — 최신 우선, 동순이면 `places`가 붙은 행 우선 */
export function dedupeCuratorPlacesByPlaceId(curatorPlacesData) {
  const groups = new Map();
  for (const cp of curatorPlacesData || []) {
    const pid = cp?.places?.id ?? cp?.place_id;
    if (pid == null) continue;
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid).push(cp);
  }
  const out = [];
  for (const [, rows] of groups) {
    rows.sort((a, b) => {
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      if (tb !== ta) return tb - ta;
      const ah = a?.places?.id ? 1 : 0;
      const bh = b?.places?.id ? 1 : 0;
      return bh - ah;
    });
    out.push(rows[0]);
  }
  return out;
}

/**
 * 잔 올리기: places 행은 kakao_place_id 로 재사용해도 curator_places 는 매번 INSERT 하면 동일 place_id 로 여러 줄이 생김.
 * 기존 본인 행이 있으면 UPDATE, 중복 행은 삭제 후 하나만 유지.
 */
export async function upsertCuratorPlaceForStudio(
  supabase,
  authUserId,
  placeUuid,
  {
    display_name,
    one_line_reason = "",
    tags = [],
    alcohol_types = [],
    moods = [],
  },
) {
  const pid = String(placeUuid).trim();
  const safeArr = (a) => (Array.isArray(a) ? a : []);
  const patch = {
    display_name,
    one_line_reason,
    tags: safeArr(tags),
    alcohol_types: safeArr(alcohol_types),
    moods: safeArr(moods),
  };

  const { data: rows, error: selErr } = await supabase
    .from("curator_places")
    .select("id, curator_id, created_at")
    .eq("place_id", pid)
    .eq("curator_id", authUserId);
  if (selErr) return { data: null, error: selErr };

  const list = rows || [];
  let result;
  if (list.length === 0) {
    result = await supabase
      .from("curator_places")
      .insert([
        {
          curator_id: authUserId,
          place_id: pid,
          ...patch,
        },
      ])
      .select();
  } else {
    const canonical =
      list.find((r) => String(r.curator_id) === String(authUserId)) || list[0];
    for (const d of list.filter((r) => r.id !== canonical.id)) {
      const { error: delErr } = await supabase
        .from("curator_places")
        .delete()
        .eq("id", d.id);
      if (delErr) {
        devWarn("curator_places dedupe delete:", delErr);
      }
    }

    result = await supabase
      .from("curator_places")
      .update(patch)
      .eq("id", canonical.id)
      .select();
  }

  if (!result.error) {
    const { error: rpcErr } = await supabase.rpc(
      "studio_patch_curator_place_taxonomy",
      {
        p_place_id: pid,
        p_tags: patch.tags,
        p_moods: patch.moods,
        p_alcohol_types: patch.alcohol_types,
      },
    );
    if (rpcErr) {
      devWarn(
        "studio_patch_curator_place_taxonomy (Supabase 마이그레이션 적용 필요):",
        rpcErr.message,
      );
    }
  }

  return result;
}

/** DB·API에서 tags 등이 json 문자열·비배열로 올 때 폼용 문자열 배열로 */
export function parseDbStringArray(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        const j = JSON.parse(t);
        return parseDbStringArray(j);
      } catch {
        /* fallthrough */
      }
    }
    if (t.startsWith("{") && t.endsWith("}") && !t.startsWith("[{")) {
      return t
        .slice(1, -1)
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((s) => s.replace(/^"|"$/g, "").trim())
        .filter(Boolean);
    }
    return t.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** studio_archive_extended_insights RPC → UI용 객체 */
export function normalizeStudioArchiveExtendedInsights(raw) {
  let parsed = raw;
  if (typeof parsed === "string" && parsed.trim()) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return {
      oneLineTop: [],
      style: {
        alcohol: [],
        moods: [],
        tags: [],
        categories: [],
      },
      followers: {
        savesOnPicks: 0,
        distinctSavers: 0,
        regions: [],
        checkinsTotal: 0,
      },
    };
  }
  const arr = (x) => (Array.isArray(x) ? x : []);
  const pctRows = (rows) =>
    arr(rows)
      .map((r) => ({
        label: String(r?.label ?? "").trim(),
        pct: Math.min(100, Math.max(0, Number(r?.pct) || 0)),
      }))
      .filter((r) => r.label);
  return {
    oneLineTop: arr(parsed.one_line_top)
      .map((r) => ({
        text: String(r?.text ?? "").trim(),
        saves: Number(r?.saves) || 0,
        placeId: r?.place_id != null ? String(r.place_id) : null,
        placeName: String(r?.place_name ?? "").trim(),
      }))
      .filter((r) => r.text),
    style: {
      alcohol: pctRows(parsed.style?.alcohol),
      moods: pctRows(parsed.style?.moods),
      tags: pctRows(parsed.style?.tags),
      categories: pctRows(parsed.style?.categories),
    },
    followers: {
      savesOnPicks: Number(parsed.followers?.saves_on_picks) || 0,
      distinctSavers: Number(parsed.followers?.distinct_savers) || 0,
      regions: arr(parsed.followers?.regions).map((r) => ({
        label: String(r?.label ?? "기타").trim() || "기타",
        saves: Number(r?.saves) || 0,
      })),
      checkinsTotal:
        Number(
          parsed.followers?.checkins_total ?? parsed.followers?.checkins_30d,
        ) || 0,
    },
  };
}

export function mapCuratorJoinRowsToMyPlaces(curatorPlacesData) {
  return (curatorPlacesData || [])
    .map((curatorPlace) => {
      const place = curatorPlace.places;
      const alc = parseDbStringArray(curatorPlace.alcohol_types);
      const moodArr = parseDbStringArray(curatorPlace.moods);
      const line =
        curatorPlace.one_line_reason != null &&
        curatorPlace.one_line_reason !== undefined
          ? String(curatorPlace.one_line_reason)
          : null;
      const archived = curatorPlace.is_archived === true;
      const isPublicListed = !archived;

      if (!place?.id && curatorPlace.place_id) {
        const nm = String(curatorPlace.display_name || "").trim();
        return {
          id: curatorPlace.place_id,
          name: nm || "장소 상세를 불러오지 못했습니다",
          address:
            "curator_places에는 있으나 places 행을 조회하지 못했습니다. RLS·네트워크·place_id를 확인하세요.",
          latitude: null,
          longitude: null,
          kakao_place_id: null,
          category: "미분류",
          alcohol_type: alc[0] ?? "",
          atmosphere: moodArr[0] ?? "",
          recommended_menu: "",
          menu_reason: line ?? "",
          tags: filterPlaceTagsForDisplay(parseDbStringArray(curatorPlace.tags)),
          alcohol_types: alc,
          moods: moodArr,
          is_public: isPublicListed,
          created_at: new Date().toISOString().split("T")[0],
          curator_place_id: curatorPlace.id,
          _studioPlaceLoadFailed: true,
        };
      }
      if (!place?.id) return null;

      const tagsCp = parseDbStringArray(curatorPlace.tags);
      const tagsPl = parseDbStringArray(place.tags);
      const tagsMerged = tagsCp.length ? tagsCp : tagsPl;
      return {
        id: place.id,
        name: place.name,
        address: place.address || place.name,
        latitude: place.lat,
        longitude: place.lng,
        kakao_place_id: place.kakao_place_id ?? null,
        category: normalizeStudioPlaceCategory(place.category || "") || "미분류",
        alcohol_type: alc[0] ?? place.alcohol_type ?? "",
        atmosphere: moodArr[0] ?? place.atmosphere ?? "",
        recommended_menu: place.recommended_menu || "",
        menu_reason: line !== null ? line : place.menu_reason || "",
        tags: filterPlaceTagsForDisplay(tagsMerged),
        alcohol_types: alc,
        moods: moodArr,
        is_public: isPublicListed,
        created_at: place.created_at
          ? new Date(place.created_at).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        curator_place_id: curatorPlace.id,
      };
    })
    .filter(Boolean);
}

/**
 * curators 행에 프로필 이미지 저장 (avatar_url → avatar → image 순으로 시도)
 */
export async function persistCuratorProfileImageToSupabase(
  supabaseClient,
  userId,
  imageUrl,
) {
  const updatedAt = new Date().toISOString();
  const patches = [
    { avatar_url: imageUrl },
    { avatar: imageUrl },
    { image: imageUrl },
  ];
  let lastError = null;
  for (const patch of patches) {
    const { error } = await supabaseClient
      .from("curators")
      .update({ ...patch, updated_at: updatedAt })
      .eq("user_id", userId);
    if (!error) {
      return { ok: true };
    }
    lastError = error;
    if (isLikelyMissingCuratorImageColumnError(error)) {
      continue;
    }
    return { ok: false, error };
  }
  return {
    ok: false,
    error:
      lastError ||
      new Error(
        "프로필 사진 컬럼(avatar_url / avatar / image)을 찾을 수 없습니다.",
      ),
  };
}
