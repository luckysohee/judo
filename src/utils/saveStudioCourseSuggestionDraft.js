import {
  createCuratorCourse,
  saveCuratorCoursePlaces,
} from "../api/curatorCourses";
import { supabase } from "../lib/supabase";
import { buildStudioCourseEditorSeedFromSuggestion } from "./prepareCourseEditorPlaceRow";

/**
 * AI 초안 → curator_courses draft + 장소(좌표 보장).
 */
export async function saveStudioCourseSuggestionDraft({
  curatorUserId,
  draft,
  placeByKey,
  rawSearchQuery = "",
  includeAiText = false,
}) {
  const uid = String(curatorUserId ?? "").trim();
  if (!uid) {
    const err = new Error("로그인이 필요합니다.");
    err.code = "NOT_AUTHENTICATED";
    throw err;
  }

  const { data: curRow, error: curErr } = await supabase
    .from("curators")
    .select("user_id")
    .eq("user_id", uid)
    .maybeSingle();

  if (curErr || !curRow?.user_id) {
    const err = new Error("큐레이터 계정에서만 저장할 수 있어요.");
    err.code = "NOT_CURATOR";
    throw err;
  }

  const seed = await buildStudioCourseEditorSeedFromSuggestion(
    { draft, placeByKey, query: rawSearchQuery, parsed: {} },
    { includeAiText }
  );

  const created = await createCuratorCourse({
    curator_id: uid,
    title: seed.title,
    description: seed.description || " ",
    area: seed.area || null,
    theme_tags: seed.themeTags,
    status: "draft",
    is_public: false,
  });

  const newId = created?.id;
  if (!newId) {
    const err = new Error("코스를 만들지 못했습니다.");
    err.code = "CREATE_FAILED";
    throw err;
  }

  await saveCuratorCoursePlaces(
    String(newId),
    seed.placeRows.map((r, i) => ({
      place_id: r.place_id,
      order_index: i,
      memo: r.memo || null,
      stay_minutes:
        r.stay_minutes !== "" && Number.isFinite(Number(r.stay_minutes))
          ? Math.max(0, Math.floor(Number(r.stay_minutes)))
          : null,
    }))
  );

  return {
    courseId: String(newId),
    savedStepCount: seed.placeRows.length,
    placeRows: seed.placeRows,
  };
}
