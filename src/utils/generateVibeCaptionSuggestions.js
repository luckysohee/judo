import { dedupeAndNormalizeCollectionTags } from "./collectionTags";

/**
 * 컬렉션 한 줄 무드(`vibe_caption`) 규칙 기반 suggestion 생성기.
 *
 *  - 입력은 `tags` + `collection_places` (places 조인). 외부 모델 호출 없음.
 *  - 출력은 후보 `string[]`, 최대 5개. 호출자가 chip 리스트로 그대로 노출.
 *  - 추천/검색/`useCourseSearch` score 와 무관 — 순수 텍스트 stub.
 *  - 모든 후보는 DB `vibe_caption` 길이 상한(80자) 안에서 잘려 반환된다.
 *
 * 휴리스틱 요지:
 *  - 태그 야장/데이트/노포/혼술/새벽/소개팅/모임/기념일 별 문두 패턴
 *  - step_label 안에 "와인" / "2차" / "비"·"걷기" 단서 → 변형 추가
 *  - 장소 이름에서 서울권 region 토큰(을지로/성수/연남 …) 추출 → 자연 삽입
 *  - 같은 의미 중복은 lowercased trim 으로 dedupe
 */

/** DB `collections_vibe_caption_length` 상한과 동일. */
const VIBE_CAPTION_MAX_LEN = 80;

/** 결과 최대 개수. */
const MAX_SUGGESTIONS = 5;

/** 최소 의미 있는 길이 (너무 짧은 stub 제거). */
const MIN_SUGGESTION_LEN = 6;

/**
 * 자주 등장하는 서울권 동/지역 토큰. 장소명에 substring 으로 매칭.
 * 운영 데이터로 점진 확장 가능 — 자동 학습이 아닌 큐레이션 리스트.
 */
const REGION_TOKENS = Object.freeze([
  "을지로",
  "성수",
  "연남",
  "연희",
  "망원",
  "합정",
  "홍대",
  "이태원",
  "한남",
  "신사",
  "압구정",
  "청담",
  "종로",
  "광화문",
  "익선동",
  "안국",
  "삼청",
  "부암",
  "서촌",
  "북촌",
  "용산",
  "후암",
  "해방촌",
  "경리단",
  "잠실",
  "강남",
  "신촌",
  "이대",
  "서래마을",
  "망리단",
  "송리단",
  "회기",
  "안암",
  "성북",
  "정릉",
  "한강진",
  "약수",
  "신당",
  "서울숲",
  "여의도",
  "마곡",
  "잠원",
  "건대",
  "왕십리",
  "동대문",
  "남대문",
  "사당",
  "방배",
  "역삼",
  "교대",
  "서초",
  "선릉",
  "삼성",
]);

/**
 * @param {string} s
 * @param {number} maxLen
 * @returns {string}
 */
function clipEnd(s, maxLen) {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

/**
 * @param {unknown} row
 * @returns {string}
 */
function placeDisplayName(row) {
  const p = row?.places || {};
  const n = String(p.name || p.display_name || "").trim();
  return n || "";
}

/**
 * @param {unknown[]} rows
 * @returns {{ steps: string[], placeNames: string[] }}
 */
function orderedStepsAndPlaces(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => {
    const ai = Number.isFinite(a?.order_index) ? a.order_index : 0;
    const bi = Number.isFinite(b?.order_index) ? b.order_index : 0;
    if (ai !== bi) return ai - bi;
    const at = a?.created_at ?? "";
    const bt = b?.created_at ?? "";
    return at < bt ? -1 : at > bt ? 1 : 0;
  });
  const steps = [];
  const placeNames = [];
  for (const row of list) {
    const stepRaw =
      typeof row?.step_label === "string" ? row.step_label.trim() : "";
    if (
      stepRaw &&
      !steps.some((s) => s.toLowerCase() === stepRaw.toLowerCase())
    ) {
      steps.push(stepRaw);
      if (steps.length >= 4) break;
    }
  }
  for (const row of list) {
    const nm = placeDisplayName(row);
    if (
      nm &&
      !placeNames.some((n) => n.toLowerCase() === nm.toLowerCase())
    ) {
      placeNames.push(nm);
      if (placeNames.length >= 3) break;
    }
  }
  return { steps, placeNames };
}

