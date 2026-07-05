/**
 * 「노포」검색 — 오래된·유서 있는 식당·술집 + 노포 분위기.
 * 연식 DB 없이 상호·카테고리·큐레이터·블로그 텍스트로 추정.
 */

import { collectReasonEvidence } from "./reasonEvidence.js";

/** 유흥·노래·단란 — 노포와 무관 */
export const NOPO_DISALLOWED_VENUE_RE =
  /유흥|노래방|코인노래|노래\s*주점|룸싸롱|단란주점|나이트\s*클럽|나이트클럽|가라오케|karaoke|캐비넷|매직미러|바다\s*유흥|쩜오|룸살롱|클럽\s*>|댄스\s*클럽/i;

/** 대형·다점포 프랜차이즈·체인 브랜드 (상호·카테고리·블로그 텍스트) */
export const NOPO_CHAIN_RE =
  /맥도날드|mcdonald|버거킹|burger\s*king|kfc|롯데리아|lotteria|맘스터치|mom'?s\s*touch|스타벅스|starbucks|서브웨이|subway|파리바게뜨|paris\s*baguette|뚜레쥬르|tous\s*les\s*jours|배스킨|baskin|던킨|dunkin|이디야|ediya|투썸|twosome|메가\s*mgc|메가mgc|mgc\s*커피|메가\s*커피|메가커피|컴포즈|compose|공차|gong\s*cha|빽다방|paik\s*'?s|할리스|hollys|탐앤탐스|tom\s*n\s*toms|폴바셋|paul\s*bassett|파스쿠찌|pascucci|엔제리너스|angelinus|커피빈|coffee\s*bean|블루보틀|blue\s*bottle|테라로사|terarosa|프릳츠|fritz|깔리|cali(?![a-z])|%?\s*arabica|아라비카|브루클린\s*커피|brooklyn\s*coffee|매머드|mammoth|요거프레소|yogerpresso|토프레소|카페봄봄|달콤\s*커피|달콤커피|바나프레소|커피에\s*반하다|더벤티|the\s*venti|커피\s*마마|커피마마|카페베네|caffe\s*bene|베스킨라빈스|설빙|sulbing|피자헛|pizza\s*hut|domino|도미노|mr\.?\s*pizza|미스터피자|bbq\s*chicken|bbq치킨|bhc|교촌|네네|굽네|goobne|치킨플러스|호식이|푸라닭|노브랜드|no\s*brand|cu(?![a-z])|gs25|세븐일레븐|7[\s-]?eleven|emart24|이마트24|배달의민족|쿠팡이츠|배달\s*전문|푸드코트|패스트푸드|버거\s*킹|subway|피자\s*스쿨|pizza\s*school/i;

/** 상호에 「체인」이 메뉴·별칭인 경우 — 프랜차이즈 오탐 방지 */
export const NOPO_CHAIN_NAME_FALSE_POSITIVE_RE =
  /노가리\s*체인|갈비\s*체인|꼬치\s*체인|사슴\s*체인|치즈\s*체인|떡\s*체인/i;

/** 역사·원조·골목·시장 — 강한 노포 신호 */
export const NOPO_HISTORY_RE =
  /원조|전통|할머니|할아버지|할매|할아버지|골목|시장|노포|개업\s*\d{2,4}|19[5-9]\d|20[0-1]\d\s*년|유서|명물|오래된|오랜|삼대|4대|5대|전통주|옛날|그때\s*그|시골|향토/i;

/** 분위기만으로도 노포 느낌 — 연식 미확인 허용 */
export const NOPO_ATMOSPHERE_RE =
  /노포감성|옛날감성|로컬맛집|숨은맛집|감성술집|골목길|골목\s*술|포장마차|실내포장|노천|야장|이자카야|선술|막걸리|동네\s*술|골목\s*바|골목\s*주점/i;

/** 음식점·술집 업종 (유흥 제외) */
export const NOPO_VENUE_KIND_RE =
  /한식|국밥|분식|식당|음식점|주점|호프|술집|포장마차|포차|이자카야|선술|요리주점|맥주|소주|와인|바(?![a-z])|펍|pub|food|restaurant/i;

