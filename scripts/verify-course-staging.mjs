/**
 * 코스 스테이징 DB 스모크 검증 (마이그레이션·RPC·공개 코스 조회).
 *
 * 사용:
 *   node --env-file=server/.env scripts/verify-course-staging.mjs
 *
 * 필요 환경변수: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 * 선택: VITE_SUPABASE_SERVICE_ROLE_KEY (테이블 존재 head 요청용, 없으면 스킵)
 */
import { createClient } from "@supabase/supabase-js";

const UUID_ZERO = "00000000-0000-4000-8000-000000000001";

function okRow(label, pass, detail = "") {
  return { label, pass: Boolean(pass), detail };
}

async function main() {
  const url = String(process.env.VITE_SUPABASE_URL || "").trim();
  const anon = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  const service = String(
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ""
  ).trim();

  const rows = [];

  if (!url || !anon) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error:
            "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 없습니다. node --env-file=server/.env … 로 실행하세요.",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- 1) RPC (anon) ---
  const rpcTests = [
    {
      name: "get_course_completion_stats",
      fn: () =>
        anonClient.rpc("get_course_completion_stats", {
          p_course_id: UUID_ZERO,
        }),
    },
    {
      name: "get_course_completion_stats_batch",
      fn: () =>
        anonClient.rpc("get_course_completion_stats_batch", {
          p_course_ids: [],
        }),
    },
    {
      name: "get_curator_completion_stats",
      fn: () =>
        anonClient.rpc("get_curator_completion_stats", {
          p_curator_id: UUID_ZERO,
        }),
    },
  ];

  for (const t of rpcTests) {
    const { data, error } = await t.fn();
    const pass = !error;
    rows.push(
      okRow(
        `RPC ${t.name}`,
        pass,
        error
          ? `${error.code || ""} ${error.message || ""}`.trim()
          : typeof data === "object"
            ? "ok"
            : String(data)
      )
    );
  }

  // --- 2) 공개 코스 목록 (anon, RLS) ---
  const pub = await anonClient
    .from("curator_courses")
    .select("id,title,status,is_public")
    .eq("status", "published")
    .eq("is_public", true)
    .limit(3);

  rows.push(
    okRow(
      "anon SELECT curator_courses (published+public)",
      !pub.error,
      pub.error
        ? `${pub.error.code} ${pub.error.message}`
        : `rows=${Array.isArray(pub.data) ? pub.data.length : 0}`
    )
  );

  const pubEmbed = await anonClient
    .from("curator_courses")
    .select(
      `id,title,status,is_public, curator_course_places ( order_index, place_id, places ( name, category ) )`
    )
    .eq("status", "published")
    .eq("is_public", true)
    .limit(3);

  rows.push(
    okRow(
      "anon SELECT curator_courses embed places",
      !pubEmbed.error,
      pubEmbed.error
        ? `${pubEmbed.error.code} ${pubEmbed.error.message}`
        : `rows=${Array.isArray(pubEmbed.data) ? pubEmbed.data.length : 0}`
    )
  );

  // --- 3) 서비스 롤로 테이블 접근 가능 여부 (스키마 적용 단서) ---
  if (service) {
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const tables = [
      "curator_courses",
      "curator_course_places",
      "active_course_sessions",
      "completed_course_logs",
    ];
    for (const tbl of tables) {
      const r = await admin.from(tbl).select("id", { count: "exact", head: true });
      rows.push(
        okRow(
          `table head ${tbl}`,
          !r.error,
          r.error ? `${r.error.code} ${r.error.message}` : "reachable"
        )
      );
    }
  } else {
    rows.push(
      okRow(
        "table head (service role)",
        false,
        "VITE_SUPABASE_SERVICE_ROLE_KEY 없음 — 스킵"
      )
    );
  }

  const allPass = rows.filter((r) => !r.pass).length === 0;
  console.log(
    JSON.stringify(
      {
        ok: allPass,
        supabaseHost: new URL(url).host,
        results: rows,
      },
      null,
      2
    )
  );
  process.exit(allPass ? 0 : 2);
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, error: String(e?.message || e) }, null, 2));
  process.exit(1);
});
