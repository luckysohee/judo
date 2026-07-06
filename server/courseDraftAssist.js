/**
 * POST /api/course-draft-assist
 * 후보 장소 목록만으로 다중 스텝 코스 초안(JSON) 생성 — 장소 발명 금지.
 */

import {
  consumeStudioAiCourseSuggestionQuota,
  peekStudioAiCourseSuggestionQuota,
  STUDIO_AI_COURSE_SUGGESTION_FREE_MONTHLY,
} from "./studioAiCourseSuggestionQuota.js";
import { sanitizeCourseDraftAssistOutput } from "./utils/courseDraftAssistSanitize.js";
import { courseStopTargetForDraft } from "./utils/courseStopTarget.js";

const COURSE_DRAFT_ASSIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    area: { type: "string" },
    theme_tags: {
      type: "array",
      items: { type: "string" },
    },
    route_tips: {
      type: "array",
      items: { type: "string" },
    },
    visit_checklist: {
      type: "array",
      items: { type: "string" },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          placeKey: { type: "string" },
          memo: { type: "string" },
          visit_tip: { type: "string" },
          stay_minutes: { type: "number" },
        },
        required: ["placeKey", "memo", "visit_tip", "stay_minutes"],
      },
    },
  },
  required: [
    "title",
    "description",
    "area",
    "theme_tags",
    "route_tips",
    "visit_checklist",
    "steps",
  ],
};

