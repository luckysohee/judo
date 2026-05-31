/**
 * 홈 상단 「술 상황」칩 ↔ system_folders.key + 태그 매칭
 * (저장 폴더가 있으면 우선, 없으면 place.tags / category 휴리스틱)
 */

export const SITUATION_FOLDER = {
  secondRound: "after_party",
  firstMeal: "group",
  vibe: "date",
};

const TAG_HINTS = {
  [SITUATION_FOLDER.secondRound]: [
    "2차",
    "야간",
    "늦게",
    "포차",
    "바",
    "술집",
    "안주",
    "술안주",
    "해산물",
    "맥주",
    "하이볼",
    "칵테일",
    "펍",
    "요리주점",
    "닭발",
  ],
  [SITUATION_FOLDER.firstMeal]: [
    "회식",
    "단체",
    "국물",
    "고기",
    "삼겹",
    "밥",
    "식사",
    "해장",
    "곱창",
    "찌개",
    "점심",
    "저녁",
    "치킨",
    "족발",
  ],
  [SITUATION_FOLDER.vibe]: [
    "데이트",
    "분위기",
    "로맨틱",
    "와인",
    "조용",
    "야외",
    "루프탑",
    "뷰",
    "인테리어",
    "감성",
    "무드",
    "브런치",
    "디저트",
  ],
};

function collectTagHaystack(place) {
  const parts = [];
  if (Array.isArray(place?.tags)) {
    for (const t of place.tags) parts.push(String(t));
  }
  if (typeof place?.category === "string") parts.push(place.category);
  if (typeof place?.category_name === "string") parts.push(place.category_name);
  return parts.join(" ").toLowerCase();
}

function tagMatchesSituation(hay, folderKey) {
  const hints = TAG_HINTS[folderKey];
  if (!hay || !hints) return false;
  for (const h of hints) {
    if (hay.includes(h.toLowerCase())) return true;
  }
  return false;
}

function categoryHeuristic(place, folderKey) {
  const c = String(place?.category || place?.category_name || "").toLowerCase();
  if (!c) return false;
  if (folderKey === SITUATION_FOLDER.secondRound) {
    return /주점|바|포장|민속|호프|술집|이자카야|와인|포차|요리주점|칵테일|펍|pub|라운지|양주|음식점\s*>\s*술집|음식점\s*>\s*바/.test(
      c
    );
  }
  if (folderKey === SITUATION_FOLDER.firstMeal) {
    return /한식|중식|일식|고기|곱창|삼겹|국밥|찌개|회|치킨|닭|족발|피자|분식|돈까스|구이|샤브|샤브샤브|육류|백반|한정식/.test(
      c
    );
  }
  if (folderKey === SITUATION_FOLDER.vibe) {
    return /와인|바|카페|브루|다이닝|레스토랑|이탈리|베이커리|브런치|디저트|뷔페|프렌치/.test(
      c
    );
  }
  return false;
}

/** 같은 필터에서도 매번 위쪽 몇 개만 보이지 않게 순서만 섞음(결정적) */
function varietyOrderKey(place, seed) {
  const id = String(
    place?.id ?? place?.place_id ?? `${place?.lat ?? ""},${place?.lng ?? ""}`
  );
  const s = String(seed || "");
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** userSavedPlaces: { [placeId]: [{ key, name?, ... }, ...] } */
export function placeMatchesSituationFolder(place, folderKey, userSavedPlaces) {
  if (!folderKey || !place || !userSavedPlaces || typeof userSavedPlaces !== "object") {
    return true;
  }

  const keys = new Set();
  if (place.id != null) keys.add(String(place.id));
  if (place.place_id != null) keys.add(String(place.place_id));

  for (const k of keys) {
    const rows = userSavedPlaces[k];
    if (!Array.isArray(rows)) continue;
    if (rows.some((r) => r && String(r.key || "").trim() === folderKey)) {
      return true;
    }
  }

  const hay = collectTagHaystack(place);
  if (tagMatchesSituation(hay, folderKey)) return true;
  if (categoryHeuristic(place, folderKey)) return true;

  return false;
}

/**
 * @template T
 * @param {T[]} places
 * @param {string | null} folderKey system_folders.key or null
 * @param {Record<string, unknown>} userSavedPlaces
 * @param {{ varietySeed?: string | null }} [opts]
 * @returns {T[]}
 */
export function filterPlacesBySituationFolder(
  places,
  folderKey,
  userSavedPlaces,
  opts = {}
) {
  if (!folderKey || !Array.isArray(places)) return places || [];
  const filtered = places.filter((p) =>
    placeMatchesSituationFolder(p, folderKey, userSavedPlaces)
  );
  const seed = opts?.varietySeed;
  if (!seed || filtered.length < 2) return filtered;
  return [...filtered].sort((a, b) => {
    const ka = varietyOrderKey(a, seed);
    const kb = varietyOrderKey(b, seed);
    if (ka !== kb) return ka - kb;
    return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  });
}

export function situationFolderLabel(folderKey) {
  if (folderKey === SITUATION_FOLDER.secondRound) return "2차";
  if (folderKey === SITUATION_FOLDER.firstMeal) return "1차·회식";
  if (folderKey === SITUATION_FOLDER.vibe) return "분위기";
  return "";
}