/** 카카오 category — 식음·술집 (이게 있으면 비업소 카테고리 오탐 보정) */
export const NOPO_FOOD_DRINK_CATEGORY_RE =
  /음식|식당|한식|중식|일식|양식|분식|국밥|뷔페|주점|호프|술집|술|와인|칵테일|맥주|소주|포장마차|포차|이자카야|선술|요리|맛집|횟집|회집|해산물|고기|구이|치킨|피자|파스타|카페(?!인)|커피|베이커리|디저트|아이스크림|라운지|펍|pub|food|restaurant|cafe|bar/i;

/**
 * broad 키워드 검색 오탐 — 법률·행정·병원·학원 등 (상호에 「골목」「식당」 있어도 제외)
 */
export const NOPO_NON_VENUE_CATEGORY_RE =
  /법률|행정|법무|노무|변호|세무|회계|공증|특허|법원|검찰|공공|관공|구청|주민센터|동사무|시청|부동산|중개|임대|공인중개|병원|의원|약국|한의원|치과|피부|성형|안과|정형|내과|외과|산부|동물병원|학원|교육|독서실|어린이집|유치원|미용|네일|피부관리|마사지|화장품|화장|드럭|코스메틱|향수|스킨케어|패션|의류|잡화|생활용품|완구|애완|펫|반려|편의점|마트|슈퍼|대형마트|백화점|아울렛|주유|주차|세차|타이어|자동차|정비|은행|금융|보험|증권|대출|통신|휴대폰|컴퓨터|소프트웨어|전자|가전|가구|인테리어|철물|문구|서점|인쇄|복사|세탁|교회|성당|사찰|종교|예식|장례|운송|택배|물류|창고|공장|제조|건설|설계|측정|감정|pc방|피시방|영화|극장|공연|박물관|미술관|체육|헬스|골프|수영|테니스|호텔|모텔|펜션|민박|여행|숙박/i;

/** 상호만으로도 걸러낼 전문업 (카테고리 누락 대비) */
export const NOPO_DISALLOWED_PROFESSIONAL_NAME_RE =
  /노무(?:사|법|컨설팅)?|법무(?:사)?|변호(?:사)?|세무(?:사)?|법률(?:사무)?|공증|공인중개|행정사|특허(?:사)?|회계(?:사)?|감정평가/i;

