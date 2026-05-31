/**
 * POST /api/course-compose-assist
 * 룰 엔진 후보 코스 중 course.key만 LLM이 고르고 summary/reasons 반환.
 */

const COURSE_COMPOSE_ASSIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    courseKeys: {
      type: "array",
      items: { type: "string" },
    },
    reasons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          courseKey: { type: "string" },
          reason: { type: "string" },
        },
        required: ["courseKey", "reason"],
      },
    },
  },
  required: ["summary", "courseKeys", "reasons"],
};

function emptyAssistResponse() {
  return { ok: false, courseKeys: [], summary: "", reasons: [] };
}

function sanitizeAssistKeys(rawKeys, allowedKeys, maxPick) {
  const allowed = new Set(allowedKeys);
  const out = [];
  const list = Array.isArray(rawKeys) ? rawKeys : [];
  for (const k of list) {
    const s = String(k).trim();
    if (!s || !allowed.has(s) || out.includes(s)) continue;
    out.push(s);
    if (out.length >= maxPick) break;
  }
  return out;
}

/**
 * @param {unknown[]} courses
 */
export function compactCourseCandidatesForAI(courses) {
  return (Array.isArray(courses) ? courses : [])
    .filter((c) => c && c.key)
    .slice(0, 12)
    .map((c) => ({
      key: String(c.key),
      profileKey: String(c.profileKey || ""),
      profileTitle: String(c.profileTitle || ""),
      totalScore: Number(c.totalScore) || 0,
      steps: (Array.isArray(c.steps) ? c.steps : []).map((s) => ({
        step: Number(s.step) || 0,
        label: String(s.label || ""),
        walkDistanceMeters: s.walkDistanceMeters ?? null,
        place: {
          id: String(s.place?.id ?? ""),
          name: String(s.place?.name || s.place?.place_name || "").trim(),
          region: String(s.place?.region || "").trim(),
          category: String(
            s.place?.category || s.place?.category_name || ""
          ).trim(),
          tags: Array.isArray(s.place?.tags)
            ? s.place.tags.slice(0, 8).map(String)
            : [],
          vibes: Array.isArray(s.place?.vibes)
            ? s.place.vibes.slice(0, 6).map(String)
            : [],
          liquorTypes: Array.isArray(s.place?.liquorTypes)
            ? s.place.liquorTypes.slice(0, 4).map(String)
            : [],
          comment: String(s.place?.comment || "").slice(0, 120),
        },
      })),
    }));
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {{ openai: import("openai").default, hasUsableOpenAiKey: () => boolean }} deps
 */
export async function handleCourseComposeAssist(req, res, deps) {
  const { openai, hasUsableOpenAiKey } = deps;
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const parsed =
    body.parsed && typeof body.parsed === "object" ? body.parsed : {};
  const rawCandidates = Array.isArray(body.candidates) ? body.candidates : [];
  const maxPick = Math.min(
    3,
    Math.max(1, Math.floor(Number(body.maxPick) || 3))
  );

  if (!query) {
    return res.status(400).json({ error: "query가 비어 있습니다." });
  }
  if (!rawCandidates.length) {
    return res.status(400).json({ error: "candidates가 비어 있습니다." });
  }

  const candidates = compactCourseCandidatesForAI(rawCandidates);
  const allowedKeys = candidates.map((c) => c.key);

  if (!hasUsableOpenAiKey()) {
    return res.json(emptyAssistResponse());
  }

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
                "너는 한국 술자리 1·2차(또는 3단) 코스 큐레이터다. 출력은 JSON 스키마뿐이다.\n\n" +
                "[금지] candidates에 없는 courseKey. 목록에 없는 새 상호·주소·장소 id. 챗봇 잡담.\n" +
                "[허용] 검색어·데이트/회식/혼술 맥락에 맞게 후보 코스 key만 고르고, summary 한 줄(40자 내외), " +
                "각 코스별 reason(검색어 기준 짧은 이유). totalScore·도보 거리는 참고만.\n" +
                "데이트면 조용·분위기 코스 우선, 회식이면 단체·포차 성격 우선.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `사용자 검색어:\n${query}\n\n` +
                `파싱 힌트(JSON):\n${JSON.stringify(parsed)}\n\n` +
                `후보 코스(JSON):\n${JSON.stringify(candidates)}\n\n` +
                `규칙:\n` +
                `- courseKeys는 위 후보의 key만, 최대 ${maxPick}개\n` +
                `- 검색어 적합도 순\n` +
                `- reasons[].courseKey는 courseKeys에 포함된 것만`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "judo_course_compose_assist",
          strict: true,
          schema: COURSE_COMPOSE_ASSIST_SCHEMA,
        },
      },
    });

    const out = JSON.parse(response.output_text);
    const courseKeys = sanitizeAssistKeys(
      out.courseKeys,
      allowedKeys,
      maxPick
    );
    if (!courseKeys.length) {
      return res.json(emptyAssistResponse());
    }

    const keySet = new Set(courseKeys);
    const reasons = (Array.isArray(out.reasons) ? out.reasons : [])
      .map((r) => ({
        courseKey: String(r?.courseKey || "").trim(),
        reason: String(r?.reason || "").trim().slice(0, 160),
      }))
      .filter((r) => r.courseKey && keySet.has(r.courseKey));

    return res.json({
      ok: true,
      courseKeys,
      summary: String(out.summary || "").trim().slice(0, 120),
      reasons,
    });
  } catch (e) {
    console.error("course-compose-assist error:", e?.message || e);
    return res.json(emptyAssistResponse());
  }
}
