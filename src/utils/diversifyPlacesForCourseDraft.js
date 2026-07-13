const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashString(s) {
  let h = 5381;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleCopy(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function placeIdKey(place) {
  return String(place?.id || place?.place_id || place?.name || "").trim();
}

/** variant마다 시작 지점을 밀어 AI가 앞쪽만 고르는 편향을 줄임 */
export function rotatePlacesByVariant(places, variantSeed = 0) {
  const list = Array.isArray(places) ? [...places] : [];
  if (list.length <= 2) return list;
  const v = Math.abs(Math.floor(Number(variantSeed) || 0));
  if (v === 0) return list;
  const step = Math.max(1, Math.floor(list.length / 4));
  const offset = (v * step) % list.length;
  if (offset === 0) return list;
  return [...list.slice(offset), ...list.slice(0, offset)];
}

/**
 * 직전에 쓴 placeKey를 뒤로 밀어 「다른 조합」이 같은 집만 고르지 않게.
 * @param {object[]} places
 * @param {string[]} excludeKeys
 * @param {(p: object) => string} [keyFn]
 */
export function demoteExcludedPlaces(places, excludeKeys, keyFn) {
  const list = Array.isArray(places) ? places.filter(Boolean) : [];
  const exclude = new Set(
    (Array.isArray(excludeKeys) ? excludeKeys : [])
      .map((k) => String(k || "").trim())
      .filter(Boolean)
  );
  if (exclude.size === 0) return list;
  const getKey = typeof keyFn === "function" ? keyFn : (p) => placeIdKey(p);
  const keep = [];
  const demoted = [];
  for (const p of list) {
    const k = String(getKey(p) || "").trim();
    if (k && exclude.has(k)) demoted.push(p);
    else keep.push(p);
  }
  return [...keep, ...demoted];
}

/** 카카오 category_name / DB category → 거친 버킷 */
export function categoryBucketForPlace(place) {
  const cat = String(
    place?.category || place?.category_name || ""
  ).trim();
  if (/베이커|빵|제과|브런치|제빵/.test(cat)) return "bakery";
  if (/카페|커피|디저트|티하우스/.test(cat)) return "cafe";
  if (/술|바|펍|호프|이자카야|와인|칵테일|포차|주점/.test(cat)) return "bar";
  if (/음식|맛집|레스토|식당|한식|양식|일식|중식/.test(cat)) return "food";
  return "other";
}

function isJudoDbPlace(place) {
  const id = String(place?.id || place?.place_id || "").trim();
  return UUID_RE.test(id);
}

function popularityRankOf(place) {
  const r = Number(place?._popularityRank);
  return Number.isFinite(r) ? r : null;
}

function isCuratorPickPlace(place) {
  return place?.isCuratorPick === true;
}

/**
 * 검색·LLM 입력용 후보 순서 섞기 — 카테고리·DB·큐레이터 픽·유명점 회피.
 * @param {object[]} places
 * @param {{
 *   query?: string,
 *   variantSeed?: number,
 *   preferHiddenGems?: boolean,
 *   preferCuratorPicks?: boolean,
 *   excludePlaceKeys?: string[],
 *   placeKeyFn?: (p: object) => string,
 * }} [opts]
 */
export function diversifyPlacesForCourseDraft(places, opts = {}) {
  const list = Array.isArray(places) ? places.filter(Boolean) : [];
  if (list.length <= 2) return list;

  const variantSeed = Number(opts.variantSeed) || 0;
  const preferHiddenGems = opts.preferHiddenGems === true;
  const preferCuratorPicks = opts.preferCuratorPicks !== false;
  const seed =
    (hashString(opts.query || "") ^
      Math.imul(variantSeed + 1, 0x85ebca6b) ^
      Math.imul(variantSeed, 0xc2b2ae35) ^
      list.length ^
      (preferHiddenGems ? 0x9e3779b9 : 0) ^
      (Array.isArray(opts.excludePlaceKeys)
        ? opts.excludePlaceKeys.length * 0x27d4eb2d
        : 0)) >>>
    0;
  const rng = mulberry32(seed);

  const curatorPicks = [];
  const dbPlaces = [];
  const kakaoPlaces = [];
  for (const p of list) {
    if (isCuratorPickPlace(p)) {
      curatorPicks.push(p);
      continue;
    }
    if (isJudoDbPlace(p)) dbPlaces.push(p);
    else kakaoPlaces.push(p);
  }

  if (preferHiddenGems && kakaoPlaces.length > 1) {
    const ranked = kakaoPlaces.map((p, i) => ({
      p,
      rank: popularityRankOf(p) ?? i,
    }));
    ranked.sort((a, b) => b.rank - a.rank);
    kakaoPlaces.length = 0;
    kakaoPlaces.push(...ranked.map((x) => x.p));
  }

  const buckets = new Map();
  for (const p of kakaoPlaces) {
    const b = categoryBucketForPlace(p);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(p);
  }
  for (const [k, arr] of buckets) {
    buckets.set(k, preferHiddenGems ? arr : shuffleCopy(arr, rng));
  }

  const bucketOrder = shuffleCopy([...buckets.keys()], rng);
  const interleaved = [];
  let round = 0;
  let stagnant = 0;
  while (interleaved.length < kakaoPlaces.length && stagnant < 3) {
    let added = 0;
    for (const key of bucketOrder) {
      const arr = buckets.get(key) || [];
      if (arr.length > round) {
        interleaved.push(arr[round]);
        added += 1;
      }
    }
    if (added === 0) stagnant += 1;
    else stagnant = 0;
    round += 1;
  }

  const dbShuffled = shuffleCopy(dbPlaces, rng);
  const dbTake = Math.min(
    dbShuffled.length,
    Math.max(2, Math.ceil(list.length * 0.25))
  );
  const headDb = dbShuffled.slice(0, dbTake);
  const tailDb = dbShuffled.slice(dbTake);

  const curatorShuffled = shuffleCopy(curatorPicks, rng);
  const curatorTake = preferCuratorPicks
    ? Math.min(
        curatorShuffled.length,
        Math.max(1, Math.ceil(list.length * 0.35))
      )
    : 0;
  const headCurator = curatorShuffled.slice(0, curatorTake);
  const tailCurator = curatorShuffled.slice(curatorTake);

  const body = [...headDb, ...interleaved, ...tailDb, ...tailCurator];
  const pinHead = headCurator.length > 0 && preferCuratorPicks;
  let merged =
    preferHiddenGems || pinHead
      ? [...headCurator, ...(preferHiddenGems ? body : shuffleCopy(body, rng))]
      : shuffleCopy([...headCurator, ...body], rng);

  // 「다른 조합」: 시작 오프셋 회전 후, 직전 코스 장소는 맨 뒤로
  merged = rotatePlacesByVariant(merged, variantSeed);
  merged = demoteExcludedPlaces(
    merged,
    opts.excludePlaceKeys,
    opts.placeKeyFn
  );

  const seen = new Set();
  const out = [];
  for (const p of merged) {
    const id = placeIdKey(p);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }

  return out.length >= 2 ? out : list;
}

/**
 * LLM 프롬프트용 — variant마다 다른 조합 힌트
 * @param {number} [variantSeed]
 * @param {{
 *   preferHiddenGems?: boolean,
 *   preferCuratorPicks?: boolean,
 *   parsed?: { dateMode?: string, intents?: { meeting?: boolean, after?: boolean }, raw?: string },
 *   avoidPlaceKeys?: string[],
 *   avoidPlaceNames?: string[],
 * }} [opts]
 */
export function diversityHintForVariant(variantSeed = 0, opts = {}) {
  const v = Math.abs(Math.floor(Number(variantSeed) || 0)) % 8;
  const hints = [
    "이번엔 **이전과 다른 조합**. 후보 목록 **앞 3곳만 쓰지 말고** 중·후반에서 최소 절반 이상 고르세요.",
    "카테고리·분위기를 바꾸고, **직전과 같은 상호는 넣지 마세요**. 동선만 비슷한 대체 집을 고르세요.",
    "덜 유명한 후보·골목 쪽을 중심으로. 유명점·인스타 핫플은 최대 1곳.",
    "순서를 뒤집거나 1차/2차 역할을 바꿔 새 동선을 짜세요. 같은 placeKey 재사용 금지에 가깝게.",
    "후보 JSON **뒤쪽 절반**에서 2곳 이상 반드시 포함. 앞쪽 인기점 반복 금지.",
    "식사·술·카페 비중을 직전과 다르게. 같은 업종만 연속하지 마세요.",
    "도보 동선은 유지하되 **스톱 구성을 70% 이상 교체**하세요.",
    "큐레이터 픽·블로그 근거 있는 곳과 덜 알려진 곳을 섞되, 직전 코스와 겹치지 않게.",
  ];
  let hint = hints[v];
  const avoidKeys = (Array.isArray(opts.avoidPlaceKeys) ? opts.avoidPlaceKeys : [])
    .map((k) => String(k || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const avoidNames = (Array.isArray(opts.avoidPlaceNames)
    ? opts.avoidPlaceNames
    : []
  )
    .map((n) => String(n || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  if (avoidKeys.length || avoidNames.length) {
    hint +=
      ` **금지(직전 코스)**: placeKey ${avoidKeys.join(", ") || "(없음)"}` +
      (avoidNames.length ? ` / 상호 ${avoidNames.join(", ")}` : "") +
      " — 가능하면 **한 곳도 다시 넣지 마세요**. 대안이 부족할 때만 최대 1곳.";
  }
  if (opts.preferHiddenGems) {
    hint +=
      " 유명 인스타 핫플·대형 프랜차이즈는 최대 1곳만, 나머지는 후보 중·후반·덜 알려진 곳 위주.";
  }
  if (opts.preferCuratorPicks && avoidKeys.length === 0) {
    hint +=
      " tags에 '큐레이터_내픽'이 있는 장소는 2곳 이상 꼭 포함해 주세요.";
  }
  const parsed =
    opts.parsed && typeof opts.parsed === "object" ? opts.parsed : null;
  const meeting =
    parsed?.dateMode === "meeting" || parsed?.intents?.meeting === true;
  const after =
    parsed?.intents?.after === true ||
    /2\s*차|이\s*차/.test(String(parsed?.raw || ""));
  if (meeting) {
    hint +=
      " 업무·미팅 맥락: 한정식·다이닝·일식·양식·룸 있는 레스토랑 등 접대·격식 있는 식사 장소 위주. 이자카야·체인·혼술·1인 주점·시끌 유흥은 절대 넣지 마세요.";
  }
  if (meeting && after) {
    hint +=
      " 2차는 와인바·칵테일바·조용한 라운지 위주. 이자카야·체인·호프·맥주 홀은 금지.";
  }
  return hint;
}

/**
 * 직전 코스와 겹치면 미사용 후보로 스텝을 교체 (LLM이 무시해도 강제 다양성)
 * @param {object|null} draft
 * @param {string[]} previousKeys
 * @param {object[]} candidatePlaces
 * @param {{ minStops?: number, keyFn?: (p: object) => string, nameFn?: (p: object) => string }} [opts]
 */
export function rewriteDraftStepsForDiversity(
  draft,
  previousKeys,
  candidatePlaces,
  opts = {}
) {
  if (!draft || !Array.isArray(draft.steps) || draft.steps.length < 2) {
    return draft;
  }
  const prev = new Set(
    (Array.isArray(previousKeys) ? previousKeys : [])
      .map((k) => String(k || "").trim())
      .filter(Boolean)
  );
  if (prev.size === 0) return draft;

  const minStops = Math.max(2, Number(opts.minStops) || draft.steps.length);
  const keyFn =
    typeof opts.keyFn === "function"
      ? opts.keyFn
      : (p) => String(p?.placeKey || p?.id || "").trim();
  const nameFn =
    typeof opts.nameFn === "function"
      ? opts.nameFn
      : (p) => String(p?.name || p?.place_name || "").trim();

  const used = new Set(
    draft.steps.map((s) => String(s?.placeKey || "").trim()).filter(Boolean)
  );
  const overlap = [...used].filter((k) => prev.has(k));
  if (overlap.length === 0) return draft;
  if (overlap.length / draft.steps.length < 0.5) return draft;

  const fresh = (Array.isArray(candidatePlaces) ? candidatePlaces : [])
    .map((p) => ({ key: keyFn(p), name: nameFn(p), place: p }))
    .filter((row) => row.key && !prev.has(row.key) && !used.has(row.key));

  if (fresh.length === 0) return draft;

  const steps = draft.steps.map((step) => ({ ...step }));
  let fi = 0;
  for (let i = 0; i < steps.length && fi < fresh.length; i++) {
    const key = String(steps[i]?.placeKey || "").trim();
    if (!prev.has(key)) continue;
    const next = fresh[fi++];
    used.delete(key);
    used.add(next.key);
    const label = next.name || next.key;
    steps[i] = {
      ...steps[i],
      placeKey: next.key,
      memo: `${label}`,
      visit_tip: "",
    };
  }

  const stillOverlap = steps.filter((s) =>
    prev.has(String(s?.placeKey || "").trim())
  ).length;
  if (stillOverlap === steps.length && steps.length >= minStops) {
    return draft;
  }

  return { ...draft, steps };
}

export function diversitySeedFromQuery(query, variantSeed = 0) {
  return (hashString(query) ^ (Number(variantSeed) || 0)) >>> 0;
}
