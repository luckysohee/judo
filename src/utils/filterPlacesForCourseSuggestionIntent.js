import {
  applyIntentAxisScoresWithSignals,
  classifyCategory,
  detectIntents,
} from "./intentAxisScoring.js";
import { placeBelongsToCourseArea } from "./generateCourseOptions.js";
import {
  getPlaceCategoryText,
  NOPO_CHAIN_NAME_FALSE_POSITIVE_RE,
  NOPO_FOOD_DRINK_CATEGORY_RE,
  placeLooksLikeChainStore,
  placeLooksLikeNonFoodVenue,
  rankAndFilterNopoPlaces,
  scoreNopoSignals,
} from "./nopoSearchProfile.js";
import { queryWantsNopoFoodFocus } from "./searchParser.js";

/** 업무 미팅에 어울리지 않는 이자카야·캐주얼 다점포 체인 */
export const MEETING_CASUAL_CHAIN_RE =
  /이자카야\s*무한|무한\s*리필|무한\s*천|990\s*원|토리덴|토리하치|토리키|토리토리|신파치|이소마루|isomaru|와타미|watami|쿠시카츠|kushikatsu|오사카오쇼|오\s*사카|규카츠|gyukaku|강남\s*토리|한신\s*포차|역전\s*우동|또봉이|육회\s*바른|삼겹\s*삼|오구|빕스|아웃백|outback|매드포|mad\s*for|vips|셀프\s*뷔페|샤브가든|계\s*닭|꼬치\s*연구소|닭\s*발/i;

function placeTextBlob(place) {
  const tags = Array.isArray(place?.tags) ? place.tags.join(" ") : "";
  return `${place?.name || place?.place_name || ""} ${place?.category || place?.category_name || ""} ${tags} ${place?.comment || place?.one_line_reason || ""}`.toLowerCase();
}

/** 혼술·1인 주점 등 업무 미팅과 어긋나는 장소 */
export function placeSignalsSoloDrinking(place) {
  const blob = placeTextBlob(place);
  if (
    /혼술|혼맥|혼바|혼\s*주|1인\s*주|솔로\s*바|나홀로|혼자\s*마시|퇴근\s*혼술|맥주\s*한잔\s*혼자|혼\s*술|혼\s*맥|혼\s*바|혼술마니|혼맥집|혼술집/.test(
      blob
    )
  ) {
    return true;
  }
  const tags = Array.isArray(place?.tags) ? place.tags : [];
  return tags.some((t) => /혼술|1인|솔로|나홀로/i.test(String(t)));
}

/** 미팅 맥락에서 피할 시끌·유흥·포장마차·캐주얼 체인 */
export function placeSignalsMeetingMismatch(place) {
  const blob = placeTextBlob(place);
  if (
    /헌팅|감성주점|클럽|나이트|룸살롱|노래방|포장마차|포차|맥주\s*홀|호프\s*집|락\s*바|헤비\s*메탈|호프|맥주집|주점\s*>|일반\s*주점|실내\s*포장|감성\s*펍/.test(
      blob
    )
  ) {
    return true;
  }
  return placeSignalsMeetingCasualChain(place);
}

/** 이자카야·캐주얼 체인 — 업무·접대 미팅 부적합 */
export function placeSignalsMeetingCasualChain(place) {
  const blob = placeTextBlob(place);
  if (blob && NOPO_CHAIN_NAME_FALSE_POSITIVE_RE.test(blob)) return false;
  if (MEETING_CASUAL_CHAIN_RE.test(blob)) return true;
  return placeLooksLikeChainStore(place);
}

/** 접대·비즈니스에 어울리는 고급·격식 신호 */
export function placeSignalsMeetingUpscale(place) {
  const blob = placeTextBlob(place);
  return /룸|개별\s*룸|프라이빗|private|vip|접대|비즈니스|회의|상담|미팅|오마카세|다이닝|코스\s*요리|파인\s*다이닝|한정식|고급|프리미엄|격식|조용|차분|회의실|장당\s*룸|단체\s*룸|세미나|스시|초밥|프렌치|스테이크/i.test(
    blob
  );
}

