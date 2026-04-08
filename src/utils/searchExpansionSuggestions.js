import { REGION_KEYWORDS, normalizeParsedForScoring } from "./searchParser";

/**
 * 결과 0건일 때 조건 축별 완화 힌트 (클릭 액션 없음 — `suggestions` 칩과 병행).
 */
export function getFallbackSuggestions(parsed) {
  const p = normalizeParsedForScoring(parsed || {});
  const suggestions = [];

  if (p.alcohols.length > 0) {
    suggestions.push("주종 조건을 빼고 비슷한 분위기로 찾아볼까요?");
  }
  if (p.vibes.length > 0) {
    suggestions.push("분위기 조건을 조금 넓혀서 볼까요?");
  }
  if (p.regions.length > 0) {
    suggestions.push(`${p.regions[0]} 근처 지역까지 넓혀서 볼까요?`);
  }
  if (p.purposes.length > 0) {
    suggestions.push("1차/2차 구분 없이 다시 찾아볼까요?");
  }
  suggestions.push("큐레이터 저장이 많은 순으로 볼까요?");

  return suggestions;
}

/**
 * 쿼리 문자열에서 가장 구체적인 지역 라벨 추출 (압구정 > 강남 등)
 */
export function pickAreaLabelFromQuery(query, parsedRegion) {
  const q = String(query || "");
  let best = "";
  for (const [canonical, aliases] of Object.entries(REGION_KEYWORDS)) {
    for (const a of aliases) {
      if (a.length >= 2 && q.includes(a) && a.length > best.length) best = a;
    }
    if (q.includes(canonical) && canonical.length > best.length) best = canonical;
  }
  const m = q.match(/([\w가-힣]+역|[\w가-힣]+동)/u);
  if (m && m[1].length > best.length) best = m[1];
  if (best) return best;
  if (parsedRegion) return parsedRegion;
  return "서울";
}

function parentDistrictLabel(areaLabel, parsedRegion) {
  if (parsedRegion) return parsedRegion;
  if (/압구정|청담|신사|논현|역삼|삼성|개포|일원|수서|대치/.test(areaLabel)) return "강남";
  if (/홍대|합정|상수|망원|연남|서교/.test(areaLabel)) return "홍대";
  if (/성수|뚝섬|서울숲/.test(areaLabel)) return "성수";
  return areaLabel;
}

/**
 * 결과 0건일 때 확장 검색 카피 + 쿼리 (지도/API 주도, AI는 문구·힌트 보조)
 * @param {string} rawQuery
 * @param {object} parsed parseSearchQuery 결과
 * @param {Record<string, unknown> | null} intentAssist
 */
export function buildExpansionSuggestions(rawQuery, parsed, intentAssist) {
  const q = String(rawQuery || "").trim();
  const area = pickAreaLabelFromQuery(q, parsed?.region);
  const district = parentDistrictLabel(area, parsed?.region);
  const vibe = parsed?.vibe;
  const alcohol = parsed?.alcohol;
  const hasQuiet = vibe === "조용한" || /조용|차분|무드/.test(q);

  const suggestions = [];
  const seenQ = new Set();

  const push = (label, queryStr) => {
    const t = String(queryStr || "").trim();
    if (!t || seenQ.has(t) || t === q) return;
    seenQ.add(t);
    suggestions.push({
      id: `exp-${suggestions.length}`,
      label,
      query: t,
    });
  };

  if (hasQuiet) {
    push(`${area}의 조용한 술집으로 볼까요?`, `${area} 조용한 술집`);
  }
  push(`${area} 술집으로 넓혀볼까요?`, `${area} 술집`);

  if (alcohol || /사케|이자카야|와인바|칵테일|하이볼|맥주/.test(q)) {
    const alc = alcohol || (q.includes("사케") ? "사케" : "");
    if (alc === "사케" || q.includes("사케")) {
      push(
        `사케 태그가 있는 ${district}권 장소로 볼까요?`,
        `${district} 사케`
      );
    } else if (alc) {
      push(`${alc}가 많은 ${district}권으로 볼까요?`, `${district} ${alc}`);
    }
    if (/사케|이자카야|일본/.test(q)) {
      push(`이자카야·일식 주점으로 넓혀볼까요?`, `${area} 이자카야`);
    }
  }

  push(`와인·하이볼까지 범위를 넓혀볼까요?`, `${area} 와인바`);
  push(`맥주·호프까지 포함해볼까요?`, `${area} 맥주`);

  const ideas = intentAssist?.fallbackSearchIdeas;
  if (Array.isArray(ideas)) {
    for (const idea of ideas) {
      const t = String(idea || "").trim();
      if (t && t !== q && !seenQ.has(t)) {
        seenQ.add(t);
        suggestions.push({
          id: `exp-api-${suggestions.length}`,
          label: `「${t.length > 20 ? `${t.slice(0, 20)}…` : t}」로 시도해볼까요?`,
          query: t,
        });
      }
    }
  }

  if (suggestions.length === 0) {
    push(`조금 더 넓은 지역으로 볼까요?`, district !== area ? `${district} 술집` : `서울 술집`);
  }

  const fromServerBroad = String(intentAssist?.broadKakaoKeyword ?? "").trim();
  const clientDefaultBroad =
    district && district !== area ? `${district} 술집` : `${area} 술집`;
  let quickBroadenQuery =
    fromServerBroad && fromServerBroad !== q ? fromServerBroad : clientDefaultBroad;
  if (quickBroadenQuery === q) {
    quickBroadenQuery = district !== area ? `${district} 술집` : "서울 술집";
  }
  if (quickBroadenQuery === q) quickBroadenQuery = "서울 술집";

  const suggestionQueries = suggestions
    .map((s) => s.query)
    .filter((t) => t && t !== q);

  const orderedRetry = [];
  const addRetry = (t) => {
    const x = String(t || "").trim();
    if (!x || x === q || orderedRetry.includes(x)) return;
    orderedRetry.push(x);
  };
  if (fromServerBroad) addRetry(fromServerBroad);
  addRetry(quickBroadenQuery);
  for (const t of suggestionQueries) addRetry(t);
  const autoRetryQueries = orderedRetry.slice(0, 5);

  return {
    headline: "이 조건으로는 바로 나오는 곳이 없어요",
    subline:
      "초기에는 데이터·매칭이 부족할 수 있어요. 비슷한 분위기·범위로 넓혀 볼까요?",
    dataNote:
      "이 검색은 아직 매칭 데이터가 부족할 수 있어요. 아래에서 범위를 넓혀 보세요.",
    fallbackHints: getFallbackSuggestions(parsed),
    suggestions,
    autoRetryQueries,
    quickBroadenQuery,
    quickBroadenLabel: `한 번에 넓게 «${quickBroadenQuery}»로 찾기`,
  };
}
