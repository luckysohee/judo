import parseNaturalQuery from "./parseNaturalQuery";

const MAX_LEN = 46;

/**
 * 검색 제출 시 로딩 문구 (GPT 스타일 한 줄, 끝에 점 애니메이션은 UI에서 붙임)
 */
export function getSearchLoadingMessage(rawQuery = "") {
  const q = rawQuery.trim().replace(/\s+/g, " ");
  if (!q) return "조건에 맞는 장소 찾는 중";

  const p = parseNaturalQuery(q).facets;
  if (!p) return `${q} 찾는 중`;
  const bits = [];
  if (p.region) bits.push(p.region);
  if (p.vibe) bits.push(p.vibe);
  if (p.situation) bits.push(p.situation);
  if (p.alcohol) bits.push(p.alcohol);
  if (p.food) bits.push(p.food);

  const ql = q.toLowerCase();
  const wi = bits.indexOf("와인");
  if (wi !== -1 && (ql.includes("와인바") || /와인\s*바/.test(ql))) {
    bits[wi] = "와인바";
  }

  if (bits.length >= 2) {
    return `${bits.join(" ")} 찾는 중`;
  }

  const head = q.length > MAX_LEN ? `${q.slice(0, MAX_LEN)}…` : q;
  return `${head} 찾는 중`;
}