export function placeSignalsMeetingPrivateRoom(place) {
  const blob = placeTextBlob(place);
  return /룸|프라이빗|private|vip\s*룸|개별\s*룸|단체\s*룸|장당\s*룸|회의실|접대|한상차림/i.test(
    blob
  );
}

function placeSignalsMeetingCasualIzakaya(place) {
  const cat = classifyCategory(toClassifyPlace(place));
  return cat.izakaya && !placeSignalsMeetingUpscale(place);
}

function toClassifyPlace(place) {
  return {
    category_name: String(place?.category || place?.category_name || ""),
    place_name: String(place?.name || place?.place_name || ""),
  };
}

/** 업무 미팅 2차 — 와인·칵테일·라운지 (이자카야·체인 제외) */
export function placeSuitableForMeetingAfter(place) {
  if (!placeIsFoodOrDrinkVenue(place)) return false;
  if (placeSignalsSoloDrinking(place) || placeSignalsMeetingMismatch(place)) {
    return false;
  }
  if (placeSignalsMeetingCasualIzakaya(place)) return false;
  const cat = classifyCategory(toClassifyPlace(place));
  if (cat.loud || cat.cheap || cat.outdoor || cat.izakaya) return false;
  const blob = placeTextBlob(place);
  return (
    cat.winebar ||
    (cat.bar && /칵테일|와인|라운지|바\s*>/i.test(blob)) ||
    (cat.cafe && /룸|프라이빗|조용|라운지/i.test(blob))
  );
}

/** 업무·미팅 코스 후보 — 1차/2차·혼합 질의 공통 */
export function placeSuitableForMeetingCourse(query, place) {
  if (!placeIsFoodOrDrinkVenue(place)) return false;
  if (placeSignalsSoloDrinking(place) || placeSignalsMeetingMismatch(place)) {
    return false;
  }
  const intent = detectIntents(query);
  const after = isMeetingAfterQuery(query, intent);
  const primaryOnly = isMeetingPrimaryQuery(query) && !after;

  if (primaryOnly) return placeSuitableForMeetingPrimary(place);
  if (after && !isMeetingPrimaryQuery(query)) {
    return placeSuitableForMeetingAfter(place);
  }
  return (
    placeSuitableForMeetingPrimary(place) ||
    placeSuitableForMeetingAfter(place)
  );
}

/** 식음·술집 후보인지 — 화장품·편의점 등 소매·전문업 제외 */
export function placeIsFoodOrDrinkVenue(place) {
  if (placeLooksLikeNonFoodVenue(place)) return false;
  const catText = getPlaceCategoryText(place);
  if (catText && NOPO_FOOD_DRINK_CATEGORY_RE.test(catText)) return true;
  const cat = classifyCategory(toClassifyPlace(place));
  return Boolean(
    cat.winebar ||
      cat.bar ||
      cat.izakaya ||
      cat.cafe ||
      cat.koreanFine ||
      cat.italian ||
      cat.restaurant
  );
}

function isMeetingAfterQuery(query, intent) {
  return (
    intent.after ||
    /2\s*차|3\s*차|이\s*차|삼\s*차|끝나고|뒷풀이/.test(String(query || ""))
  );
}

function isMeetingPrimaryQuery(query) {
  return /1\s*차|일\s*차/.test(String(query || ""));
}

/** 업무 미팅 1차 — 한정식·다이닝·일식·양식 (이자카야·체인·주점 제외) */
export function placeSuitableForMeetingPrimary(place) {
  if (!placeIsFoodOrDrinkVenue(place)) return false;
  if (placeSignalsSoloDrinking(place) || placeSignalsMeetingMismatch(place)) {
    return false;
  }
  if (placeSignalsMeetingCasualIzakaya(place)) return false;
  const cat = classifyCategory(toClassifyPlace(place));
  if (cat.loud || cat.cheap || cat.outdoor || cat.izakaya || cat.bar) {
    return false;
  }
  const blob = placeTextBlob(place);
  if (cat.winebar) return false;
  if (cat.koreanFine || cat.italian) return true;
  if (
    cat.restaurant &&
    /일식|양식|프렌치|스테이크|오마카세|스시|초밥|중식|한식|다이닝|코스|레스토랑/i.test(
      blob
    )
  ) {
    return true;
  }
  return (
    cat.cafe &&
    /룸|프라이빗|조용|미팅|회의|접대/i.test(blob) &&
    !/디저트\s*전문|베이커리/i.test(blob)
  );
}