export function getPlaceCategoryText(place) {
  if (!place || typeof place !== "object") return "";
  return [
    place.category_name,
    place.category,
    place.category_group_name,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ");
}

/** 식당·술집이 아닌 업종(카테고리·상호)인지 */
export function placeLooksLikeNonFoodVenue(place) {
  const cat = getPlaceCategoryText(place);
  if (cat && NOPO_FOOD_DRINK_CATEGORY_RE.test(cat)) return false;

  if (cat && NOPO_NON_VENUE_CATEGORY_RE.test(cat)) return true;

  const name = String(place?.place_name || place?.name || "").trim();
  if (
    name &&
    NOPO_DISALLOWED_PROFESSIONAL_NAME_RE.test(name) &&
    !(cat && NOPO_FOOD_DRINK_CATEGORY_RE.test(cat))
  ) {
    return true;
  }

  return false;
}

/** 알려진 체인·다점포 브랜드인지 (메뉴명 「노가리체인」 등은 제외) */
export function placeLooksLikeChainStore(place) {
  if (!place || typeof place !== "object") return false;
  const name = String(place?.place_name || place?.name || "").trim();
  if (name && NOPO_CHAIN_NAME_FALSE_POSITIVE_RE.test(name)) return false;
  const text = collectNopoHaystack(place);
  return Boolean(text && NOPO_CHAIN_RE.test(text));
}

/** 체인이어도 큐레이터 노포 태그가 있으면 유지 (1호점·원조 논쟁 케이스) */
export function chainStoreAllowedAsNopoException(place) {
  return placeSignalsNopoCuratorMeta(place);
}

const NOPO_CURATOR_META_RE =
  /노포|노포감성|옛날|로컬맛집|숨은맛집|전통|원조|골목|야장|포장마차/i;

export function collectNopoHaystack(place) {
  if (!place || typeof place !== "object") return "";
  const parts = [
    place.place_name,
    place.name,
    place.category_name,
    place.category,
    place.address_name,
    place.road_address_name,
    place.address,
    Array.isArray(place.tags) ? place.tags.join(" ") : "",
    Array.isArray(place.vibes) ? place.vibes.join(" ") : "",
    Array.isArray(place.moods) ? place.moods.join(" ") : "",
  ];
  if (place.curatorReasons && typeof place.curatorReasons === "object") {
    parts.push(Object.values(place.curatorReasons).join(" "));
  }
  if (Array.isArray(place.curatorPlaces)) {
    for (const cp of place.curatorPlaces) {
      parts.push(cp?.one_line_reason, cp?.menu_reason, cp?.one_line_review);
      if (Array.isArray(cp?.tags)) parts.push(cp.tags.join(" "));
    }
  }
  const ev = collectReasonEvidence(place);
  parts.push(ev.summary, ev.curatorLines.join(" "), ev.tags.join(" "));
  const bi = place.blogInsight;
  if (bi && typeof bi === "object") {
    parts.push(bi.summary, (bi.atmosphere || []).join(" "), (bi.menu || []).join(" "));
  }
  return parts
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function placeSignalsNopoCuratorMeta(place) {
  if (!place || typeof place !== "object") return false;
  const hit = (arr) =>
    Array.isArray(arr) &&
    arr.some(
      (x) =>
        typeof x === "string" &&
        x.trim() &&
        NOPO_CURATOR_META_RE.test(x),
    );
  return hit(place.tags) || hit(place.vibes) || hit(place.moods);
}

/**
 * @returns {{ score: number, signals: string[], disallowed: boolean }}
 */
export function scoreNopoSignals(place) {
  const text = collectNopoHaystack(place);
  const signals = [];
  let score = 0;

  if (NOPO_DISALLOWED_VENUE_RE.test(text) || /^[^>]*유흥[^>]*>/i.test(text)) {
    return { score: -100, signals: ["disallowed_venue"], disallowed: true };
  }
  if (placeLooksLikeNonFoodVenue(place)) {
    return { score: -100, signals: ["non_venue_category"], disallowed: true };
  }
  if (placeLooksLikeChainStore(place)) {
    if (chainStoreAllowedAsNopoException(place)) {
      score -= 8;
      signals.push("chain_curator_exception");
    } else {
      return { score: -100, signals: ["chain"], disallowed: true };
    }
  }

  if (NOPO_HISTORY_RE.test(text)) {
    score += 5;
    signals.push("history");
  }
  if (NOPO_ATMOSPHERE_RE.test(text)) {
    score += 3;
    signals.push("atmosphere");
  }
  if (NOPO_VENUE_KIND_RE.test(text)) {
    score += 1;
    signals.push("venue_kind");
  }
  if (placeSignalsNopoCuratorMeta(place)) {
    score += 6;
    signals.push("curator_nopo");
  }
  if (place.blogInsight && typeof place.blogInsight === "object") {
    const bs = String(place.blogInsight.summary || "").trim();
    if (
      bs.length >= 8 &&
      (NOPO_HISTORY_RE.test(bs) || NOPO_ATMOSPHERE_RE.test(bs))
    ) {
      score += 4;
      signals.push("blog_nopo");
    }
  }
  if (
    typeof place.curatorCount === "number" &&
    place.curatorCount > 0 &&
    score > 0
  ) {
    score += Math.min(place.curatorCount, 3);
    signals.push("curator_count");
  }

  return { score, signals, disallowed: false };
}

/**
 * 노포 필터 — 유흥 제거 후, 노포 신호 있는 곳 우선. 후보 부족 시 완화.
 * @param {object[]} places
 * @param {{ minKeep?: number }} [opts]
 */
export function rankAndFilterNopoPlaces(places, opts = {}) {
  const minKeep = Number(opts.minKeep) || 3;
  const list = Array.isArray(places) ? places : [];
  const scored = list.map((p) => ({ place: p, ...scoreNopoSignals(p) }));
  const allowed = scored.filter((row) => !row.disallowed);
  const positive = allowed.filter((row) => row.score >= 3);
  const weak = allowed.filter((row) => row.score >= 1);

  let picked =
    positive.length >= minKeep
      ? positive
      : weak.length >= minKeep
        ? weak
        : allowed;

  picked.sort((a, b) => b.score - a.score);
  return picked.map((row) => row.place);
}
