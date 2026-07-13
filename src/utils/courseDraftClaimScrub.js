/**
 * AI 코스 초안이 후보 JSON에 없는 메뉴·노포·해물 등을 지어내지 못하게 후처리.
 */

/** @param {object|null|undefined} place */
export function placeEvidenceBlob(place) {
  if (!place || typeof place !== "object") return "";
  return [
    place.name,
    place.place_name,
    place.category,
    place.category_name,
    place.address,
    place.region,
    place.comment,
    Array.isArray(place.tags) ? place.tags.join(" ") : "",
  ]
    .map((v) => String(v || "").toLowerCase())
    .filter(Boolean)
    .join(" ");
}

/**
 * 텍스트에 쓰려면 evidence에 근거가 있어야 하는 주장.
 * claim: 출력에서 찾을 패턴 / evidence: 후보 JSON에서 허용하는 근거
 */
const GATED_CLAIMS = [
  {
    id: "nopo",
    claimRe:
      /노포(?:감성)?|원조|삼대|할매(?:집)?|유서\s*깊|개업\s*\d{2,4}|오래된\s*(?:집|술집|식당)|전통\s*술집|골목\s*노포/gi,
    evidenceRe:
      /노포|원조|삼대|할매|유서|개업|전통|옛날|골목|포장마차|실내포장|선술/,
  },
  {
    id: "seafood",
    claimRe:
      /해물|해산물|모둠회|생선회|물회|회덮밥|활어|사시미|횟집|회집|조개(?:구이)?|낙지|문어|게장|대게|킹크랩|회\s*안주|해물\s*(?:파전|탕|찜|안주)/gi,
    evidenceRe:
      /해물|해산|회|활어|사시미|조개|낙지|문어|게|수산|오징어|새우|전복|어패|횟|생선/,
  },
  {
    id: "makgeolli",
    claimRe: /막걸리|동동주|탁주/gi,
    evidenceRe: /막걸리|동동주|탁주|전통주/,
  },
];

/**
 * @param {string} text
 * @param {string} evidenceLower
 */
export function scrubUnsupportedClaims(text, evidenceLower) {
  let t = String(text || "");
  if (!t.trim()) return t;
  const ev = String(evidenceLower || "").toLowerCase();

  for (const gate of GATED_CLAIMS) {
    gate.claimRe.lastIndex = 0;
    if (!gate.claimRe.test(t)) continue;
    gate.claimRe.lastIndex = 0;
    if (gate.evidenceRe.test(ev)) continue;
    t = t.replace(gate.claimRe, "");
  }

  return t
    .replace(/\s{2,}/g, " ")
    .replace(/\s*([,·|/])\s*/g, " $1 ")
    .replace(/\s+([.。!?])/g, "$1")
    .replace(/^[\s·,|/]+|[\s·,|/]+$/g, "")
    .trim();
}

/** comment 없으면 카테고리·주소만으로 안전한 한 줄 */
export function safePlaceMemo(place) {
  const name = String(place?.name || place?.place_name || "이곳").trim();
  const cat = String(place?.category || place?.category_name || "")
    .split(/>/)
    .map((s) => s.trim())
    .filter(Boolean)
    .pop();
  const comment = String(place?.comment || "").trim();
  if (comment) {
    return `${name} · ${comment}`.slice(0, 160);
  }
  const addr = String(place?.address || "").trim().slice(0, 40);
  const bits = [name];
  if (cat) bits.push(cat);
  if (addr) bits.push(addr);
  bits.push("후보에 적힌 정보만 참고해 주세요");
  return bits.join(" · ").slice(0, 160);
}

/**
 * @param {{ placeKey: string, memo: string, visit_tip: string, stay_minutes: number }} step
 * @param {object|undefined} place
 */
export function scrubDraftStepClaims(step, place) {
  const ev = placeEvidenceBlob(place);
  let memo = scrubUnsupportedClaims(step.memo, ev);

  const stillHasUnsupported = GATED_CLAIMS.some((g) => {
    g.claimRe.lastIndex = 0;
    if (!g.claimRe.test(memo)) return false;
    return !g.evidenceRe.test(ev);
  });
  // 스크럽 후에도 근거 없는 주장이 남거나 내용이 비면 안전 문구로 교체
  if (!memo || memo.length < 8 || stillHasUnsupported) {
    const cleaned = scrubUnsupportedClaims(safePlaceMemo(place), ev);
    memo = cleaned || safePlaceMemo(place);
  }
  // 방문팁은 근거 없이 매번 같은 문구가 나와 쓰지 않음
  return { ...step, memo: memo.slice(0, 160), visit_tip: "" };
}

/**
 * description·tips: 선택된 장소들의 근거 합집합으로 스크럽
 * @param {string} text
 * @param {object[]} selectedPlaces
 */
export function scrubTextAgainstPlaces(text, selectedPlaces) {
  const combined = (Array.isArray(selectedPlaces) ? selectedPlaces : [])
    .map(placeEvidenceBlob)
    .join(" ");
  return scrubUnsupportedClaims(text, combined);
}