/**
 * @param {string} query
 * @param {object} place
 * @returns {{ score: number, signals: Record<string, number>, intent: ReturnType<typeof detectIntents> }}
 */
export function scorePlaceForCourseSuggestionIntent(query, place) {
  const intent = detectIntents(query);
  const cat = classifyCategory(toClassifyPlace(place));
  const { score: axisScore, signals } = applyIntentAxisScoresWithSignals(
    intent,
    cat,
    10
  );
  let score = axisScore;

  if (intent.meeting) {
    if (!placeIsFoodOrDrinkVenue(place)) {
      score -= 40;
      signals.penalty_non_food_venue = -40;
    }
    if (placeSignalsSoloDrinking(place)) {
      score -= 28;
      signals.penalty_meeting_solo = -28;
    }
    if (placeSignalsMeetingMismatch(place)) {
      score -= 12;
      signals.penalty_meeting_mismatch = -12;
    }
    if (placeSignalsMeetingCasualChain(place)) {
      score -= 35;
      signals.penalty_meeting_chain = -35;
    }
    if (placeSignalsMeetingCasualIzakaya(place)) {
      score -= 22;
      signals.penalty_meeting_izakaya = -22;
    }
    if (placeSignalsMeetingUpscale(place)) {
      score += 8;
      signals.meeting_upscale = 8;
    }
    if (placeSignalsMeetingPrivateRoom(place)) {
      score += 6;
      signals.meeting_private_room = 6;
    }
    if (intent.after) {
      if (cat.winebar) score += 2;
      if (cat.loud || cat.outdoor) score -= 6;
    }
  }

  if (/혼술|혼자/.test(String(query || "")) && placeSignalsSoloDrinking(place)) {
    score += 6;
    signals.solo_match = 6;
  }

  return { score, signals, intent };
}

/**
 * 업무·미팅 검색 시 카카오/통합 검색 phrase 보강.
 * @param {string} query
 * @param {{ area?: string | null }} parsed
 */
export function buildMeetingCourseSearchPhrases(query, parsed) {
  const area = String(parsed?.area || "").trim();
  if (!area) return [];
  const intent = detectIntents(query);
  if (!intent.meeting) return [];

  const after =
    intent.after || /2\s*차|이\s*차|끝나고|끝나서|뒷풀이/i.test(String(query || ""));

  if (after) {
    return [
      `${area} 와인바`,
      `${area} 칵테일바`,
      `${area} 조용한 라운지`,
    ];
  }

  return [
    `${area} 한정식`,
    `${area} 다이닝`,
    `${area} 일식당`,
    `${area} 양식`,
    `${area} 룸 있는 레스토랑`,
  ];
}

/**
 * 친구·왁자지껄·3차 등 — 지역 고정 술자리 검색 phrase.
 * @param {string} query
 * @param {{ area?: string | null }} parsed
 */
export function buildPartyCourseSearchPhrases(query, parsed) {
  const area = String(parsed?.area || "").trim();
  if (!area) return [];
  const q = String(query || "");
  const intent = detectIntents(q);
  if (intent.meeting) return [];

  if (queryWantsNopoFoodFocus(q, null)) {
    // bare 「술집」은 심야식당·호프를 끌어오므로 노포 신호 문구만
    return [
      `${area} 노포`,
      `${area} 포차`,
      `${area} 막걸리`,
      `${area} 선술집`,
      `${area} 골목 포차`,
    ];
  }

  const party =
    intent.after ||
    intent.drink ||
    /왁자|시끌|신나|친구|회식|뒷풀이|술자리|3\s*차|삼\s*차/.test(q);
  if (!party) return [];

  return [
    `${area} 술집`,
    `${area} 포차`,
    `${area} 와인바`,
    `${area} 칵테일바`,
    `${area} 이자카야`,
  ];
}

/**
 * 미팅 질의에서 혼술·포괄 술집 phrase 제거 + 미팅용 phrase 앞쪽 배치.
 */
