/**
 * 추천 한 줄 이유: 기본은 쿼리·장소 텍스트 기반.
 * `calculateLocalAIScores`가 `aiScoreSignals`를 붙인 경우(의도 축 점수)는
 * 그 신호로 `reasonShort`를 만들어 점수 근거와 한 줄이 맞물리게 한다.
 */

import { buildReasonFromSignals } from "./intentAxisScoring.js";

/** 같은 쿼리·업종이라도 장소마다 다른 한 줄이 나오도록 시드 */
function reasonVariantSeed(place) {
  const key = `${place?.category_name || ""}|${place?.place_name || place?.name || ""}|${place?.id ?? place?.place_id ?? place?.kakao_place_id ?? ""}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** @param {Record<string, unknown>} place @param {string[]} phrases */
function pickReasonPhrase(place, phrases) {
  if (!phrases?.length) return "";
  return phrases[reasonVariantSeed(place) % phrases.length];
}

function normalizeSiblingReasonLine(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** 목록 안에서만 겹칠 때 짧게 덧붙여 구분 */
function disambigReasonDuplicate(place, line) {
  const base = String(line || "").trim();
  if (!base) return base;
  const cat = String(place.category_name || place.category || "");
  const tail = cat.includes(">")
    ? cat.split(">").pop().trim().slice(0, 12)
    : cat.trim().slice(0, 12);
  if (tail.length >= 2 && !base.includes(tail)) {
    const extra = ` · ${tail}`;
    if (base.length + extra.length <= 96) return `${base}${extra}`;
  }
  const nm = String(place.place_name || place.name || "")
    .replace(/\s+/g, "")
    .slice(0, 5);
  if (nm.length >= 2 && !base.includes(nm)) {
    const extra = ` · ${nm}`;
    if (base.length + extra.length <= 96) return `${base}${extra}`;
  }
  return base;
}

/** @param {string} query @param {Record<string, unknown>} place */
export function extractReasonSignals(query, place) {
  const q = String(query || "").toLowerCase();
  const cat = `${place.category_name || ""} ${place.place_name || ""} ${place.category || ""}`.toLowerCase();

  const isDateContext = /소개팅|데이트|첫만남|맞선/.test(q);
  const isAfterContext = /끝나고|2차|이후|갈만한|한잔|마시러/.test(q);
  const wantsQuiet = /조용|차분|대화|얘기|담소/.test(q);
  const wantsMood = /분위기|감성|무드/.test(q);

  const isWineBar = /와인바|와인/.test(cat);
  const isBar = /바|펍|pub|칵테일|칵테일바|몰트바/.test(cat);
  const isIzakaya = /이자카야|사케|오뎅바|야키토리/.test(cat);
  const isCafe = /카페|커피|coffee|디저트/.test(cat);
  const isItalian = /이탈리안|파스타|피자|비스트로|다이닝/.test(cat);

  const isCheapMeal =
    /백반|기사식당|분식|해장국|국밥|순대국|김밥|도시락|구내식당|뷔페/.test(cat);

  const signals = {
    dateContext: 0,
    afterContext: 0,
    quietMood: 0,
    moodFit: 0,
    wineBarFit: 0,
    barFit: 0,
    izakayaFit: 0,
    cafeFit: 0,
    italianFit: 0,
    cheapMealPenalty: 0,
  };

  if (isDateContext) signals.dateContext = 2;
  if (isAfterContext) signals.afterContext = 2;
  if (wantsQuiet) signals.quietMood = 1.5;
  if (wantsMood) signals.moodFit = 1.2;

  if (isWineBar) signals.wineBarFit = 2.2;
  if (isBar) signals.barFit = 1.8;
  if (isIzakaya) signals.izakayaFit = 1.5;
  if (isCafe) signals.cafeFit = wantsQuiet ? 1.5 : 0.8;
  if (isItalian) signals.italianFit = 1.4;

  if ((isDateContext || isAfterContext) && isCheapMeal) {
    signals.cheapMealPenalty = -3.5;
  }

  return signals;
}

/**
 * @param {string} query
 * @param {Record<string, unknown>} place
 * @param {Record<string, number>} _signals
 * @param {{ keywordAiFallback?: boolean }} [options]
 */
export function buildReasonShort(query, place, _signals, options = {}) {
  const q = String(query || "").toLowerCase();
  const { keywordAiFallback = false } = options;

  const isDateContext = /소개팅|데이트|첫만남|맞선/.test(q);
  const isAfterContext = /끝나고|2차|이후|갈만한|한잔|마시러/.test(q);
  const wantsQuiet = /조용|차분|대화|얘기|담소/.test(q);
  const wantsMood = /분위기|감성|무드/.test(q);

  const cat = `${place.category_name || ""} ${place.place_name || ""} ${place.category || ""}`.toLowerCase();
  const isWineBar = /와인바|와인/.test(cat);
  const isBar = /바|펍|pub|칵테일|칵테일바|몰트바/.test(cat);
  const isIzakaya = /이자카야|사케|오뎅바|야키토리/.test(cat);
  const isCafe = /카페|커피|coffee|디저트/.test(cat);
  const isItalian = /이탈리안|파스타|피자|비스트로|다이닝/.test(cat);

  if (isDateContext && isAfterContext) {
    if (isWineBar) {
      return pickReasonPhrase(place, [
        "소개팅 분위기 이어가기 좋은 와인바예요",
        "2차로도 자연스러운 와인바 분위기예요",
        "대화 이어가기 좋은 와인바로 골랐어요",
        "부담 없이 한 잔 나누기 좋은 와인바예요",
        "소개팅 끝나고 가기 무난한 와인바예요",
      ]);
    }
    if (isBar) {
      return pickReasonPhrase(place, [
        "소개팅 2차로 가볍게 한잔하기 좋은 바예요",
        "2차로 부담 덜한 바 분위기예요",
        "가볍게 마무리하기 좋은 바로 봤어요",
        "소개팅 이어가기 편한 바 자리예요",
      ]);
    }
    if (isIzakaya) {
      return pickReasonPhrase(place, [
        "소개팅 자연스럽게 2차로 이어가기 좋은 곳이에요",
        "2차로 분위기 전환하기 좋은 이자카야예요",
        "안주 골라 먹으며 이어가기 좋은 곳이에요",
        "소개팅 끝 무렵 가기 좋은 술집 분위기예요",
      ]);
    }
    if (isCafe && wantsQuiet) {
      return pickReasonPhrase(place, [
        "소개팅 조용하게 대화 이어가기 좋은 카페예요",
        "2차 대화용으로 차분한 카페예요",
        "얘기 정리하기 좋은 조용한 카페예요",
      ]);
    }
    if (isItalian) {
      return pickReasonPhrase(place, [
        "분위기 이어서 식사하기 좋은 자리라 포함했어요",
        "데이트 식사로 이어가기 좋은 이탈리안이에요",
        "자리 잡고 느긋히 먹기 좋은 곳이에요",
      ]);
    }

    if (keywordAiFallback) {
      return pickReasonPhrase(place, [
        "소개팅에 맞는 분위기까지 넓혀 포함했어요",
        "비슷한 무드 후보를 더 넓혀 봤어요",
        "맥락 맞는 후보를 조금 더 포함했어요",
      ]);
    }
    return pickReasonPhrase(place, [
      "소개팅에 무난한 선택지예요",
      "소개팅 흐름에 어울리는 후보예요",
      "부담 없이 고르기 좋은 곳이에요",
    ]);
  }

  if (isDateContext) {
    if (isWineBar) {
      const moodExtra = wantsMood
        ? [
            "감성 무드 나기 좋은 와인바예요",
            "분위기 잡기 좋은 와인바로 골랐어요",
          ]
        : [];
      return pickReasonPhrase(place, [
        "데이트 분위기와 잘 맞는 와인바라 골랐어요",
        "와인 한 잔 나누기 좋은 데이트 장소예요",
        "느긋하게 앉아 있기 좋은 와인바예요",
        "대화하기 좋은 와인바 분위기예요",
        "데이트용으로 무난한 와인바예요",
        ...moodExtra,
      ]);
    }
    if (isBar) {
      return pickReasonPhrase(place, [
        "분위기 있게 한잔하기 좋은 바로 봤어요",
        "데이트에 어울리는 바 무드예요",
        "가볍게 한 잔하기 좋은 바예요",
        "부담 적은 데이트 바로 골랐어요",
      ]);
    }
    if (isCafe && wantsQuiet) {
      return pickReasonPhrase(place, [
        "조용하게 얘기 나누기 좋은 카페예요",
        "데이트 대화용으로 차분한 카페예요",
        "한적하게 앉기 좋은 카페예요",
      ]);
    }
    if (isItalian) {
      return pickReasonPhrase(place, [
        "데이트 식사 자리로 무난한 선택지예요",
        "느긋한 식사 데이트에 맞는 곳이에요",
        "자리 잡고 대화하기 좋은 이탈리안이에요",
      ]);
    }

    if (keywordAiFallback) {
      return pickReasonPhrase(place, [
        "데이트 분위기와 비슷한 후보까지 넓혀 포함했어요",
        "비슷한 톤의 장소를 더 넓혀 봤어요",
        "데이트 맥락에 가까운 후보를 포함했어요",
      ]);
    }
    return pickReasonPhrase(place, [
      "데이트 맥락에서 무난하게 보기 좋은 곳이에요",
      "데이트에 어울리는 후보예요",
      "부담 없이 가볼 만한 곳이에요",
    ]);
  }

  if (wantsQuiet) {
    if (isCafe) {
      return pickReasonPhrase(place, [
        "조용하게 대화 나누기 좋은 카페예요",
        "차분한 대화에 맞는 카페예요",
        "한적한 자리가 나기 좋은 카페예요",
      ]);
    }
    if (isWineBar) {
      return pickReasonPhrase(place, [
        "차분하게 분위기 내기 좋은 와인바예요",
        "대화 중심으로 앉기 좋은 와인바예요",
        "시끄럽지 않은 와인바로 봤어요",
      ]);
    }
    if (isBar) {
      return pickReasonPhrase(place, [
        "시끌벅적한 곳보다 대화 중심으로 보기 좋은 바예요",
        "얘기 나누기 무난한 바 분위기예요",
        "차분한 쪽 바로 골랐어요",
      ]);
    }
  }

  if (keywordAiFallback) {
    return pickReasonPhrase(place, [
      "조건과 비슷한 분위기까지 넓혀 포함했어요",
      "검색과 가까운 후보를 더 넓혀 봤어요",
      "비슷한 느낌의 장소를 포함했어요",
    ]);
  }

  if (isWineBar) {
    return pickReasonPhrase(place, [
      "분위기 있게 한잔하기 좋은 와인바예요",
      "와인 한 잔 즐기기 좋은 곳이에요",
      "느긋한 와인바 분위기예요",
      "가볍게 들렀다 가기 좋은 와인바예요",
      wantsMood ? "감성 잡기 좋은 와인바예요" : null,
    ].filter(Boolean));
  }
  if (isBar) {
    return pickReasonPhrase(place, [
      "가볍게 들르기 좋은 바예요",
      "한 잔하기 부담 없는 바예요",
      "들렀다 가기 좋은 바 분위기예요",
      "가까운 바 후보로 골랐어요",
    ]);
  }
  if (isCafe) {
    return pickReasonPhrase(place, [
      "잠깐 쉬어가기 좋은 카페예요",
      "잠시 앉기 좋은 카페예요",
      "쉬었다 가기 무난한 카페예요",
    ]);
  }
  if (isItalian) {
    return pickReasonPhrase(place, [
      "식사 자리로 무난한 곳이에요",
      "한 끼 먹기 좋은 이탈리안이에요",
      "느긋한 식사에 맞는 곳이에요",
    ]);
  }

  return pickReasonPhrase(place, [
    "검색 조건과 맞는 후보로 골랐어요",
    "조건에 맞게 포함한 장소예요",
    "검색 맥락에 맞는 후보예요",
  ]);
}

/**
 * @param {string} query
 * @param {Array<Record<string, unknown>>} places
 * @param {{ keywordAiFallback?: boolean; debugReasonSignals?: boolean }} [options]
 */
export function enrichPlacesWithReason(query, places, options = {}) {
  if (!Array.isArray(places)) return places;
  const out = places.map((place) => {
    const fromScore = place?.aiScoreSignals;
    const hasScoreSignals =
      fromScore &&
      typeof fromScore === "object" &&
      Object.keys(fromScore).length > 0 &&
      Object.values(fromScore).some((v) => Number(v) > 0);

    if (hasScoreSignals) {
      return {
        ...place,
        reasonSignals: fromScore,
        reasonShort: buildReasonFromSignals(fromScore, place),
      };
    }

    const reasonSignals = extractReasonSignals(query, place);
    const reasonShort = buildReasonShort(query, place, reasonSignals, options);
    return { ...place, reasonSignals, reasonShort };
  });

  const usedLines = new Set();
  const deduped = out.map((place) => {
    const fromScore = place?.aiScoreSignals;
    const hasScoreSignals =
      fromScore &&
      typeof fromScore === "object" &&
      Object.keys(fromScore).length > 0 &&
      Object.values(fromScore).some((v) => Number(v) > 0);

    const originalShort = place.reasonShort;
    const originalKey = normalizeSiblingReasonLine(originalShort);

    if (!hasScoreSignals) {
      let reasonShort = originalShort;
      let tries = 0;
      while (
        tries < 8 &&
        reasonShort &&
        usedLines.has(normalizeSiblingReasonLine(reasonShort))
      ) {
        tries += 1;
        reasonShort = disambigReasonDuplicate(place, reasonShort);
      }
      if (reasonShort) usedLines.add(normalizeSiblingReasonLine(reasonShort));
      const whyWasSame =
        place.whyRecommended != null &&
        normalizeSiblingReasonLine(place.whyRecommended) === originalKey;
      return {
        ...place,
        reasonShort,
        ...(whyWasSame ? { whyRecommended: reasonShort } : {}),
      };
    }

    let salt = 0;
    const maxTry = 40;
    let reasonShort = originalShort;
    while (salt < maxTry) {
      const candidate =
        salt === 0
          ? reasonShort
          : buildReasonFromSignals(fromScore, place, { phraseSalt: salt });
      const k = normalizeSiblingReasonLine(candidate);
      if (!usedLines.has(k)) {
        usedLines.add(k);
        reasonShort = candidate;
        break;
      }
      salt += 1;
    }
    if (salt >= maxTry) {
      reasonShort = disambigReasonDuplicate(place, reasonShort);
      usedLines.add(normalizeSiblingReasonLine(reasonShort));
    }
    const whyWasSame =
      place.whyRecommended != null &&
      normalizeSiblingReasonLine(place.whyRecommended) === originalKey;
    return {
      ...place,
      reasonShort,
      ...(whyWasSame ? { whyRecommended: reasonShort } : {}),
    };
  });

  if (import.meta.env.DEV && options.debugReasonSignals) {
    console.log(
      "[reason-signals]",
      deduped.slice(0, 12).map((p) => ({
        name: p.place_name || p.name,
        category: p.category_name,
        signals: p.reasonSignals,
        reasonShort: p.reasonShort,
      }))
    );
  }
  return deduped;
}