function emptyDraftResponse(reason = "unknown", message = "") {
  return { ok: false, draft: null, reason, message: message || undefined };
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {{ openai: import("openai").default, hasUsableOpenAiKey: () => boolean }} deps
 */
export async function handleCourseDraftAssist(req, res, deps) {
  const { openai, hasUsableOpenAiKey } = deps;
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const parsed =
    body.parsed && typeof body.parsed === "object" ? body.parsed : {};
  const rawPlaces = Array.isArray(body.places) ? body.places : [];
  const variantSeed = Math.max(0, Math.floor(Number(body.variantSeed) || 0));
  const diversityHint =
    typeof body.diversityHint === "string" ? body.diversityHint.trim() : "";

  if (!query) {
    return res.status(400).json({ error: "query가 비어 있습니다." });
  }
  if (rawPlaces.length < 2) {
    return res.status(400).json({ error: "places가 2개 미만입니다." });
  }

  const places = rawPlaces
    .filter((p) => p && p.placeKey)
    .slice(0, 28)
    .map((p) => ({
      placeKey: String(p.placeKey),
      name: String(p.name || "").trim(),
      category: String(p.category || "").trim(),
      address: String(p.address || "").trim(),
      region: String(p.region || "").trim(),
      tags: Array.isArray(p.tags) ? p.tags.slice(0, 6).map(String) : [],
      comment: String(p.comment || "").slice(0, 220),
      isCuratorPick: p.isCuratorPick === true,
      walkFromHubM:
        Number.isFinite(Number(p.walkFromHubM)) && Number(p.walkFromHubM) >= 0
          ? Math.round(Number(p.walkFromHubM))
          : null,
    }));

  const allowedKeys = places.map((p) => p.placeKey);
  const stopTarget =
    parsed?.stopTarget ?? courseStopTargetForDraft({ ...parsed, raw: query });
  const minPlaces = Math.max(2, Number(stopTarget?.min) || 2);

  if (allowedKeys.length < minPlaces) {
    return res.status(400).json({
      error:
        stopTarget.exact && stopTarget.target
          ? `${stopTarget.target}곳 코스를 만들 후보가 ${allowedKeys.length}곳뿐입니다.`
          : "유효한 placeKey가 2개 미만입니다.",
    });
  }

  if (!hasUsableOpenAiKey()) {
    return res.json(
      emptyDraftResponse(
        "no_api_key",
        "OpenAI API 키가 설정되지 않았어요. server/.env의 OPENAI_API_KEY를 확인해 주세요."
      )
    );
  }

  const userId = req.authUser?.id ? String(req.authUser.id) : "";
  if (userId) {
    const peek = await peekStudioAiCourseSuggestionQuota(userId);
    if (!peek.allowed) {
      return res.status(402).json({
        ok: false,
        error: "quota_exceeded",
        message: `이번 달 무료 AI 코스 초안 ${STUDIO_AI_COURSE_SUGGESTION_FREE_MONTHLY}회를 모두 사용했어요. Studio Pro에서 무제한으로 이용할 수 있어요.`,
        quota: peek,
      });
    }
  }

  const meetingContext =
    parsed?.dateMode === "meeting" || parsed?.intents?.meeting === true;
  const meetingAfterContext =
    meetingContext &&
    (parsed?.intents?.after === true ||
      /(?:2|3)\s*차|이\s*차|삼\s*차|끝나고|뒷풀이/i.test(query));
  const areaKey = String(parsed?.area || "").trim();
  const stopCountRule = stopTarget.exact
    ? `steps는 **정확히 ${stopTarget.target}곳** (N차 = N곳). ${stopTarget.target}개 미만·초과 금지.`
    : "steps는 **최소 2곳**, 2~6곳. 코스이므로 1곳만 선택 금지.";

  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "너는 한국 로컬 코스 큐레이터다. 빵지순례·카페 투어·데이트·술자리 등 검색 의도에 맞는 **다중 스텝 동선**을 짠다. 출력은 JSON 스키마뿐.\n\n" +
                "[금지] places에 없는 placeKey. 목록에 없는 새 상호·주소. 타 서비스(네이버 AI 등) 문구 그대로 복사.\n" +
                "[금지·뻔한 문구] '주차 어려움', '대중교통 이용', '영업시간 확인', 'SNS 확인'처럼 **어느 가게에나 통하는** 한 줄만 쓰지 말 것.\n\n" +
                "[steps] 후보 placeKey만 사용. " +
                stopCountRule +
                " memo=**그 가게 대표 메뉴·특징**(카테고리·comment 근거). visit_tip=**그 가게만** 해당(품절 메뉴·웨이팅·좌석·테이크아웃·추천 시간대). 상호명을 memo·visit_tip 안에도 넣어라.\n" +
                "[route_tips] 동선 요령 2~4개. **각 항목에 steps에 넣은 상호명 1개 이상** + 동선 순서·이동 이유·가게 간 거리·comment·주소 단서. " +
                "예: '베통→성수베이킹: 성수역 쪽 먼저 두면 소금빵 품절 전 1·2번째 점 커버'.\n" +
                "[visit_checklist] 방문 전 체크 2~4개. **매장별 실행 팁** — 항목마다 상호명 포함, 그 가게 comment·카테고리·주소를 근거로 콕 집어 쓸 것. " +
                "예: '크램 성수 — 크로issant·무화과 토스트 테이크아웃만, 좌석 4석이라 늦은 점심 웨이팅'.\n" +
                "[description] 코스 소개 2~4문장 — 선택한 매장명·대표 메뉴·추천 시간대를 구체적으로. title·description은 검색어 맥락에 **새로** 작성.\n" +
                "[comment 필드] 후보 JSON의 comment(큐레이터 한줄·메뉴 사유)가 있으면 memo·visit_tip·route_tips·visit_checklist에 **반드시** 반영.\n" +
                "[도보 동선] 코스는 **같은 동네 안 도보**가 기본. 연속 장소는 **직선 1km 이내**가 이상적, **2km 미만**까지. " +
                "2km 넘게 벌어지면 그 가게만큼 메리트(대표 메뉴·분위기)가 있을 때만 넣고 route_tips에 **택시/이동 이유**를 적어라. " +
                "walkFromHubM(후보 중심까지 m)이 큰 장소는 우선순위 낮춤. steps 순서는 **걸어 다니기 좋게**.\n" +
                (areaKey
                  ? `[지역 고정] 검색 지역은 **${areaKey}** 뿐. steps·route_tips·visit_checklist·title·description·area 필드에 **${areaKey} 밖 동네·구 이름(용산·종로·을지로 등)을 넣지 말 것**. 후보 address가 ${areaKey}와 맞지 않으면 선택 금지.\n`
                  : "") +
                "[다양성] 같은 검색어라도 **매번 다른 조합**. 후보 앞쪽(유명점)만 반복하지 말 것. " +
                "카테고리·분위기·동선을 섞고, 후보 중·후반 장소도 포함. 프랜차이즈·같은 체인 연속 금지.\n" +
                (meetingContext
                  ? "[업무·미팅] 한정식·다이닝·일식·양식·룸 있는 레스토랑 등 접대·격식 식사 위주. 이자카야·체인·혼술·1인 주점·헌팅·클럽·포장마차·시끌 유흥은 **선택 금지**.\n"
                  : "") +
                (meetingAfterContext
                  ? "[미팅 2차] 와인바·칵테일바·조용한 라운지. 이자카야·체인·호프·맥주 홀 위주 장소 금지.\n"
                  : "") +
                "stay_minutes는 0~90(미상이면 0). area는 지역명 한 단어 또는 짧은 구.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `검색어:\n${query}\n\n` +
                `파싱 힌트(JSON):\n${JSON.stringify(parsed)}\n\n` +
                `후보 장소(JSON):\n${JSON.stringify(places)}\n\n` +
                `규칙:\n` +
                `- steps[].placeKey는 위 placeKey만\n` +
                `- ${stopCountRule}\n` +
                `- memo·visit_tip: 각 60~120자, **상호명 + 메뉴/특징 + 그 가게만 해당하는 팁**\n` +
                `- route_tips·visit_checklist: 각 2~4개, **항목마다 steps에 넣은 상호명 포함**, comment·category·address 근거로 구체적으로\n` +
                `- route_tips는 **2곳 이상 상호를 한 문장에** 묶어 동선 이유 설명\n` +
                `- visit_checklist는 **매장 1곳당 1항목** 위주(품절·웨이팅·좌석·테이크아웃·추천 시간)\n` +
                `- **도보 동선**: 구간 1km 이내 선호, 2km 미만. 멀면 택시 사유 필수\n` +
                (areaKey
                  ? `- **지역 ${areaKey} 고정**: 다른 구·동네 장소·동선 설명 금지\n`
                  : "") +
                (diversityHint
                  ? `- 다양성 힌트(variant ${variantSeed}): ${diversityHint}\n`
                  : `- 다양성: 유명점만 나열하지 말고 후보 전체에서 고르게 선택\n`),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "judo_course_draft_assist",
          strict: true,
          schema: COURSE_DRAFT_ASSIST_SCHEMA,
        },
      },
      temperature: 0.72,
    });

    const out = JSON.parse(response.output_text);
    const draft = sanitizeCourseDraftAssistOutput(out, allowedKeys, places, {
      minSteps: stopTarget.min,
      maxSteps: stopTarget.max,
      exactSteps: stopTarget.exact,
      targetSteps: stopTarget.target,
    });
    if (!draft) {
      return res.json(
        emptyDraftResponse(
          "invalid_draft",
          "AI가 유효한 장소 조합을 만들지 못했어요. 검색어·지역을 바꿔 다시 시도해 보세요."
        )
      );
    }

    if (userId) {
      await consumeStudioAiCourseSuggestionQuota(userId);
    }

    return res.json({ ok: true, draft });
  } catch (e) {
    console.error("course-draft-assist error:", e?.message || e);
    return res.json(
      emptyDraftResponse(
        "openai_error",
        "AI 서버 응답에 실패했어요. 잠시 후 다시 시도해 주세요."
      )
    );
  }
}