export function refineSearchPhrasesForCourseIntent(query, phrases, parsed) {
  const list = Array.isArray(phrases) ? phrases.map((s) => String(s || "").trim()).filter(Boolean) : [];
  const intent = detectIntents(query);
  const partyFirst = buildPartyCourseSearchPhrases(query, parsed);
  const meetingFirst = buildMeetingCourseSearchPhrases(query, parsed);
  const prefix = [...partyFirst, ...meetingFirst];
  const out = [...prefix];
  const seen = new Set(prefix.map((s) => s.toLowerCase()));

  if (!intent.meeting) {
    for (const phrase of list) {
      const low = phrase.toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      out.push(phrase);
    }
    return [...new Set(out)];
  }

  for (const phrase of list) {
    const low = phrase.toLowerCase();
    if (seen.has(low)) continue;
    if (/혼술|1인|혼맥|혼바|솔로/i.test(phrase)) continue;
    if (/이자카야|야키토리|꼬치\s*구이/i.test(phrase)) continue;
    if (
      intent.after &&
      /술집|맥주|호프|포차|포장마차/.test(phrase) &&
      !/와인|칵테일|라운지|바\s/.test(phrase)
    ) {
      continue;
    }
    seen.add(low);
    out.push(phrase);
  }
  return out;
}

/**
 * LLM 초안 steps에서 의도에 맞지 않는 placeKey 제거.
 * @param {string} query
 * @param {object|null} draft
 * @param {Map<string, object>} placeByKey
 */
export function sanitizeCourseDraftForIntent(query, draft, placeByKey) {
  if (!draft || !Array.isArray(draft.steps) || draft.steps.length < 2) {
    return draft;
  }
  const q = String(query || "");
  const intent = detectIntents(q);
  const wantsNopo = queryWantsNopoFoodFocus(q, null);
  if (!intent.meeting && !wantsNopo) return draft;

  const map =
    placeByKey instanceof Map
      ? placeByKey
      : new Map(Object.entries(placeByKey || {}));

  let steps = draft.steps;
  if (wantsNopo) {
    const nopoSteps = steps.filter((step) => {
      const key = String(step?.placeKey || "").trim();
      const place = map.get(key);
      if (!place) return false;
      const { score, disallowed, signals } = scoreNopoSignals(place);
      // wide pool과 맞춤: 체인·심야만 제외 (score≥3만 남기면 6곳만 순환)
      return (
        !disallowed &&
        score >= 1 &&
        !signals?.includes("modern_false_positive")
      );
    });
    if (nopoSteps.length >= 2) steps = nopoSteps;
  }

  if (intent.meeting) {
    steps = steps.filter((step) => {
      const key = String(step?.placeKey || "").trim();
      const place = map.get(key);
      if (!place) return true;
      if (!placeIsFoodOrDrinkVenue(place)) return false;
      if (placeSignalsSoloDrinking(place) || placeSignalsMeetingMismatch(place)) {
        return false;
      }
      if (!placeSuitableForMeetingCourse(query, place)) return false;
      return true;
    });
  }

  if (steps.length === 0) return draft;
  return { ...draft, steps };
}

/**
 * LLM 초안 steps에서 검색 지역 밖 placeKey 제거.
 * @param {{ area?: string | null }} parsed
 * @param {object|null} draft
 * @param {Map<string, object>} placeByKey
 */
export function sanitizeCourseDraftForArea(parsed, draft, placeByKey) {
  const area = String(parsed?.area || "").trim();
  if (!area || !draft || !Array.isArray(draft.steps) || draft.steps.length < 2) {
    return draft;
  }

  const map =
    placeByKey instanceof Map
      ? placeByKey
      : new Map(Object.entries(placeByKey || {}));

  const steps = draft.steps.filter((step) => {
    const key = String(step?.placeKey || "").trim();
    const place = map.get(key);
    if (!place) return false;
    return placeBelongsToCourseArea(place, area);
  });

  if (steps.length === 0) return draft;
  return {
    ...draft,
    area,
    steps,
  };
}

/**
 * 의도에 맞게 후보 정렬·저점 제거. 최소 개수는 유지.
 * @param {string} query
 * @param {object[]} places
 * @param {{ minKeep?: number, minAbsolute?: number }} [opts]
 */
