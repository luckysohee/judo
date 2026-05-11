import { dedupeAndNormalizeCollectionTags } from "./collectionTags";
import { pickCollectionMood } from "./collectionCoverMood";

/**
 * 컬렉션 "완성도" 점수 — heuristic, 0~100.
 *
 * UX 용도로만 쓰이며, public 컬렉션 정렬·추천·검색 점수와는 무관하다.
 * 모든 가중치는 정성/완성도를 보조 자극하는 수준이지, 노출 우선순위에는 영향을 주지 않는다.
 *
 * 점수 구성(총합 100):
 *  - place    : 25  (0/8/16/22/25 단계 — 1차→2차→3차로 갈수록 후하게)
 *  - step     : 20  (0/10/20 — 1라벨/2라벨↑)
 *  - tags     : 15  (0/8/15 — 1태그/2태그↑)
 *  - cover    : 15  (이미지 URL 있음=15 / tag·step 으로 자동 무드 가능=6 / 없음=0)
 *  - title    : 5   (있음/없음)
 *  - desc     : 5   (있음/없음)
 *  - reaction : 15  (saves+likes 0/1~2/3~5/6↑ → 0/5/10/15)
 *
 * "level" 은 단순 라벨링 — 차후 디자인에서 색상/뱃지로 활용:
 *   - score < 40   → 'starter'
 *   - score < 70   → 'building'
 *   - score < 90   → 'polished'
 *   - score ≥ 90   → 'showcase'
 */

/**
 * @typedef {{ key: string, label: string, score: number, weight: number }} CompletionComponent
 */

/**
 * @typedef {{
 *   key: 'cover'|'tags'|'step'|'place'|'desc'|'title',
 *   label: string,
 *   priority: number,
 * }} CompletionSuggestion
 */

/**
 * @typedef {{
 *   score: number,
 *   level: 'starter'|'building'|'polished'|'showcase',
 *   components: CompletionComponent[],
 *   suggestions: CompletionSuggestion[],
 *   stats: {
 *     place_count: number,
 *     step_label_count: number,
 *     tag_count: number,
 *     has_cover: boolean,
 *     has_title: boolean,
 *     has_description: boolean,
 *     reaction_total: number,
 *   },
 * }} CompletionResult
 */

const W = {
  place: 25,
  step: 20,
  tags: 15,
  cover: 15,
  title: 5,
  desc: 5,
  reaction: 15,
};

