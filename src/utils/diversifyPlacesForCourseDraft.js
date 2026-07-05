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

/** 카카오 category_name / DB category → 거친 버킷 */
export function categoryBucketForPlace(place) {
  const cat = String(
    place?.category || place?.category_name || ""
  ).trim();
  if (/베이커|빵|제과|브런치|제빵/.test(cat)) return "bakery";
  if (/카페|커피|디저트|티하우스/.test(cat)) return "cafe";
  if (/술|바|펍|호프|이자카야|와인|칵테일/.test(cat)) return "bar";
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
      variantSeed ^
      list.length ^
      (preferHiddenGems ? 0x9e3779b9 : 0)) >>>
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
  const merged =
    preferHiddenGems || pinHead
      ? [...headCurator, ...(preferHiddenGems ? body : shuffleCopy(body, rng))]
      : shuffleCopy([...headCurator, ...body], rng);

  const seen = new Set();
  const out = [];
  for (const p of merged) {
    const id = String(p?.id || p?.name || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }

  return out.length >= 2 ? out : list;
}

/**
 * LLM 프롬프트용 — variant마다 다른 조합 힌트
 * @param {number} [variantSeed]
 * @param {{ preferHiddenGems?: boolean, preferCuratorPicks?: boolean, parsed?: { dateMode?: string, intents?: { meeting?: boolean, after?: boolean } } }} [opts]
 */
export function diversityHintForVariant(variantSeed = 0, opts = {}) {
  const v = Math.abs(Math.floor(Number(variantSeed) || 0)) % 4;
  const hints = [
    "유명한 1~2곳 + 후보 중 덜 뻔한 곳을 섞어 주세요. 같은 프랜차이즈 연속 금지.",
    "카테고리를 골고루(빵·카페·식사 등) 섞고, 동선이 한쪽에 몰리지 않게 순서를 짜 주세요.",
    "후보 목록 앞쪽만 고르지 말고, 중·후반 후보도 2곳 이상 포함해 주세요.",
    "인스타 유명점만 나열하지 말고, 포장·테이크아웃·조용한 곳 등 분위기를 섞어 주세요.",
  ];
  let hint = hints[v];
  if (opts.preferHiddenGems) {
    hint +=
      " 유명 인스타 핫플·대형 프랜차이즈는 최대 1곳만, 나머지는 후보 중·후반·덜 알려진 곳 위주.";
  }
  if (opts.preferCuratorPicks) {
    hint +=
      " tags에 '큐레이터_내픽'이 있는 장소는 2곳 이상 꼭 포함해 주세요.";
  }
  const parsed = opts.parsed && typeof opts.parsed === "object" ? opts.parsed : null;
  const meeting =
    parsed?.dateMode === "meeting" || parsed?.intents?.meeting === true;
  const after =
    parsed?.intents?.after === true || /2\s*차|이\s*차/.test(String(parsed?.raw || ""));
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

export function diversitySeedFromQuery(query, variantSeed = 0) {
  return (hashString(query) ^ (Number(variantSeed) || 0)) >>> 0;
}