export function filterPlacesForCourseSuggestionIntent(query, places, opts = {}) {
  const minKeep = Number.isFinite(Number(opts.minKeep)) ? Number(opts.minKeep) : 10;
  const minAbsolute = Number.isFinite(Number(opts.minAbsolute))
    ? Number(opts.minAbsolute)
    : 2;
  const list = Array.isArray(places) ? places.filter(Boolean) : [];
  if (list.length <= minAbsolute) return list;

  const q = String(query || "");
  if (queryWantsNopoFoodFocus(q, null)) {
    const scored = list.map((place) => ({
      place,
      ...scoreNopoSignals(place),
    }));
    const allowed = scored.filter((row) => !row.disallowed);
    const positive = allowed
      .filter((row) => row.score >= 3)
      .sort((a, b) => b.score - a.score);
    // 코스 다양성: 체인·심야만 빼고 식음 후보를 넓게 (점수순 최대 28)
    if (opts.nopoWidePool) {
      const wide = allowed
        .filter(
          (row) =>
            row.score >= 1 &&
            !row.signals?.includes("modern_false_positive")
        )
        .sort((a, b) => b.score - a.score);
      const take = Math.min(
        28,
        Math.max(minKeep, wide.length, positive.length)
      );
      if (wide.length >= minAbsolute) {
        // 강한 노포를 앞에, 나머지는 점수순으로 채워 조합 여지 확보
        const strongKeys = new Set(
          positive.map((row) => String(row.place?.id || row.place?.name || ""))
        );
        const rest = wide.filter(
          (row) =>
            !strongKeys.has(String(row.place?.id || row.place?.name || ""))
        );
        return [...positive, ...rest]
          .slice(0, take)
          .map((row) => row.place);
      }
    }
    // 노포 신호가 있는 후보가 있으면 그쪽으로만 — 일반 호프·심야식당 섞지 않음
    if (positive.length >= minAbsolute) {
      return positive.map((row) => row.place);
    }
    // soft: 역사·분위기 신호 있는 약한 후보만 (venue_kind만 있는 술집 제외)
    if (opts.nopoSoftFallback) {
      const soft = allowed
        .filter(
          (row) =>
            row.score >= 2 &&
            (row.signals?.includes("history") ||
              row.signals?.includes("atmosphere") ||
              row.signals?.includes("curator_nopo") ||
              row.signals?.includes("blog_nopo"))
        )
        .sort((a, b) => b.score - a.score);
      if (soft.length >= minAbsolute) {
        return soft.map((row) => row.place);
      }
    }
    const nopoKept = rankAndFilterNopoPlaces(list, {
      minKeep: Math.max(minAbsolute, Math.min(8, minKeep)),
      strict: !opts.nopoSoftFallback,
    });
    if (nopoKept.length >= minAbsolute) return nopoKept;
    // 노포 근거 없으면 빈 배열에 가깝게 — 일반 술집으로 채우지 않음
    return positive.map((row) => row.place);
  }

  const intent = detectIntents(query);
  const shouldRank =
    intent.meeting ||
    intent.date ||
    intent.after ||
    intent.quiet ||
    /혼술|혼자/.test(q);

  if (!shouldRank) return list;

  const scored = list.map((place) => ({
    place,
    ...scorePlaceForCourseSuggestionIntent(query, place),
  }));
  scored.sort((a, b) => b.score - a.score);

  if (intent.meeting) {
    const withoutSolo = scored.filter(
      (row) => !placeSignalsSoloDrinking(row.place)
    );
    let pool = withoutSolo.length >= minAbsolute ? withoutSolo : scored;

    const foodOnly = pool.filter((row) => placeIsFoodOrDrinkVenue(row.place));
    if (foodOnly.length >= minAbsolute) pool = foodOnly;

    const meetingPool = pool.filter((row) =>
      placeSuitableForMeetingCourse(query, row.place)
    );
    if (meetingPool.length > 0) pool = meetingPool;

    const threshold = isMeetingAfterQuery(query, intent) ? 6 : 2;
    const filtered = pool.filter((row) => row.score >= threshold);
    const chosen = filtered.length >= minAbsolute ? filtered : pool;
    const take = Math.min(list.length, Math.max(minKeep, minAbsolute));
    return chosen.slice(0, take).map((row) => row.place);
  }

  const take = Math.min(list.length, Math.max(minKeep, minAbsolute));
  return scored.slice(0, take).map((row) => row.place);
}
