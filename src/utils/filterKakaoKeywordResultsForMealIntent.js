/**
 * 카카오 keywordSearch(FD6)는 「음식점 > 카페」도 포함해, "밥집" 검색에 커피 체인이 섞일 수 있음.
 * 식사 의도가 뚜렷할 때만 카페·디저트 계열을 제외한다.
 */

export function isMealFocusedKakaoQuery(keyword) {
  const k = String(keyword || "").trim();
  if (k.length < 2) return false;
  return /밥집|밥\s*먹|한식집|중식집|일식집|양식집|분식집|식당|국밥|찌개|덮밥|비빔밥|고깃|고기\s*집|삼겹|갈비|순대|해장|백반|도시락|한끼|점심|저녁\s*밥|죽집|국수|칼국수|^밥$/i.test(
    k
  );
}

function looksLikeCafeOrDessertPlace(place) {
  const cat = String(place?.category_name || "");
  const name = String(place?.place_name || "");
  const blob = `${cat} ${name}`;
  return /카페|커피|커피전문|커피\s*전문|베이커리|디저트|아이스크림|티\s*하우스|tea\s*house|스타벅스|이디야|이디아|투썸|빽다방|메가\s*커피|메가커피|컴포즈|할리스|탐앤탐스|폴바셋|공차|요거프레소|매머드|블루보틀|엔제리너스|카페봄봄|파스쿠찌|토프레소|커피\s*빈|바나프레소|커피에\s*반하다|달콤\s*커피|달콤커피/i.test(
    blob
  );
}

/**
 * @param {string} keyword
 * @param {object[]} rows — 카카오 Places 문서
 * @returns {object[]}
 */
export function filterKakaoKeywordRowsForMealIntent(keyword, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  if (!isMealFocusedKakaoQuery(keyword)) return rows;
  return rows.filter((p) => !looksLikeCafeOrDessertPlace(p));
}
