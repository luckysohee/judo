import { createSupabaseServiceClient } from "./supabaseServiceRole.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `places` 단일 조회 — 카드/시트용 공개 필드만 */
/** `address_name`·`road_address_name`·`place_url` 등은 스키마마다 없을 수 있어 제외 */
const PLACE_DETAIL_COLUMNS = [
  "id",
  "name",
  "category",
  "lat",
  "lng",
  "tags",
  "address",
  "kakao_place_id",
  "atmosphere",
  "alcohol_type",
].join(",");

/** `curator_places` — wire 에서 curator_id 제거 전 서버 조회용 컬럼 */
const CURATOR_PLACE_FETCH_COLUMNS = [
  "id",
  "place_id",
  "curator_id",
  "is_archived",
  "one_line_reason",
  "one_line_review",
  "menu_reason",
  "tags",
  "moods",
  "alcohol_types",
].join(",");

/**
 * GET /api/place-detail?id=<uuid>
 * 장소 1건 + 비아카이브 추천 행(큐레이터 공개 필드만). service role 전용.
 */
export async function handlePlaceDetail(req, res) {
  const raw = req.query?.id;
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    return res.status(400).json({
      ok: false,
      message: "id query must be a place UUID",
    });
  }

  const { client: sb, error: envErr } = createSupabaseServiceClient();
  if (envErr || !sb) {
    return res.status(503).json({
      ok: false,
      message:
        "Supabase service role 키가 server 환경변수에 없어요 (SUPABASE_SERVICE_ROLE_KEY)",
    });
  }

  const { data: place, error: pErr } = await sb
    .from("places")
    .select(PLACE_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (pErr) {
    console.error("place-detail places", pErr);
    return res.status(500).json({ ok: false, message: pErr.message });
  }
  if (!place) {
    return res.status(404).json({ ok: false, message: "place not found" });
  }

  const { data: cpsRaw, error: cErr } = await sb
    .from("curator_places")
    .select(CURATOR_PLACE_FETCH_COLUMNS)
    .eq("place_id", id)
    .eq("is_archived", false);

  if (cErr) {
    console.error("place-detail curator_places", cErr);
    return res.status(500).json({ ok: false, message: cErr.message });
  }

  const cps = Array.isArray(cpsRaw) ? cpsRaw : [];
  const uids = [
    ...new Set(
      cps.map((r) => String(r?.curator_id ?? "").trim()).filter(Boolean),
    ),
  ];

  let curMap = new Map();
  if (uids.length > 0) {
    const { data: curRows, error: cuErr } = await sb
      .from("curators")
      .select("user_id,slug,name,username,display_name")
      .in("user_id", uids);
    if (cuErr) {
      console.error("place-detail curators", cuErr);
      return res.status(500).json({ ok: false, message: cuErr.message });
    }
    for (const c of curRows || []) {
      const uid = String(c?.user_id ?? "").trim();
      if (uid) {
        curMap.set(uid, {
          slug: c.slug ?? "",
          name: c.name ?? "",
          username: c.username ?? "",
          display_name: c.display_name ?? "",
        });
      }
    }
  }

  const curator_place_rows = cps.map((row) => {
    const { curator_id: _cid, ...rest } = row;
    const cu = _cid ? curMap.get(String(_cid)) : null;
    return {
      ...rest,
      curators: cu || { slug: "", name: "", username: "", display_name: "" },
    };
  });

  return res.json({
    ok: true,
    place,
    curator_place_rows,
  });
}