function clampScore(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scorePlace(count) {
  if (count <= 0) return 0;
  if (count === 1) return 8;
  if (count === 2) return 16;
  if (count === 3) return 22;
  return W.place;
}

function scoreStepLabels(distinct) {
  if (distinct <= 0) return 0;
  if (distinct === 1) return 10;
  return W.step;
}

function scoreTags(count) {
  if (count <= 0) return 0;
  if (count === 1) return 8;
  return W.tags;
}

function scoreCover(has, hasAutoMood) {
  if (has) return W.cover;
  if (hasAutoMood) return 6;
  return 0;
}

function scoreTitle(has) {
  return has ? W.title : 0;
}

function scoreDescription(has) {
  return has ? W.desc : 0;
}

function scoreReaction(total) {
  if (total <= 0) return 0;
  if (total <= 2) return 5;
  if (total <= 5) return 10;
  return W.reaction;
}

function deriveLevel(score) {
  if (score >= 90) return "showcase";
  if (score >= 70) return "polished";
  if (score >= 40) return "building";
  return "starter";
}

/**
 * 컬렉션과 (선택) 반응 카운트로 완성도 결과를 계산.
 *
 * 입력 `collection` 은 다음 필드 중 가능한 만큼만 있어도 동작:
 *   - `title` (string)
 *   - `description` (string)
 *   - `cover_image_url` (string)
 *   - `tags` (string[])
 *   - `collection_places` (Array<{ step_label?: string }>) — 길이로 place 수, distinct step_label 추출
 *
 * @param {object} collection
 * @param {{ likeCount?: number, saveCount?: number }} [reactions]
 * @returns {CompletionResult}
 */
export function computeCollectionCompletionScore(collection, reactions = {}) {
  const title =
    typeof collection?.title === "string" ? collection.title.trim() : "";
  const description =
    typeof collection?.description === "string"
      ? collection.description.trim()
      : "";
  const coverUrl =
    typeof collection?.cover_image_url === "string"
      ? collection.cover_image_url.trim()
      : "";
  const tags = dedupeAndNormalizeCollectionTags(collection?.tags);
  const placesArr = Array.isArray(collection?.collection_places)
    ? collection.collection_places
    : [];

  const distinctSteps = new Set();
  for (const p of placesArr) {
    const lbl =
      typeof p?.step_label === "string" ? p.step_label.trim() : "";
    if (lbl) distinctSteps.add(lbl.toLowerCase());
  }

  const placeCount = placesArr.length;
  const tagCount = tags.length;
  const stepCount = distinctSteps.size;
  const hasCover = coverUrl.length > 0;
  const hasTitle = title.length > 0;
  const hasDesc = description.length > 0;

  // 이미지 URL 이 비어 있어도 tags/step_label 로 무드 그라데이션이 만들어지면
  // 카드가 비주얼적으로 살아있다고 보고 cover 항목에 부분 점수.
  let hasAutoMood = false;
  if (!hasCover) {
    try {
      const moodResult = pickCollectionMood({
        tags,
        stepLabels: placesArr,
      });
      hasAutoMood = moodResult?.source === "tag" || moodResult?.source === "step";
    } catch {
      hasAutoMood = false;
    }
  }

  const likeCount = Math.max(0, Number(reactions?.likeCount) || 0);
  const saveCount = Math.max(0, Number(reactions?.saveCount) || 0);
  const reactionTotal = likeCount + saveCount;

  const components = [
    {
      key: "place",
      label: "장소",
      score: scorePlace(placeCount),
      weight: W.place,
    },
    {
      key: "step",
      label: "흐름 라벨",
      score: scoreStepLabels(stepCount),
      weight: W.step,
    },
    {
      key: "tags",
      label: "태그",
      score: scoreTags(tagCount),
      weight: W.tags,
    },
    {
      key: "cover",
      label: hasCover
        ? "커버 이미지"
        : hasAutoMood
          ? "커버 이미지 (자동 무드)"
          : "커버 이미지",
      score: scoreCover(hasCover, hasAutoMood),
      weight: W.cover,
    },
    {
      key: "title",
      label: "제목",
      score: scoreTitle(hasTitle),
      weight: W.title,
    },
    {
      key: "desc",
      label: "설명",
      score: scoreDescription(hasDesc),
      weight: W.desc,
    },
    {
      key: "reaction",
      label: "저장·좋아요 반응",
      score: scoreReaction(reactionTotal),
      weight: W.reaction,
    },
  ];

  const sum = components.reduce((acc, c) => acc + c.score, 0);
  const score = clampScore(sum);
  const level = deriveLevel(score);

  /** @type {CompletionSuggestion[]} */
  const suggestions = [];
  if (!hasCover) {
    suggestions.push({
      key: "cover",
      label: hasAutoMood
        ? "지금은 자동 무드 커버를 쓰고 있어요 — 직접 사진을 올리면 더 인상적이에요"
        : "커버 이미지를 넣어보세요",
      priority: 1,
    });
  }
  if (stepCount === 0) {
    suggestions.push({
      key: "step",
      label: "장소마다 ‘1차 야장’ 같은 흐름 라벨을 추가해보세요",
      priority: 2,
    });
  } else if (stepCount === 1) {
    suggestions.push({
      key: "step",
      label: "흐름 라벨을 한 종류 더 추가하면 코스가 입체적으로 보여요",
      priority: 5,
    });
  }
  if (tagCount === 0) {
    suggestions.push({
      key: "tags",
      label: "‘야장’, ‘노포’ 같은 태그를 추가해보세요",
      priority: 3,
    });
  } else if (tagCount === 1) {
    suggestions.push({
      key: "tags",
      label: "태그를 1개 더 붙이면 더 잘 노출돼요",
      priority: 6,
    });
  }
  if (placeCount < 3) {
    const remain = 3 - placeCount;
    suggestions.push({
      key: "place",
      label: `장소를 ${remain}곳 더 추가해 코스로 완성해보세요`,
      priority: 4,
    });
  }
  if (!hasDesc) {
    suggestions.push({
      key: "desc",
      label: "이 코스를 한 줄로 소개하는 설명을 적어보세요",
      priority: 7,
    });
  }
  if (!hasTitle) {
    suggestions.push({
      key: "title",
      label: "제목을 먼저 정해주세요",
      priority: 0,
    });
  }
  suggestions.sort((a, b) => a.priority - b.priority);

  return {
    score,
    level,
    components,
    suggestions,
    stats: {
      place_count: placeCount,
      step_label_count: stepCount,
      tag_count: tagCount,
      has_cover: hasCover,
      has_auto_mood: hasAutoMood,
      has_title: hasTitle,
      has_description: hasDesc,
      reaction_total: reactionTotal,
    },
  };
}

/**
 * 레벨별 lightweight 한 줄 카피 — UI 가 직접 가져다 쓰기 좋게 함께 노출.
 *
 * @param {'starter'|'building'|'polished'|'showcase'} level
 * @returns {string}
 */
export function getCompletionLevelCopy(level) {
  if (level === "showcase") return "잘 짜인 코스예요";
  if (level === "polished") return "거의 다 왔어요";
  if (level === "building") return "조금만 더 다듬으면 돼요";
  return "코스를 만들어가는 중";
}