/**
 * 장소명에서 첫 region 토큰 추출(없으면 `null`).
 *
 * @param {string[]} placeNames
 * @returns {string | null}
 */
function detectRegion(placeNames) {
  for (const nm of Array.isArray(placeNames) ? placeNames : []) {
    const s = String(nm ?? "");
    if (!s) continue;
    for (const r of REGION_TOKENS) {
      if (s.includes(r)) return r;
    }
  }
  return null;
}

/**
 * 컬렉션 입력 신호로 한 줄 무드 후보를 만든다.
 *
 * @param {{
 *   tags?: unknown,
 *   collectionPlaces?: unknown[],
 * }} input
 * @returns {string[]} 최대 5개. 신호가 부족하면 `[]`.
 */
export function generateVibeCaptionSuggestions({
  tags,
  collectionPlaces,
} = {}) {
  const tagList = dedupeAndNormalizeCollectionTags(tags);
  const tagSet = new Set(tagList.map((t) => t.toLowerCase()));
  const { steps, placeNames } = orderedStepsAndPlaces(collectionPlaces);

  const region = detectRegion(placeNames);
  const placeShort = placeNames[0] ? clipEnd(placeNames[0], 14) : "";
  const anchor = region || placeShort;

  const stepText = steps.slice(0, 2).join(" → ");

  const stepsAndPlaces = [...steps, ...placeNames];
  const stepsTagsPlaces = [...steps, ...placeNames, ...tagList];

  const hasWine = stepsTagsPlaces.some((s) => /와인/.test(String(s)));
  const has2Cha = steps.some((s) => /2\s*차|이차/.test(String(s)));
  const hasBar = stepsAndPlaces.some((s) => /바|펍|포차/.test(String(s)));
  const hasYajangCue =
    tagSet.has("야장") ||
    stepsAndPlaces.some((s) => /야장|루프\s*탑|루프탑|테라스/.test(String(s)));
  const hasNopo = tagSet.has("노포");
  const hasHonsul = tagSet.has("혼술");
  const hasDate = tagSet.has("데이트");
  const hasDawn = tagSet.has("새벽");
  const hasSogaeting = tagSet.has("소개팅");
  const hasMoim = tagSet.has("모임");
  const hasAnniv = tagSet.has("기념일");
  const hasMood = tagSet.has("분위기");

  const hasRainCue = stepsTagsPlaces.some((s) =>
    /비\s*오는|장마|우산|비\s*날/.test(String(s)),
  );
  const hasWalkCue = stepsTagsPlaces.some((s) =>
    /걷|산책|천천히/.test(String(s)),
  );

  /** @type {string[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();

  /**
   * 후보 추가 — trim·길이 정규화·dedup 까지 통합.
   *
   * @param {string} candidate
   */
  const push = (candidate) => {
    if (out.length >= MAX_SUGGESTIONS) return;
    const cleaned = clipEnd(candidate, VIBE_CAPTION_MAX_LEN);
    if (!cleaned || cleaned.length < MIN_SUGGESTION_LEN) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };

  // ── 야장 ───────────────────────────────────────────────────────────
  if (hasYajangCue) {
    if (anchor) {
      push(`야장부터 2차 바까지 이어지는 ${anchor}의 밤`);
    } else {
      push("야장부터 2차 바까지 이어지는 밤");
    }
    push("여름밤 바람 맞으며 마시기 좋은 야장 코스");
  }

  // ── 데이트 ──────────────────────────────────────────────────────────
  if (hasDate) {
    if (hasWine && anchor) {
      push(`천천히 분위기 잡기 좋은 ${anchor} 와인 코스`);
    } else if (hasWine) {
      push("천천히 분위기 잡기 좋은 와인 데이트 코스");
    }
    if (anchor) {
      push(`${anchor} 천천히 걷는 데이트 코스`);
    } else {
      push("천천히 분위기 살리는 데이트 코스");
    }
  }

  // ── 노포 ────────────────────────────────────────────────────────────
  if (hasNopo) {
    if (anchor) {
      push(`오래된 ${anchor} 골목, 편하게 마시는 흐름`);
    }
    push("오래된 골목에서 편하게 마시는 노포 흐름");
  }

  // ── 혼술 / 새벽 ────────────────────────────────────────────────────
  if (hasHonsul && hasDawn) {
    push("혼자 천천히 마시기 좋은 새벽 코스");
  }
  if (hasHonsul) {
    if (anchor) {
      push(`${anchor}에서 혼자 조용히 마시는 흐름`);
    } else {
      push("혼자 조용히 마시기 좋은 코스");
    }
  }
  if (hasDawn && !hasHonsul) {
    if (anchor) {
      push(`늦은 밤 조용히 이야기하기 좋은 ${anchor} 코스`);
    } else {
      push("늦은 밤 조용히 이야기하기 좋은 코스");
    }
  }

  // ── 소개팅 ──────────────────────────────────────────────────────────
  if (hasSogaeting) {
    if (hasWine) {
      push("소개팅 후 자연스럽게 이어지는 와인바 흐름");
    } else if (stepText) {
      push(`소개팅 후 자연스럽게 이어지는 ${stepText} 흐름`);
    } else if (anchor) {
      push(`소개팅 후 자연스럽게 걷기 좋은 ${anchor}`);
    }
  }

  // ── 모임 / 기념일 ──────────────────────────────────────────────────
  if (hasMoim) {
    if (stepText) {
      push(`모임 끝나고 자연스럽게 이어지는 ${stepText}`);
    } else {
      push("모임 끝나고 가볍게 한 잔 더 하기 좋은 흐름");
    }
  }
  if (hasAnniv) {
    if (anchor) {
      push(`기념일에 어울리는 ${anchor} 분위기 코스`);
    } else {
      push("기념일에 어울리는 분위기 코스");
    }
  }

  // ── 비 / 걷기 ─────────────────────────────────────────────────────
  if (hasRainCue && hasWalkCue) {
    if (anchor) {
      push(`비 오는 날 천천히 걷는 ${anchor}`);
    } else {
      push("비 오는 날 천천히 걷는 코스");
    }
  }

  // ── 와인 흐름 (강조) ──────────────────────────────────────────────
  if (hasWine && has2Cha) {
    push("1차 식사부터 2차 와인바까지 이어지는 흐름");
  }
  if (hasWine && anchor && !hasDate) {
    push(`${anchor} 와인바 중심으로 도는 코스`);
  }

  // ── fallback (신호가 적을 때 가볍게 채움) ───────────────────────
  if (out.length < 3 && stepText && anchor) {
    push(`${anchor}에서 ${stepText} 흐름`);
  }
  if (out.length < 3 && anchor && tagList[0]) {
    push(`${anchor} 분위기의 ${tagList[0]} 코스`);
  }
  if (out.length < 3 && stepText && !anchor) {
    push(`${stepText} 흐름이 자연스러운 코스`);
  }
  if (out.length < 2 && hasMood && anchor) {
    push(`분위기 살린 ${anchor} 한 바퀴`);
  }
  if (out.length < 2 && hasBar && anchor) {
    push(`${anchor} 바 중심으로 도는 코스`);
  }

  return out.slice(0, MAX_SUGGESTIONS);
}

export {
  VIBE_CAPTION_MAX_LEN as GENERATE_VIBE_CAPTION_MAX_LEN,
  MAX_SUGGESTIONS as GENERATE_VIBE_CAPTION_MAX_SUGGESTIONS,
};
