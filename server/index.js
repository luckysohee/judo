import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 루트 .env 먼저, server/.env는 override로 덮어씀 (기본 dotenv는 이미 있는 키를 안 바꿔서
// 루트에 GOOGLE_PLACES_API_KEY(리퍼러용)만 있으면 server/.env 서버용 키가 무시되던 문제 방지)
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({
  path: path.join(__dirname, ".env"),
  override: true,
});

function getKakaoRestApiKey() {
  return (
    process.env.KAKAO_REST_API_KEY ||
    process.env.VITE_KAKAO_REST_API_KEY ||
    ""
  ).trim();
}

/** Kakao Local keyword 등 비-200 응답 시 원인 안내 */
function kakaoDetailHint(httpStatus, kakaoBody) {
  const msg =
    kakaoBody &&
    typeof kakaoBody === "object" &&
    typeof kakaoBody.message === "string"
      ? kakaoBody.message
      : "";
  if (httpStatus === 401) {
    return "카카오 401: REST API 키가 잘못되었거나 헤더 형식이 맞지 않습니다. developers.kakao.com 앱의 REST API 키를 확인하고 server/.env의 KAKAO_REST_API_KEY를 맞추세요.";
  }
  if (httpStatus === 403) {
    return "카카오 403: 이 REST 키로 dapi.kakao.com Local API 사용이 막혔을 수 있습니다. 카카오 개발자 콘솔에서 앱·플랫폼(Web 등)·Local(지도·로컬) API 사용 설정을 확인하세요.";
  }
  if (httpStatus === 400) {
    return "카카오 400: keyword 검색 파라미터가 맞지 않습니다(query·좌표 등). 장소명이 비었거나 좌표가 잘못됐을 수 있습니다.";
  }
  if (httpStatus === 429) {
    return "카카오 429: 일일/초당 호출 한도를 초과했습니다.";
  }
  if (httpStatus != null && httpStatus >= 500) {
    return "카카오 서버 5xx 오류입니다. 잠시 후 다시 시도하세요.";
  }
  if (httpStatus != null) {
    return msg
      ? `카카오 HTTP ${httpStatus}: ${msg}`
      : `카카오가 HTTP ${httpStatus}을(를) 반환했습니다.`;
  }
  return "";
}

/** 서버→Places(New)는 반드시 이 이름만 사용. VITE_ 키는 거의 항상 리퍼러 제한이라 대체하면 403 남 */
function getGooglePlacesApiKey() {
  return (process.env.GOOGLE_PLACES_API_KEY || "").trim();
}

/** 서버→places.googleapis.com 403 등에 대한 안내 (콘솔/API 응답용) */
function googlePlacesBackendHint(httpStatus, googleBody) {
  const errObj =
    googleBody && typeof googleBody === "object" ? googleBody.error : null;
  const statusStr =
    errObj && typeof errObj === "object" && typeof errObj.status === "string"
      ? errObj.status
      : "";
  const detailReason =
    errObj &&
    typeof errObj === "object" &&
    Array.isArray(errObj.details) &&
    typeof errObj.details[0]?.reason === "string"
      ? errObj.details[0].reason
      : "";
  const perm =
    httpStatus === 403 ||
    statusStr === "PERMISSION_DENIED" ||
    /PERMISSION_DENIED/i.test(String(errObj?.message || ""));
  if (!perm) return "";

  if (detailReason === "API_KEY_SERVICE_BLOCKED") {
    return [
      "API_KEY_SERVICE_BLOCKED: 프로젝트에 Places API (New)가 켜져 있지 않거나, 이 키의「API 제한」목록에 Places API (New)가 없습니다.",
      "콘솔 → API 및 서비스 → 라이브러리 →「Places API (New)」사용 설정 → 같은 키 편집 → API 제한에「Places API (New)」추가(개발 중엔 제한 없음으로 테스트 가능). 구「Places API」만 허용돼 있으면 places.googleapis.com(New) 호출은 막힐 수 있습니다.",
    ].join(" ");
  }
  if (detailReason === "API_KEY_HTTP_REFERRER_BLOCKED") {
    return "API_KEY_HTTP_REFERRER_BLOCKED: 서버(Node) 요청에는 리퍼러 제한 키를 쓸 수 없습니다. server/.env의 GOOGLE_PLACES_API_KEY를 앱 제한 없음 또는 IP 키로 바꾸세요.";
  }

  return [
    "PERMISSION_DENIED/403: 이 키는 Node 서버에서 호출됩니다.",
    "API 키「애플리케이션 제한」이 HTTP 리퍼러(웹사이트)만 허용이면 서버 요청이 막힙니다 → 백엔드용 키(제한 없음 또는 서버 IP)를 쓰거나 별도 키를 만드세요.",
    "「API 제한」에는 Places API (New)가 포함돼야 합니다(구 Places API만 켜도 New 엔드포인트는 거절될 수 있음).",
    detailReason ? `(detail: ${detailReason})` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function isApiKeyServiceBlocked(googleBody) {
  const details = googleBody?.error?.details;
  if (!Array.isArray(details)) return false;
  return details.some((d) => d?.reason === "API_KEY_SERVICE_BLOCKED");
}

// 환경 변수 로깅
console.log("🔍 환경 변수 확인:");
console.log("🔍 __dirname:", __dirname);
console.log("🔍 env (루트):", path.join(__dirname, "..", ".env"));
console.log("🔍 env (서버):", path.join(__dirname, ".env"));
console.log("🔍 NAVER_CLIENT_ID:", process.env.NAVER_CLIENT_ID ? "설정됨" : "설정안됨");
console.log("🔍 NAVER_CLIENT_SECRET:", process.env.NAVER_CLIENT_SECRET ? "설정됨" : "설정안됨");
console.log(
  "🔍 KAKAO REST (프록시·추천장소 보강):",
  getKakaoRestApiKey() ? "설정됨" : "미설정 — 큐레이터 분류(미분류) 보강 실패"
);
{
  const gOk = Boolean(getGooglePlacesApiKey());
  const vOnly =
    !gOk && Boolean((process.env.VITE_GOOGLE_PLACES_API_KEY || "").trim());
  console.log(
    "🔍 GOOGLE_PLACES (장소카드 사진, 서버):",
    gOk
      ? "GOOGLE_PLACES_API_KEY 사용"
      : vOnly
        ? "미설정 — VITE_만 있음(서버에서 무시됨)"
        : "미설정"
  );
  if (vOnly) {
    console.warn(
      "⚠️ server/.env에 GOOGLE_PLACES_API_KEY=... 를 넣으세요. VITE_GOOGLE_PLACES_API_KEY는 지도(브라우저)용이라 서버 프록시에 쓰면 API_KEY_HTTP_REFERRER_BLOCKED가 납니다."
    );
  }
  if (gOk) {
    const k = getGooglePlacesApiKey();
    const n = k.length;
    const fp =
      n >= 12 ? `${k.slice(0, 8)}...${k.slice(-4)} (${n}자)` : "(키 문자열 이상)";
    console.log(
      "🔍 GOOGLE_PLACES 키 지문 — Cloud Console「키 표시」값과 앞 8자·끝 4자가 같은지 비교:",
      fp
    );
  }
}

import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import OpenAI from "openai";
import axios from "axios";
import {
  blogInsightFromCacheRow,
  fetchPlaceBlogInsightsBatch,
  fingerprintFromPosts,
  isPlaceBlogCacheEnabled,
  stableExternalPlaceId,
  upsertPlaceBlogInsight,
} from "./placeBlogInsightsCache.js";
import { searchCuratorPlaces } from "./curatorPlaceSearch.js";

const app = express();
app.use(cors());
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

const port = process.env.PORT || 4000;

const PLACEHOLDER_OPENAI_KEY =
  "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

// OpenAI 클라이언트 초기화 (위에서 루트+server .env 모두 로드됨)
const resolvedOpenAiKey =
  (process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim()) ||
  PLACEHOLDER_OPENAI_KEY;

const openai = new OpenAI({
  apiKey: resolvedOpenAiKey,
});

function hasUsableOpenAiKey() {
  const k = process.env.OPENAI_API_KEY;
  if (!k || typeof k !== "string") return false;
  const t = k.trim();
  // sk-… 실키는 길이만 대략 검사 (플레이스홀더만 제외). 연속 x 정규식은 실키에 x가 많으면 오탐.
  if (t.length < 20) return false;
  if (!t.startsWith("sk-")) return false;
  if (t === PLACEHOLDER_OPENAI_KEY) return false;
  return true;
}

const _openAiKeyPreview = hasUsableOpenAiKey()
  ? `${resolvedOpenAiKey.slice(0, 10)}…${resolvedOpenAiKey.slice(-4)}`
  : "없음/플레이스홀더";
console.log("🔍 OPENAI_API_KEY:", hasUsableOpenAiKey() ? `사용 가능 (${_openAiKeyPreview})` : "미설정·무효");
console.log(
  "🔍 place_blog_insights 캐시:",
  isPlaceBlogCacheEnabled() ? "Supabase service role 사용" : "비활성(SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY 필요)"
);

const BLOG_LLM_MAX_PLACES = 5;
const BLOG_LLM_MAX_CHARS_SNIPPET = 2800;
const BLOG_LLM_TIMEOUT_MS = 12000;

function buildBlogSnippetsForLlm(posts, maxChars) {
  let buf = "";
  for (const p of posts) {
    const title = String(p.title || "").slice(0, 200);
    const body = String(p.content || "").slice(0, 950);
    const chunk = `[제목] ${title}\n[본문] ${body}\n\n`;
    if (buf.length + chunk.length > maxChars) break;
    buf += chunk;
  }
  return buf.trim();
}

async function summarizeBlogsOneLine({ placeName, searchQuery, posts }) {
  if (!hasUsableOpenAiKey() || !Array.isArray(posts) || posts.length === 0) {
    return null;
  }
  const snippets = buildBlogSnippetsForLlm(posts, BLOG_LLM_MAX_CHARS_SNIPPET);
  if (!snippets) return null;

  const name = String(placeName || "장소").trim() || "장소";
  const ctx = String(searchQuery || "").trim().slice(0, 120);

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "너는 한국 로컬 술집·음식점 네이버 블로그 후기를 한 줄로 압축하는 편집자다. " +
              "출력은 요약 문장 한 줄만. 따옴표·불릿·'요약:' 같은 접두어 금지. " +
              "블로그 발췌에 없는 사실·평가는 쓰지 마라. 애매하면 '블로그에 묘사가 짧음' 수준으로만.",
          },
          {
            role: "user",
            content:
              `상호: ${name}\n` +
              `검색 맥락(참고만): ${ctx}\n\n` +
              `블로그 발췌:\n${snippets}\n\n` +
              `위 발췌에 근거해 분위기·메뉴·술·가격·상황 중 실제로 언급된 것만 골라 75자 이내 한 문장 한국어로.`,
          },
        ],
        max_tokens: 110,
        temperature: 0.35,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("llm_timeout")), BLOG_LLM_TIMEOUT_MS)
      ),
    ]);

    let one = (completion.choices[0]?.message?.content || "").trim();
    if (
      (one.startsWith('"') && one.endsWith('"')) ||
      (one.startsWith("'") && one.endsWith("'"))
    ) {
      one = one.slice(1, -1).trim();
    }
    one = one.replace(/\s+/g, " ").slice(0, 120);
    return one || null;
  } catch (e) {
    console.warn("summarizeBlogsOneLine:", name, e?.message || e);
    return null;
  }
}

// 카카오 로컬 API 모듈 추가
const kakaoLocalAPI = {
  // 장소 검색
  async searchPlaces(query) {
    try {
      const kakaoRestApiKey = getKakaoRestApiKey();
      if (!kakaoRestApiKey) {
        console.log("⚠️ 카카오 REST API 키가 없습니다. (KAKAO_REST_API_KEY 또는 VITE_KAKAO_REST_API_KEY)");
        return [];
      }

      console.log('🔍 kakaoLocalAPI.searchPlaces 호출');
      const response = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
        params: {
          query: query,
          size: 10,
          sort: 'distance'
        },
        headers: {
          'Authorization': `KakaoAK ${kakaoRestApiKey}`
        }
      });

      const results = response.data.documents || [];
      console.log(`✅ 카카오 API 응답 성공: ${results.length}개`);
      return results;
    } catch (error) {
      console.error('카카오 API 검색 오류:', error.message);
      return [];
    }
  }
};

// 네이버 지도 API 모듈
const naverMapAPI = {
  // 장소 검색
  async searchPlaces(query) {
    try {
      const clientId = process.env.NAVER_CLIENT_ID; // 실제 API 키 필요
      const clientSecret = process.env.NAVER_CLIENT_SECRET; // 실제 API 키 필요
      
      console.log('🔍 naverMapAPI.searchPlaces 호출');
      console.log('🔍 Client ID:', clientId);
      console.log('🔍 Client Secret:', clientSecret ? '설정됨' : '설정안됨');
      console.log('🔍 Query:', query);
      
      if (!clientId || !clientSecret) {
        console.log('⚠️ 네이버 API 키가 설정되지 않음');
        return [];
      }

      console.log('🔍 API 호출 시작...');
      const response = await axios.get(
        'https://openapi.naver.com/v1/search/local.json',
        {
          params: {
            query: query,
            display: 5,
            sort: 'random'
          },
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret
          }
        }
      );

      console.log('🔍 API 응답 성공:', response.data.items.length);
      return response.data.items.map(item => ({
        name: item.title.replace(/<[^>]*>/g, '').trim(),
        address: item.roadAddress || item.address,
        category: item.category,
        x: item.mapx,
        y: item.mapy,
        link: item.link
      }));
    } catch (error) {
      console.error('🔍 네이버 지도 API 오류:', error.message);
      console.error('🔍 상태 코드:', error.response?.status);
      return [];
    }
  }
};

// 장소 데이터를 AI가 이해하기 쉽게 압축하는 함수
function compactPlacesForAI(places) {
  return places.map((place) => ({
    id: String(place.id),
    name: place.name,
    address: place.address,
    region: place.region,
    category: place.category,
    tags: place.tags || [],
    comment: place.comment || "",
    curators: place.curators || [],
    curatorUsernames: place.curatorUsernames || [],
    savedCount: place.savedCount || 0,
    aiText: [
      place.name,
      place.region,
      place.address,
      place.primaryCurator,
      ...(place.curators || []),
      ...(place.tags || []),
      place.comment,
      place.savedCount ? `저장 ${place.savedCount}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
  }));
}

// 네이버 블로그 크롤러 실행 함수 (Python)
function runNaverCrawler(query) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 네이버 블로그 크롤링 시작: ${query}`);
    
    const pythonProcess = spawn("python3", [
      path.join(__dirname, "..", "naver_blog_crawler_v2.py"),
      query,
    ]);

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      if (code === 0) {
        try {
          // results 폴더에서 최신 JSON 파일 찾기
          const resultsDir = path.join(__dirname, "..", "results");
          const files = fs
            .readdirSync(resultsDir)
            .filter((file) => file.endsWith(".json"))
            .map((file) => ({
              name: file,
              path: path.join(resultsDir, file),
              mtime: fs.statSync(path.join(resultsDir, file)).mtime,
            }))
            .sort((a, b) => b.mtime - a.mtime);

          if (files.length > 0) {
            const latestFile = files[0];
            const blogData = JSON.parse(
              fs.readFileSync(latestFile.path, "utf8")
            );

            console.log(`✅ 네이버 블로그 크롤링 완료: ${blogData.length}개 리뷰`);
            resolve({
              success: true,
              data: blogData,
              file: latestFile.name,
            });
          } else {
            resolve({
              success: false,
              error: "크롤링 결과 파일을 찾을 수 없습니다.",
            });
          }
        } catch (error) {
          console.error("크롤링 결과 파싱 오류:", error);
          resolve({
            success: false,
            error: "크롤링 결과 파싱에 실패했습니다.",
          });
        }
      } else {
        console.error(`크롤러 실행 오류 (code: ${code}):`, stderr);
        resolve({
          success: false,
          error: `크롤러 실행 실패: ${stderr}`,
        });
      }
    });

    pythonProcess.on("error", (error) => {
      console.error("크롤러 프로세스 오류:", error);
      reject(error);
    });
  });
}

app.post("/api/search/curator-places", async (req, res) => {
  try {
    const {
      query,
      curatorId,
      limit,
      maxDistanceM,
      originLat,
      originLng,
      mode,
    } = req.body ?? {};

    const asFinite = (v) => {
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const limitN =
      limit != null && limit !== "" && Number.isFinite(Number(limit))
        ? Number(limit)
        : undefined;

    const result = await searchCuratorPlaces({
      openai,
      hasOpenAi: hasUsableOpenAiKey(),
      query,
      curatorId: curatorId || null,
      limit: limitN,
      maxDistanceM: asFinite(maxDistanceM),
      originLat: asFinite(originLat),
      originLng: asFinite(originLng),
      mode: typeof mode === "string" ? mode : "auto",
    });

    if (!result.ok && result.reason === "supabase_service_unavailable") {
      return res.status(503).json({
        error: "Supabase 서비스 키가 없어 큐레이터 DB 검색을 할 수 없습니다.",
        ...result,
      });
    }

    return res.json(result);
  } catch (e) {
    console.error("/api/search/curator-places", e);
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * 코스 1차→2차 보행 경로 (OSRM 공개 데모 — 프로덕션은 자체 OSRM/키 있는 라우팅으로 교체 권장)
 * Query: slat, slng, dlat, dlng (WGS84)
 */
app.get("/api/course-walking-route", async (req, res) => {
  const slat = Number(req.query.slat);
  const slng = Number(req.query.slng);
  const dlat = Number(req.query.dlat);
  const dlng = Number(req.query.dlng);
  if (![slat, slng, dlat, dlng].every((n) => Number.isFinite(n))) {
    return res.status(400).json({ ok: false, error: "invalid_coordinates" });
  }
  const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${slng},${slat};${dlng},${dlat}?overview=full&geometries=geojson&steps=false`;
  try {
    const r = await fetch(osrmUrl, {
      headers: { "User-Agent": "judo-course-walking-route/1.0" },
    });
    if (!r.ok) {
      return res.json({
        ok: false,
        error: "routing_http",
        status: r.status,
      });
    }
    const data = await r.json();
    const route = data?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      return res.json({ ok: false, error: "no_route" });
    }
    const path = coords.map(([lng, lat]) => ({
      lat: Number(lat),
      lng: Number(lng),
    }));
    return res.json({
      ok: true,
      path,
      distanceMeters: Math.round(Number(route.distance) || 0),
      durationSeconds: Math.round(Number(route.duration) || 0),
    });
  } catch (e) {
    console.error("/api/course-walking-route", e);
    return res.json({ ok: false, error: "fetch_failed" });
  }
});

/** 5단계: AI는 장소를 발명하지 않고, 검색·지도 파이프라인을 보조하는 구조화 힌트만 반환 */
app.post("/api/search-intent-assist", async (req, res) => {
  const raw = req.body?.query;
  const query = typeof raw === "string" ? raw.trim() : "";
  if (!query) {
    return res.status(400).json({ error: "query가 비어 있습니다." });
  }

  const emptyHints = () => ({
    vibe: "",
    situation: "",
    purpose: "",
    alcoholScope: "",
    foodOrSnackWeight: "",
    regionHint: "",
  });

  const fallback = () => ({
    queryCorrected: query,
    intentSummary: "",
    filterHints: emptyHints(),
    kakaoKeywordHint: query,
    broadKakaoKeyword: "",
    fallbackSearchIdeas: [],
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-proj-xxxx")) {
    return res.json(fallback());
  }

  const intentSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      queryCorrected: { type: "string" },
      intentSummary: { type: "string" },
      filterHints: {
        type: "object",
        additionalProperties: false,
        properties: {
          vibe: { type: "string" },
          situation: { type: "string" },
          purpose: { type: "string" },
          alcoholScope: { type: "string" },
          foodOrSnackWeight: { type: "string" },
          regionHint: { type: "string" },
        },
        required: [
          "vibe",
          "situation",
          "purpose",
          "alcoholScope",
          "foodOrSnackWeight",
          "regionHint",
        ],
      },
      kakaoKeywordHint: { type: "string" },
      broadKakaoKeyword: {
        type: "string",
        description: "가장 넓은 카카오 키워드(지역+술집 등). 상호명 금지.",
      },
      fallbackSearchIdeas: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "queryCorrected",
      "intentSummary",
      "filterHints",
      "kakaoKeywordHint",
      "broadKakaoKeyword",
      "fallbackSearchIdeas",
    ],
  };

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
                "너는 지도·로컬 검색(카카오 등) 앞단에 붙는 ‘의도 파서’다. 출력은 JSON 스키마뿐이다.\n\n" +
                "[금지] 구체 상호명·주소·전화·‘여기 가봐’ 같은 장소 추천. 실제 존재를 단정하는 문장. 챗봇식 잡담.\n" +
                "[허용] 오타·표현 정리, 무드/목적/상황/주종/안주 무게/지역 단서를 짧은 한국어 태그로 정리, " +
                "카카오 키워드 검색용 짧은 kakaoKeywordHint, " +
                "broadKakaoKeyword는 조건을 최대한 넓힌 한 줄(예: 강남 술집, 압구정 술집, 서울 이자카야). 상호명·주소 금지. " +
                "결과가 비었을 때 쓸 짧은 대체 검색어 fallbackSearchIdeas(2~4개).\n" +
                "모르는 필드는 빈 문자열. 장소 이름은 출력하지 마라.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `사용자 검색어:\n${query}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "judo_search_intent_assist",
          strict: true,
          schema: intentSchema,
        },
      },
    });

    const parsed = JSON.parse(response.output_text);
    return res.json({
      queryCorrected: String(parsed.queryCorrected ?? query).trim() || query,
      intentSummary: String(parsed.intentSummary ?? ""),
      filterHints: {
        ...emptyHints(),
        ...(typeof parsed.filterHints === "object" && parsed.filterHints
          ? parsed.filterHints
          : {}),
      },
      kakaoKeywordHint:
        String(parsed.kakaoKeywordHint ?? "").trim() || query,
      broadKakaoKeyword: String(parsed.broadKakaoKeyword ?? "").trim(),
      fallbackSearchIdeas: Array.isArray(parsed.fallbackSearchIdeas)
        ? parsed.fallbackSearchIdeas.map(String).slice(0, 4)
        : [],
    });
  } catch (e) {
    console.error("search-intent-assist error:", e?.message || e);
    return res.json(fallback());
  }
});

// 네이버 지역 검색 API
async function searchNaverLocal(query) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.log("⚠️ NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET가 없습니다. 샘플 데이터 사용.");
    // API 키가 없으면 샘플 데이터 반환
    return generateSampleData(query);
  }

  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/local.json', {
      params: {
        query: query,
        display: 10,
        sort: 'random'
      },
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      }
    });

    const results = response.data.items || [];
    
    // 결과가 없으면 샘플 데이터 반환
    if (results.length === 0) {
      console.log("⚠️ 네이버 API 결과가 없습니다. 샘플 데이터 사용.");
      return generateSampleData(query);
    }
    
    return results;
  } catch (error) {
    console.error("네이버 API 검색 오류:", error.message);
    console.log("⚠️ API 오류 발생. 샘플 데이터 사용.");
    return generateSampleData(query);
  }
}

// 샘플 데이터 생성
function generateSampleData(query) {
  const sampleData = [];
  
  // 검색어에 따른 샘플 데이터
  if (query.includes('을지로')) {
    sampleData.push(
      {
        title: '을지로 와인바 쉐르빈',
        address: '서울 중구 을지로동 123-45',
        mapx: '319544',
        mapy: '529945',
        category: '와인바',
        telephone: '02-1234-5678'
      }
    );
  }
  
  if (query.includes('강남')) {
    sampleData.push(
      {
        title: '강남역 와인바 라뮤즈',
        address: '서울 강남구 강남대로 123',
        mapx: '319600',
        mapy: '530100',
        category: '와인바',
        telephone: '02-5678-1234'
      }
    );
  }
  
  // 기본 샘플 데이터 (서울 중심부 좌표)
  if (sampleData.length === 0) {
    sampleData.push(
      {
        title: '서울 와인바 비노테카',
        address: '서울 종로구 삼청동 101',
        mapx: '319544',
        mapy: '529945',
        category: '와인바',
        telephone: '02-8901-1234'
      }
    );
  }
  
  return sampleData;
}

// KATECH 좌표를 위경도로 변환 (안정적인 변환)
function convertKatechToWGS84(mapx, mapy) {
  // 네이버 API의 KATECH 좌표를 WGS84 위경도로 변환
  // 서울 지역에 맞는 간단한 변환 공식 사용
  
  // 서울 중심부 좌표 (대략적인 KATECH 좌표)
  const SEOUL_CENTER_X = 319544;
  const SEOUL_CENTER_Y = 529945;
  const SEOUL_LAT = 37.5665;
  const SEOUL_LNG = 126.9780;
  
  // KATECH 좌표를 위경도로 변환 (간단한 선형 변환)
  // 실제 네이버 API는 다른 좌표계를 사용하므로 더 정확한 변환 필요
  const SCALE_X = 0.000001; // 경도 스케일
  const SCALE_Y = 0.000001; // 위도 스케일
  
  const deltaX = (parseInt(mapx) - SEOUL_CENTER_X) * SCALE_X;
  const deltaY = (parseInt(mapy) - SEOUL_CENTER_Y) * SCALE_Y;
  
  const lat = SEOUL_LAT + deltaY;
  const lng = SEOUL_LNG + deltaX;
  
  // 서울 지역 범위로 제한 (잘못된 좌표 방지)
  const boundedLat = Math.max(37.4, Math.min(37.7, lat));
  const boundedLng = Math.max(126.8, Math.min(127.2, lng));
  
  if (process.env.DEBUG_KATECH === "1") {
    console.log(
      `좌표 변환: KATECH(${mapx}, ${mapy}) → WGS84(${boundedLat}, ${boundedLng})`
    );
  }

  return {
    lat: boundedLat,
    lng: boundedLng
  };
}

// 네이버 검색 결과를 장소 데이터로 변환
function convertNaverToPlaceData(items, query) {
  return items.map((item, index) => {
    const coords = convertKatechToWGS84(
      parseInt(item.mapx),
      parseInt(item.mapy)
    );
    
    return {
      id: `naver_${index}_${Date.now()}`,
      name: item.title.replace(/<[^>]*>/g, ''),
      address: item.address,
      lat: coords.lat,
      lng: coords.lng,
      category: item.category,
      phone: item.telephone || '',
      aiText: `${item.title.replace(/<[^>]*>/g, '')} - ${item.category} · ${item.address}`,
      isExternal: true, // 외부 데이터 표시
      source: 'naver'
    };
  });
}

app.post("/api/ai-search", async (req, res) => {
  try {
    const { query, places } = req.body ?? {};

    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "query가 비어 있습니다." });
    }

    // places가 비어있어도 네이버 API는 호출하도록 수정
    let compactPlaces = [];
    if (Array.isArray(places) && places.length > 0) {
      compactPlaces = compactPlacesForAI(places);
    } else {
      console.log('⚠️ places가 비어있어 네이버 API만 사용합니다.');
    }

    // 1. 네이버 블로그 크롤링 실행
    console.log(`🔍 검색어: ${query}`);
    const crawlerResult = await runNaverCrawler(query + " 후기");

    let blogReviews = [];
    let blogSummary = "";

    if (crawlerResult.success) {
      blogReviews = crawlerResult.data;
      blogSummary = `네이버 블로그에서 ${blogReviews.length}개의 실제 리뷰를 찾았습니다.`;

      // 블로그 리뷰에서 장소 이름 추출
      const blogPlaces = blogReviews
        .filter((review) => review.place_name && review.place_name !== "내용 추출 실패")
        .map((review) => review.place_name);

      console.log(`📝 발견된 장소: ${blogPlaces.join(", ")}`);
    } else {
      console.log(`⚠️ 블로그 크롤링 실패: ${crawlerResult.error}`);
      blogSummary = "블로그 리뷰를 불러오지 못했지만, 기존 데이터로 추천해드릴게요.";
    }

    // 2. 네이버 지도 API로 장소 검색
    console.log(`🗺️ 네이버 지도 API로 장소 검색: ${query}`);
    console.log(`🗺️ 원본 쿼리: ${JSON.stringify(query)}`);
    console.log(`🗺️ 쿼리 타입: ${typeof query}`);
    console.log(`🗺️ 쿼리 길이: ${query.length}`);
    
    // 검색어 단순화 - 네이버 API는 간단한 검색어만 지원
    let simplifiedQuery = query;
    
    // 복잡한 검색어를 단순화
    if (query.includes('혼술하기 좋은') || query.includes('추천') || query.includes('좋은')) {
      simplifiedQuery = query.replace(/혼술하기 좋은|추천|좋은/g, '').trim();
    }
    
    // 지역명 분석 및 확장
    const dongPatterns = [
      /강남역|역삼동|역삼|삼성동|삼성|선릉동|선릉|개포동|개포|일원동|일원/,
      /홍대|신촌|합정|망원|연희|대현|공덕|창신/,
      /명동|회현|소공|을지로|동대문|종로|광화기|신당|방배/,
      /이태원|한남|서초동|서초|교대|사당|방배|도곡동|도곡/,
      /잠실|신천|송파|가락|문정|장지|방이|오금/,
      /여의도|영등포|대림|신도림|구로|가산|안양|부천/,
      /제주|부산|대구|광주|대전|울산/
    ];
    
    const guPatterns = [
      /강남구|강남/,
      /서초구|서초/,
      /송파구|송파/,
      /영등포구|영등포/,
      /마포구|마포/,
      /용산구|용산/,
      /성동구|성동/,
      /광진구|광진/,
      /동대문구|동대문/,
      /중구|종로구/,
      /은평구|서대문구/,
      /노원구|도봉구|강북구/,
      /강동구|강서구|구로구|금천구|영등포구/
    ];
    
    let hasDong = false;
    let hasGu = false;
    let regionName = '';
    
    // 동 단위 지역명 확인
    for (const pattern of dongPatterns) {
      const match = simplifiedQuery.match(pattern);
      if (match) {
        hasDong = true;
        regionName = match[0];
        break;
      }
    }
    
    // 구 단위 지역명 확인
    if (!hasDong) {
      for (const pattern of guPatterns) {
        const match = simplifiedQuery.match(pattern);
        if (match) {
          hasGu = true;
          regionName = match[0];
          break;
        }
      }
    }
    
    // 지역명이 없으면 구 단위로 확장된 검색어 생성
    if (!hasDong && !hasGu) {
      // 사용자 위치가 있으면 현재 지역 기반으로 검색
      if (userLocation) {
        const lat = userLocation.lat;
        const lng = userLocation.lng;
        
        // 대략적인 지역 판단 (위도/경도 기준)
        if (lat >= 37.5 && lat <= 37.6 && lng >= 127.0 && lng <= 127.1) {
          simplifiedQuery = '강남구 ' + simplifiedQuery;
        } else if (lat >= 37.55 && lat <= 37.6 && lng >= 126.9 && lng <= 127.0) {
          simplifiedQuery = '마포구 ' + simplifiedQuery;
        } else if (lat >= 37.48 && lat <= 37.55 && lng >= 127.0 && lng <= 127.1) {
          simplifiedQuery = '송파구 ' + simplifiedQuery;
        } else {
          simplifiedQuery = '서울 ' + simplifiedQuery;
        }
      } else {
        simplifiedQuery = '서울 ' + simplifiedQuery;
      }
    } else {
      // 지역명이 있으면 그대로 사용 (강제로 술집 추가 안함)
      // 이미 좋은 검색어이거나 사용자가 원하는 검색어
    }
    
    console.log(`🗺️ 지역 분석: 동=${hasDong}, 구=${hasGu}, 지역=${regionName}`);
    console.log(`🗺️ 단순화된 쿼리: ${simplifiedQuery}`);
    
    const naverPlaces = await naverMapAPI.searchPlaces(simplifiedQuery);
    console.log(`📍 네이버 지도 검색 결과: ${naverPlaces.length}개 장소`);
    
    // 카카오 API 병행 검색
    const kakaoPlaces = await kakaoLocalAPI.searchPlaces(simplifiedQuery);
    console.log(`📍 카카오 지도 검색 결과: ${kakaoPlaces.length}개 장소`);
    
    // 카카오 결과를 네이버 형식으로 변환
    const convertedKakaoPlaces = kakaoPlaces.map(place => ({
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      category: place.category_name,
      x: place.x.toString(),
      y: place.y.toString(),
      link: place.place_url,
      source: 'kakao'
    }));
    
    // 두 API 결과 병합 및 중복 제거
    const allPlaces = [...naverPlaces, ...convertedKakaoPlaces];
    const uniquePlaces = allPlaces.filter((place, index, self) => 
      index === self.findIndex(p => p.name === place.name)
    );
    
    console.log(`📍 전체 검색 결과: 네이버 ${naverPlaces.length}개 + 카카오 ${kakaoPlaces.length}개 = 총 ${allPlaces.length}개 (중복 제거: ${uniquePlaces.length}개)`);
    
    // 병합된 결과를 최종 결과로 사용
    const mergedAPIPlaces = uniquePlaces;

    // 3. AI 추천 생성 (내부 데이터 + 네이버 장소 통합)
    console.log(`🤖 AI 추천 생성 시작...`);
    
    // 네이버 장소를 internal 데이터 형식으로 변환하여 AI 추천에 포함
    const naverPlacesForAI = mergedAPIPlaces.map((place, index) => ({
      id: `api_${index}`, // 고유 ID 생성
      name: place.name || place.title,
      address: place.address,
      region: place.address,
      primaryCurator: place.source === 'kakao' ? "카카오 지도" : "네이버 지도",
      curators: place.source === 'kakao' ? ["카카오 지도"] : ["네이버 지도"],
      tags: place.category ? [place.category] : [],
      comment: place.description || "",
      savedCount: 0,
      aiText: [
        place.name || place.title,
        place.address,
        place.category,
        place.source === 'kakao' ? "카카오 지도" : "네이버 지도"
      ].filter(Boolean).join(" | "),
    }));
    
    // 내부 데이터와 네이버 장소 통합
    const allPlacesForAI = [...compactPlaces, ...naverPlacesForAI];
    
    console.log(`📊 AI 추천용 데이터: 내부 ${compactPlaces.length}개 + 네이버 ${naverPlaces.length}개 = 총 ${allPlacesForAI.length}개`);

    // 4. AI 검색 실행 (블로그 리뷰 + 네이버 지도 정보)
    const systemPrompt = blogReviews.length > 0
      ? `너는 한국 술집 추천 큐레이터다. 사용자 검색어와 관련된 네이버 블로그 실제 리뷰 정보를 제공받았다.

[역할 제한] 주도는 지도/API 후보 목록이다. 너는 목록 밖의 장소를 지어내거나 존재를 단정하지 마라. 챗봇처럼 잡담하지 마라. 반드시 제공된 id만 recommendedPlaceIds에 넣는다.

실제 블로그 리뷰 데이터:
${JSON.stringify(blogReviews.slice(0, 5), null, 2)}

블로그 리뷰에 언급된 장소와 네이버 지도 검색된 장소를 모두 고려하여 추천해라. 네이버 지도에서 검색된 최신 장소 정보를 우선적으로 고려하되, 블로그 리뷰에 실제로 언급된 장소가 있다면 가중치를 높여 추천해라.
추천 형식: 상호명 - 추천이유 (한줄)`
      : "너는 한국 술집 추천 큐레이터다. [역할 제한] 주도는 지도/API 후보 목록이다. 목록 밖 장소를 발명하지 말고, 제공된 id만 사용하라. 네이버 지도에서 검색된 최신 장소 정보를 우선적으로 고려하여 추천해라. 추천 형식: 상호명 - 추천이유 (한줄)";
    // 네이버 API로 외부 데이터 검색
    console.log("🔍 네이버 API 검색 시작:", query);
    const naverResults = await searchNaverLocal(query);
    console.log("✅ 네이버 API 검색 결과:", naverResults.length, "개");
    
    // 네이버 결과를 장소 데이터로 변환
    const convertedNaverPlaces = convertNaverToPlaceData(naverResults, query);
    
    // 외부 데이터가 있으면 외부 데이터만 사용
    const mergedPlaces = convertedNaverPlaces.length > 0 ? convertedNaverPlaces : places;
    
    if (!Array.isArray(mergedPlaces) || mergedPlaces.length === 0) {
      return res.status(400).json({ error: "검색 결과가 없습니다." });
    }

    const compactPlacesForOpenAI = compactPlacesForAI(mergedPlaces);

    const response = await openai.responses.create({
      model: "gpt-4o",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt +
                "사용자 요청에서 지역, 술 종류, 분위기, 상황(1차/2차/데이트/회식/혼술), 취향을 해석해 가장 잘 맞는 장소를 최대 5개 고른다. " +
                "tags, comment, curators, savedCount, aiText를 적극 활용해라. " +
                "savedCount가 높다고 무조건 우선하지 말고, 요청 적합성을 더 우선하되 동점이면 savedCount가 높은 곳을 선호해라. " +
                "comment에 적힌 문맥을 중요하게 보아라. 예: 소주 한잔, 분위기 좋은, 심야, 안주가 탄탄 같은 표현을 해석해라. " +
                "추천 이유는 짧지만 구체적으로 써라. 예: 을지로에서 노포·소주·2차 조건에 가장 잘 맞음 같은 식으로. " +
                "근거 없는 칭찬 금지. 후보 JSON에 없는 장소는 언급하지 마라.",
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
                `블로그 리뷰 요약:\n${blogSummary}\n\n` +
                `후보 장소 목록(JSON):\n${JSON.stringify(compactPlacesForOpenAI)}\n\n` +
                `규칙:\n` +
                `- recommendedPlaceIds는 반드시 위 목록의 id만 사용\n` +
                `- 최대 5개 추천\n` +
                `- 요청과 잘 맞는 순서대로 정렬\n` +
                `- 네이버 지도에서 검색된 장소를 우선적으로 고려\n` +
                `- reasons에는 각 장소를 왜 골랐는지 사용자 검색어 기준으로 설명`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "judo_place_recommendation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: {
                type: "string",
              },
              recommendedPlaceIds: {
                type: "array",
                items: { type: "string" },
              },
              reasons: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    placeId: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["placeId", "reason"],
                },
              },
            },
            required: ["summary", "recommendedPlaceIds", "reasons"],
          },
        },
      },
    });

    const parsed = JSON.parse(response.output_text);

    const validIdSet = new Set(compactPlacesForOpenAI.map((p) => String(p.id)));

    let recommendedPlaceIds = [];
    let reasons = [];

    // AI 추천 결과 처리 (내부 데이터 + 네이버 장소 통합)
    if (compactPlacesForOpenAI.length > 0) {
      recommendedPlaceIds = Array.isArray(parsed.recommendedPlaceIds)
        ? parsed.recommendedPlaceIds
            .map((id) => String(id))
            .filter((id) => validIdSet.has(id))
            .slice(0, 5)
        : [];

      reasons = Array.isArray(parsed.reasons)
        ? parsed.reasons
            .map((item) => ({
              placeId: String(item.placeId),
              reason: String(item.reason || ""),
            }))
            .filter((item) => validIdSet.has(item.placeId))
        : [];

      if (recommendedPlaceIds.length === 0) {
        // fallback: 네이버 장소 우선으로 정렬
        const fallback = [...compactPlacesForOpenAI]
          .sort((a, b) => {
            // 네이버 장소를 우선적으로 정렬
            const aIsNaver = a.id.startsWith('naver_');
            const bIsNaver = b.id.startsWith('naver_');
            if (aIsNaver && !bIsNaver) return -1;
            if (!aIsNaver && bIsNaver) return 1;
            return 0;
          })
          .slice(0, 5);

        recommendedPlaceIds = fallback.map((item) => item.id);
        reasons = fallback.map((item) => ({
          placeId: item.id,
          reason: item.id.startsWith('naver_') 
            ? "네이버 지도에서 검색된 최신 장소입니다." 
            : "AI가 완벽히 일치하는 결과를 좁히지 못해 인기 높은 후보로 보완했어요.",
        }));
      }
    } else {
      console.log('⚠️ 추천 가능한 장소가 없어 AI 추천을 건너뜁니다.');
    }

    // 5. 블로그 리뷰 정보 추가
    const finalSummary = blogReviews.length > 0
      ? `${parsed.summary} (네이버 블로그 ${blogReviews.length}개 리뷰 기반)`
      : parsed.summary;

    res.json({
      summary:
        finalSummary ||
        parsed.summary ||
        "요청 조건에 맞는 후보를 네이버 검색 결과에서 골라봤어요.",
      recommendedPlaceIds,
      reasons,
      blogReviews: blogReviews.slice(0, 10), // 최대 10개 리뷰 전달
      blogSummary,
      naverPlaces: naverPlaces.map(place => ({
        id: `naver_${place.name.replace(/\s+/g, '_')}`,
        name: place.name,
        address: place.address,
        category: place.category,
        lat: parseFloat(place.y) / 10000000, // 네이버 좌표 변환
        lng: parseFloat(place.x) / 10000000, // 네이버 좌표 변환
        isNaverPlace: true,
        link: place.link
      })),
      externalPlaces: naverPlaces, // 외부 데이터도 함께 반환
    });
  } catch (error) {
    console.error("AI search error:", error);

    const message =
      error?.message ||
      error?.error?.message ||
      "AI 검색 중 오류가 발생했습니다.";

    res.status(500).json({
      error: message,
    });
  }
});

// --- 블로그 키워드 매칭 (SearchBar 주변 검색 `/api/nearby-with-blog`) ---
function extractKeywordsFromBlogs(blogPosts) {
  const keywords = {
    atmosphere: [],
    menu: [],
    purpose: [],
    drink: [],
  };
  const allText = blogPosts
    .map((post) =>
      `${post.title || ""} ${post.description || post.content || ""}`.toLowerCase()
    )
    .join(" ");

  /** 블로그 본문 substring 매칭 — 짧은 한 글자(회·술 등)는 오탐 방지로 제외 */
  const atmosphereKeywords = [
    "조용한",
    "시끄러운",
    "활기찬",
    "아늑한",
    "아늑함",
    "포근한",
    "모던한",
    "빈티지",
    "레트로",
    "감성",
    "감성적인",
    "감성충만",
    "힙한",
    "힙플레이스",
    "세련된",
    "편안한",
    "고급스러운",
    "럭셔리",
    "캐주얼한",
    "로맨틱",
    "담백한",
    "깔끔한",
    "넓은",
    "아담한",
    "아기자기한",
    "따뜻한",
    "차분한",
    "화려한",
    "미니멀",
    "인더스트리얼",
    "고즈넉한",
    "답답하지 않은",
    "루프탑",
    "야외테라스",
    "야외 테라스",
    "테라스",
    "야장",
    "통창",
    "통유리",
    "야경",
    "한강뷰",
    "한강 뷰",
    "전망",
    "뷰맛집",
    "어두운",
    "밝은",
    "무드",
    "조명",
    "인스타",
    "인스타감성",
    "인스타 감성",
    "포토존",
    "사진맛집",
    "사진 잘 나오",
    "북적",
    "북적이는",
    "한산",
    "한적",
    "웨이팅",
    "줄서는",
    "줄 서는",
    "예쁜",
    "이쁜",
    "분위기있는",
    "분위기 있는",
    "분위기 야무진",
    "숨은맛집",
    "숨은 맛집",
    "노포",
    "오래된",
    "올드",
    "신상",
    "뉴오픈",
    "그랜드오픈",
    "오픈한지",
    "코지",
    "아늑",
  ];
  const menuKeywords = [
    "피자",
    "파스타",
    "스테이크",
    "햄버거",
    "버거",
    "안주",
    "치킨",
    "후라이드",
    "양념치킨",
    "간장치킨",
    "해산물",
    "해산물모둠",
    "조개구이",
    "샐러드",
    "타코",
    "라멘",
    "라면",
    "우동",
    "스시",
    "초밥",
    "사시미",
    "모둠회",
    "생선회",
    "물회",
    "꼬치",
    "꼬치구이",
    "야키토리",
    "이자카야",
    "삼겹살",
    "목살",
    "갈비",
    "LA갈비",
    "곱창",
    "대창",
    "막창",
    "양갈비",
    "소갈비",
    "돼지갈비",
    "순두부",
    "김치찌개",
    "부대찌개",
    "된장찌개",
    "순두부찌개",
    "전골",
    "샤브샤브",
    "떡볶이",
    "튀김",
    "모둠튀김",
    "순대",
    "오뎅",
    "어묵",
    "막국수",
    "비빔국수",
    "물냉면",
    "비빔냉면",
    "쫄면",
    "닭발",
    "무뼈닭발",
    "곱도리탕",
    "닭도리탕",
    "치즈볼",
    "치즈",
    "감자튀김",
    "감튀",
    "오징어",
    "한치",
    "버터구이",
    "과일",
    "과일안주",
    "치즈플래터",
    "모둠안주",
    "한우",
    "육회",
    "육사시미",
    "말이",
    "전",
    "파전",
    "해물파전",
    "떡갈비",
    "불고기",
    "제육",
    "보쌈",
    "족발",
    "맥앤치즈",
    "나초",
    "감바스",
    "에다마메",
    "타코야끼",
    "가라아게",
    "돈카츠",
    "돈까스",
    "함박",
    "리조또",
    "리조토",
  ];
  const purposeKeywords = [
    "데이트",
    "2차",
    "이차",
    "3차",
    "회식",
    "회식장소",
    "혼술",
    "혼술맛집",
    "혼밥",
    "친구",
    "지인",
    "단체",
    "단체모임",
    "기념일",
    "생일",
    "생일파티",
    "기념파티",
    "분위기 좋은",
    "맛있는",
    "가성비",
    "가성비좋",
    "뷰 좋은",
    "소개팅",
    "처음만남",
    "부모님",
    "가족",
    "가족모임",
    "아이동반",
    "키즈",
    "브런치",
    "야식",
    "새벽까지",
    "늦게까지",
    "밤늦게",
    "밤샘",
    "점심약속",
    "점심 약속",
    "퇴근후",
    "퇴근 후",
    "금요일",
    "불금",
    "주말나들이",
    "주말 나들이",
    "손님접대",
    "접대",
    "미팅",
    "비즈니스",
    "워크샵",
    "팀다짐",
    "신입환영",
    "여행",
    "관광",
    "관광객",
    "여행중",
    "들렀",
    "들르기",
    "들림",
    "1인",
    "1인석",
    "수다",
    "수다떨기",
    "대화하기",
    "대화하기좋",
    "조용히",
    "프라이빗",
    "개별룸",
    "룸술집",
    "프로포즈",
    "커플",
    "우정",
    "우정여행",
    "예약",
    "당일예약",
    "예약필수",
    "노키즈",
    "애견동반",
    "반려견",
    "반려동물",
    "뒷풀이",
    "엠티",
    "동창회",
    "동호회",
    "첫방문",
    "재방문",
    "단골",
  ];
  const drinkKeywords = [
    "맥주",
    "생맥",
    "생맥주",
    "수제맥주",
    "크래프트",
    "드래프트",
    "IPA",
    "에일",
    "라들러",
    "흑맥주",
    "소주",
    "맥소",
    "소맥",
    "와인",
    "와인바",
    "하우스와인",
    "와인페어링",
    "내추럴와인",
    "내추럴 와인",
    "오렌지와인",
    "샴페인",
    "스파클링",
    "프로세코",
    "하이볼",
    "자몽하이볼",
    "얼그레이하이볼",
    "레몬사워",
    "하이볼바",
    "칵테일",
    "시그니처칵테일",
    "모히또",
    "마가리타",
    "올드패션드",
    "위스키",
    "싱글몰트",
    "싱 몰트",
    "버번",
    "사케",
    "일본주",
    "청주",
    "보드카",
    "진토닉",
    "다크럼",
    "화이트럼",
    "데킬라",
    "테킬라",
    "브랜디",
    "막걸리",
    "탁주",
    "전통주",
    "과실주",
    "매실주",
    "복분자",
    "약주",
    "하이트",
    "카스",
    "테라",
    "클라우드",
    "기네스",
    "하우스 바텐",
    "바텐더",
    "페어링",
    "무알콜",
    "논알콜",
    "음료무한",
    "무한리필",
    "셀프주류",
    "셀프맥주",
    "냉장고",
    "냉장콜",
  ];

  atmosphereKeywords.forEach((kw) => {
    if (allText.includes(kw)) keywords.atmosphere.push(kw);
  });
  menuKeywords.forEach((kw) => {
    if (allText.includes(kw)) keywords.menu.push(kw);
  });
  purposeKeywords.forEach((kw) => {
    if (allText.includes(kw)) keywords.purpose.push(kw);
  });
  drinkKeywords.forEach((kw) => {
    if (allText.includes(kw)) keywords.drink.push(kw);
  });

  keywords.atmosphere = [...new Set(keywords.atmosphere)];
  keywords.menu = [...new Set(keywords.menu)];
  keywords.purpose = [...new Set(keywords.purpose)];
  keywords.drink = [...new Set(keywords.drink)];
  return keywords;
}

function normalizeInsightBlob(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * 블로그 제목·본문에 상호가 언급된 글만 해당 장소에 묶고,
 * extractKeywordsFromBlogs로 태그 생성 + (선택) LLM 한 줄 요약
 */
async function enrichPlacesWithBlogInsights(places, blogReviews, searchQuery) {
  const q0 = String(searchQuery || "").trim();
  if (!Array.isArray(places) || places.length === 0) {
    return {
      places: places || [],
      blogInsightPlaces: 0,
      llmSummaryCount: 0,
      blogInsightCacheHits: 0,
    };
  }
  if (!Array.isArray(blogReviews) || blogReviews.length === 0) {
    return {
      places: places.map((p) => ({ ...p })),
      blogInsightPlaces: 0,
      llmSummaryCount: 0,
      blogInsightCacheHits: 0,
    };
  }

  const sortedByNameLen = [...places].sort(
    (a, b) =>
      String(b.place_name || "").length - String(a.place_name || "").length
  );

  const postsByPlaceId = new Map();
  for (const p of places) postsByPlaceId.set(String(p.id), []);

  for (const review of blogReviews) {
    const blobRaw = `${review.title || ""} ${review.content || ""} ${review.place_name || ""}`;
    const blobN = normalizeInsightBlob(blobRaw);
    let best = null;
    let bestLen = 0;
    for (const p of sortedByNameLen) {
      const name = String(p.place_name || "").trim();
      if (name.length < 2) continue;
      const nameN = normalizeInsightBlob(name);
      if (nameN.length < 3 && name.length < 4) continue;
      const hit =
        (nameN.length >= 3 && blobN.includes(nameN)) || blobRaw.includes(name);
      if (hit && name.length > bestLen) {
        best = p;
        bestLen = name.length;
      }
    }
    if (best) {
      const id = String(best.id);
      postsByPlaceId.get(id).push(review);
    }
  }

  const externalIds = [];
  for (const p of places) {
    const posts = postsByPlaceId.get(String(p.id)) || [];
    if (posts.length === 0) continue;
    const key = stableExternalPlaceId(p);
    if (key) externalIds.push(key);
  }

  const cacheMap = isPlaceBlogCacheEnabled()
    ? await fetchPlaceBlogInsightsBatch(externalIds)
    : new Map();

  const placeMeta = new Map();
  let blogInsightCacheHits = 0;
  for (const p of places) {
    const posts = postsByPlaceId.get(String(p.id)) || [];
    if (posts.length === 0) continue;
    const key = stableExternalPlaceId(p);
    const fp = fingerprintFromPosts(posts);
    const row = key ? cacheMap.get(key) : null;
    const cacheHit = Boolean(
      key &&
        row &&
        String(row.content_fingerprint || "") === fp
    );
    if (cacheHit) blogInsightCacheHits += 1;
    placeMeta.set(String(p.id), { key, posts, fp, cacheHit, row });
  }

  const withPostsForLlm = places
    .map((p) => {
      const m = placeMeta.get(String(p.id));
      if (!m || m.cacheHit) return null;
      const chars = m.posts.reduce(
        (a, x) =>
          a +
          String(x.content || "").length +
          String(x.title || "").length,
        0
      );
      return { p, posts: m.posts, chars };
    })
    .filter(Boolean)
    .sort((a, b) => b.chars - a.chars)
    .slice(0, BLOG_LLM_MAX_PLACES);

  const summaryByPlaceId = new Map();
  if (hasUsableOpenAiKey() && withPostsForLlm.length > 0) {
    await Promise.all(
      withPostsForLlm.map(async ({ p, posts }) => {
        const line = await summarizeBlogsOneLine({
          placeName: p.place_name,
          searchQuery: q0,
          posts,
        });
        if (line) summaryByPlaceId.set(String(p.id), line);
      })
    );
  }

  let blogInsightPlaces = 0;
  let llmSummaryCount = 0;
  const upsertPromises = [];

  const out = places.map((p) => {
    const posts = postsByPlaceId.get(String(p.id)) || [];
    if (posts.length === 0) return { ...p };

    blogInsightPlaces += 1;
    const m = placeMeta.get(String(p.id));
    if (!m) {
      const kw = extractKeywordsFromBlogs(posts);
      const summary = summaryByPlaceId.get(String(p.id)) || null;
      if (summary) llmSummaryCount += 1;
      return {
        ...p,
        blogInsight: {
          atmosphere: kw.atmosphere,
          menu: kw.menu,
          purpose: kw.purpose,
          drink: kw.drink,
          reviewCount: posts.length,
          source: "naver_blog",
          ...(summary ? { summary } : {}),
        },
      };
    }

    if (m.cacheHit) {
      const insight = blogInsightFromCacheRow(m.row, posts.length);
      return { ...p, blogInsight: insight };
    }

    const kw = extractKeywordsFromBlogs(posts);
    const summary = summaryByPlaceId.get(String(p.id)) || null;
    if (summary) llmSummaryCount += 1;

    if (m.key && m.fp) {
      upsertPromises.push(
        upsertPlaceBlogInsight({
          externalPlaceId: m.key,
          placeNameSnapshot: p.place_name,
          reviewCount: posts.length,
          keywords: kw,
          summary,
          contentFingerprint: m.fp,
        })
      );
    }

    return {
      ...p,
      blogInsight: {
        atmosphere: kw.atmosphere,
        menu: kw.menu,
        purpose: kw.purpose,
        drink: kw.drink,
        reviewCount: posts.length,
        source: "naver_blog",
        ...(summary ? { summary } : {}),
      },
    };
  });

  await Promise.all(upsertPromises);

  return {
    places: out,
    blogInsightPlaces,
    llmSummaryCount,
    blogInsightCacheHits,
  };
}

function calculateMatchScore(keywords, userQuery) {
  if (!userQuery) return 0;
  const query = userQuery.toLowerCase();
  let score = 0;
  const allKeywords = [
    ...keywords.atmosphere,
    ...keywords.menu,
    ...keywords.purpose,
    ...keywords.drink,
  ];
  allKeywords.forEach((keyword) => {
    if (query.includes(keyword.toLowerCase())) {
      score += 1;
    }
  });
  if (query.includes("술집") || query.includes("bar") || query.includes("pub")) {
    score += 0.5;
  }
  return score;
}

// ——— 통합 지도 검색: 네이버 지역 + 카카오 키워드 + 블로그 크롤(타임아웃) ———

function normalizeUnifiedPlaceName(name) {
  return String(name || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function kakaoDocToUnifiedPlace(d) {
  return {
    id: String(d.id),
    place_name: d.place_name,
    y: d.y,
    x: d.x,
    category_name: d.category_name || "",
    address_name: d.address_name || "",
    road_address_name: d.road_address_name || "",
    phone: d.phone || "",
    place_url: d.place_url || "",
    source: "kakao",
    kakao_place_id: String(d.id),
  };
}

function naverItemToUnifiedPlace(item, salt) {
  const mx = parseInt(String(item.mapx || "0"), 10);
  const my = parseInt(String(item.mapy || "0"), 10);
  const coords = convertKatechToWGS84(mx, my);
  const name = String(item.title || "").replace(/<[^>]*>/g, "").trim();
  const slug =
    normalizeUnifiedPlaceName(name)
      .slice(0, 24)
      .replace(/[^a-z0-9가-힣]/g, "") || "p";
  return {
    id: `naver_${salt}_${slug}`,
    place_name: name,
    y: String(coords.lat),
    x: String(coords.lng),
    category_name: item.category || "",
    address_name: item.address || "",
    road_address_name: item.roadAddress || item.address || "",
    phone: item.telephone || "",
    place_url: item.link || "",
    source: "naver",
    kakao_place_id: null,
  };
}

async function fetchKakaoPlacesForPhrases(phrases) {
  const key =
    process.env.KAKAO_REST_API_KEY || process.env.VITE_KAKAO_REST_API_KEY;
  if (!key) {
    console.warn(
      "⚠️ unified-map-search: KAKAO_REST_API_KEY(또는 VITE_KAKAO_REST_API_KEY) 없음 — 카카오 후보 생략"
    );
    return [];
  }
  const byId = new Map();
  await Promise.all(
    phrases.map(async (query) => {
      try {
        const { data } = await axios.get(
          "https://dapi.kakao.com/v2/local/search/keyword.json",
          {
            params: { query, size: 12, sort: "accuracy" },
            headers: { Authorization: `KakaoAK ${key}` },
          }
        );
        for (const d of data.documents || []) {
          const id = String(d.id || "");
          if (id && !byId.has(id)) byId.set(id, kakaoDocToUnifiedPlace(d));
        }
      } catch (e) {
        console.warn("unified-map-search kakao:", query, e.message);
      }
    })
  );
  return [...byId.values()];
}

async function fetchNaverPlacesForPhrases(phrases) {
  const arrays = await Promise.all(phrases.map((q) => searchNaverLocal(q)));
  const byName = new Map();
  let salt = 0;
  for (const items of arrays) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const u = naverItemToUnifiedPlace(item, salt++);
      const nk = normalizeUnifiedPlaceName(u.place_name);
      if (!nk) continue;
      if (!byName.has(nk)) byName.set(nk, u);
    }
  }
  return [...byName.values()];
}

function mergeKakaoNaverPlaces(kakaoList, naverList) {
  const kakaoNames = new Set(
    kakaoList.map((p) => normalizeUnifiedPlaceName(p.place_name)).filter(Boolean)
  );
  const extra = naverList.filter(
    (p) => !kakaoNames.has(normalizeUnifiedPlaceName(p.place_name))
  );
  return [...kakaoList, ...extra].slice(0, 80);
}

const UNIFIED_MAP_SEARCH_DEFAULT_BLOG_MS = 14000;

app.post("/api/unified-map-search", async (req, res) => {
  try {
    const {
      query: qRaw,
      searchPhrases,
      includeBlog = true,
      blogTimeoutMs,
    } = req.body ?? {};
    const q0 = typeof qRaw === "string" ? qRaw.trim() : "";
    if (!q0) {
      return res.status(400).json({
        ok: false,
        error: "query가 필요합니다.",
        places: [],
        blogReviews: [],
      });
    }
    let phrases = Array.isArray(searchPhrases)
      ? [...new Set(searchPhrases.map((s) => String(s || "").trim()).filter(Boolean))]
      : [];
    if (phrases.length === 0) phrases = [q0];
    phrases = phrases.slice(0, 10);

    const blogMs = Math.min(
      Math.max(
        Number(blogTimeoutMs) || UNIFIED_MAP_SEARCH_DEFAULT_BLOG_MS,
        4000
      ),
      90000
    );

    const placesPromise = (async () => {
      const [kList, nList] = await Promise.all([
        fetchKakaoPlacesForPhrases(phrases),
        fetchNaverPlacesForPhrases(phrases),
      ]);
      return mergeKakaoNaverPlaces(kList, nList);
    })();

    const blogPromise =
      includeBlog === false
        ? Promise.resolve({ success: false })
        : Promise.race([
            runNaverCrawler(`${q0} 후기`),
            new Promise((resolve) =>
              setTimeout(
                () => resolve({ success: false, error: "blog_timeout" }),
                blogMs
              )
            ),
          ]);

    const [places, crawlerResult] = await Promise.all([
      placesPromise,
      blogPromise,
    ]);

    let blogReviews = [];
    if (crawlerResult.success && Array.isArray(crawlerResult.data)) {
      blogReviews = crawlerResult.data.slice(0, 15);
    }

    const {
      places: placesEnriched,
      blogInsightPlaces,
      llmSummaryCount,
      blogInsightCacheHits,
    } = await enrichPlacesWithBlogInsights(places, blogReviews, q0);

    res.json({
      ok: true,
      places: placesEnriched,
      blogReviews,
      meta: {
        phraseCount: phrases.length,
        placeCount: places.length,
        blogCount: blogReviews.length,
        blogOk: crawlerResult.success === true,
        blogInsightPlaces,
        llmSummaryCount,
        blogInsightCacheHits,
      },
    });
  } catch (error) {
    console.error("unified-map-search:", error);
    res.status(500).json({
      ok: false,
      error: error.message,
      places: [],
      blogReviews: [],
    });
  }
});

/** 검색어 기준 네이버 블로그 크롤만 (프론트 리뷰 패널용, OpenAI/네이버 로컬 생략) */
app.post("/api/blog-reviews", async (req, res) => {
  try {
    const { query: q } = req.body ?? {};
    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(400).json({ error: "query가 비어 있습니다.", blogReviews: [] });
    }
    const queryTrim = q.trim();
    const crawlerResult = await Promise.race([
      runNaverCrawler(`${queryTrim} 후기`),
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ success: false, error: "크롤러 시간 초과" }),
          90000
        )
      ),
    ]);
    if (!crawlerResult.success) {
      return res.json({
        ok: false,
        blogReviews: [],
        blogSummary: crawlerResult.error || "크롤링 실패",
      });
    }
    const list = Array.isArray(crawlerResult.data) ? crawlerResult.data : [];
    res.json({
      ok: true,
      blogReviews: list.slice(0, 15),
      blogSummary:
        list.length > 0
          ? `네이버 블로그 ${list.length}개`
          : "블로그 결과 없음",
    });
  } catch (error) {
    console.error("blog-reviews error:", error);
    res.status(500).json({ error: error.message, blogReviews: [] });
  }
});

app.post("/api/nearby-with-blog", async (req, res) => {
  try {
    const { places, userQuery, location } = req.body ?? {};
    if (!places || !Array.isArray(places) || places.length === 0) {
      return res.status(400).json({ error: "가게 목록이 필요합니다." });
    }
    console.log(`🔍 주변 가게 ${places.length}개 블로그 분석 시작...`);
    console.log(`📝 사용자 검색어: "${userQuery || "주변 술집"}"`);

    const placesWithKeywords = await Promise.all(
      places.slice(0, 20).map(async (place) => {
        try {
          const placeName = place.place_name || place.name;
          const neighborhood =
            place.address_name?.split(" ")?.[1] || location || "";
          const searchQuery = `${neighborhood} ${placeName}`.trim();
          const crawlerResult = await Promise.race([
            runNaverCrawler(searchQuery),
            new Promise((resolve) =>
              setTimeout(
                () => resolve({ success: false, error: "timeout" }),
                45000
              )
            ),
          ]);
          if (crawlerResult.success && crawlerResult.data?.length > 0) {
            const keywords = extractKeywordsFromBlogs(crawlerResult.data);
            return {
              ...place,
              blogKeywords: keywords,
              blogReviewCount: crawlerResult.data.length,
              matchScore: calculateMatchScore(keywords, userQuery),
            };
          }
          return {
            ...place,
            blogKeywords: [],
            blogReviewCount: 0,
            matchScore: 0,
          };
        } catch (error) {
          console.error(
            `❌ ${place.place_name || place.name} 크롤링 실패:`,
            error.message
          );
          return {
            ...place,
            blogKeywords: [],
            blogReviewCount: 0,
            matchScore: 0,
          };
        }
      })
    );

    const MIN_MATCH_SCORE = 1;
    const filteredPlaces = placesWithKeywords
      .filter((place) => place.matchScore >= MIN_MATCH_SCORE)
      .sort((a, b) => b.matchScore - a.matchScore);
    const topPlaces = filteredPlaces.slice(0, 15);

    console.log(`✅ 필터링 완료: ${places.length}개 → ${topPlaces.length}개`);

    res.json({
      success: true,
      totalSearched: places.length,
      filteredCount: topPlaces.length,
      userQuery: userQuery || "주변 술집",
      places: topPlaces,
    });
  } catch (error) {
    console.error("❌ 주변 가게 블로그 분석 API 오류:", error);
    res.status(500).json({
      error: "서버 오류가 발생했습니다.",
      message: error.message,
    });
  }
});

/**
 * 공식 Local API에 detail.json 라우트가 없어 404(not matched)가 남 → keyword 검색 후 id 매칭.
 * body: { placeId, query(장소명), x(경도 WGS84), y(위도) } — x,y 있으면 반경·거리 정렬로 정확도 보강
 */
app.post("/api/kakao/place-details", async (req, res) => {
  try {
    const key = getKakaoRestApiKey();
    if (!key) {
      return res.status(503).json({
        error:
          "카카오 REST 키 없음: KAKAO_REST_API_KEY 또는 VITE_KAKAO_REST_API_KEY를 .env에 설정하세요.",
      });
    }
    const { placeId, query, x, y } = req.body ?? {};
    if (!placeId) {
      return res.status(400).json({ error: "placeId가 필요합니다." });
    }
    const pid = String(placeId).trim();
    const q = typeof query === "string" ? query.trim() : "";
    if (!q) {
      return res.status(400).json({
        error: "장소명 query가 필요합니다.",
        hint: "카카오는 id만으로 상세 조회하는 공개 API가 없어 키워드 검색으로 매칭합니다.",
      });
    }
    const lngNum = parseFloat(x);
    const latNum = parseFloat(y);
    const hasCoords =
      Number.isFinite(latNum) &&
      Number.isFinite(lngNum) &&
      latNum >= 31 &&
      latNum <= 45 &&
      lngNum >= 122 &&
      lngNum <= 136;

    /** 카카오 keyword API: size 최대 15 (초과 시 400) — id 매칭 위해 최대 3페이지까지 조회 */
    const baseParams = {
      query: q.slice(0, 100),
      size: 15,
    };
    if (hasCoords) {
      baseParams.x = String(lngNum);
      baseParams.y = String(latNum);
      baseParams.radius = 3000;
      baseParams.sort = "distance";
    }

    const mergedDocs = [];
    let lastResponse = null;
    for (let page = 1; page <= 3; page++) {
      const response = await axios.get(
        "https://dapi.kakao.com/v2/local/search/keyword.json",
        {
          params: { ...baseParams, page },
          headers: { Authorization: `KakaoAK ${key}` },
          timeout: 12000,
          validateStatus: (s) => s >= 200 && s < 500,
        }
      );
      lastResponse = response;
      if (response.status !== 200) {
        const hint = kakaoDetailHint(response.status, response.data);
        console.error(
          "kakao place-details keyword HTTP",
          response.status,
          page,
          hint || response.data
        );
        return res.status(502).json({
          error: "카카오 키워드 검색 비정상 응답",
          status: response.status,
          kakao: response.data,
          hint: hint || undefined,
        });
      }
      const pageDocs = Array.isArray(response.data?.documents)
        ? response.data.documents
        : [];
      mergedDocs.push(...pageDocs);
      const hit = pageDocs.find((d) => d && String(d.id) === pid);
      if (hit) {
        return res.json({
          documents: [hit],
          meta: response.data?.meta,
        });
      }
      if (response.data?.meta?.is_end || pageDocs.length === 0) break;
    }

    const docs = mergedDocs;
    const byId = docs.find((d) => d && String(d.id) === pid);
    let chosen = byId;
    if (!chosen && hasCoords && docs.length > 0) {
      const sorted = [...docs].sort((a, b) => {
        const ay = parseFloat(a.y);
        const ax = parseFloat(a.x);
        const by_ = parseFloat(b.y);
        const bx = parseFloat(b.x);
        if (
          !Number.isFinite(ay) ||
          !Number.isFinite(ax) ||
          !Number.isFinite(by_) ||
          !Number.isFinite(bx)
        ) {
          return 0;
        }
        const da = haversineKm(latNum, lngNum, ay, ax);
        const db = haversineKm(latNum, lngNum, by_, bx);
        return da - db;
      });
      chosen = sorted[0];
    }

    res.json({
      documents: chosen ? [chosen] : [],
      meta: lastResponse?.data?.meta,
    });
  } catch (error) {
    const st = error.response?.status;
    const body = error.response?.data;
    const hint = kakaoDetailHint(st, body);
    console.error(
      "kakao place-details:",
      st || error.code,
      hint || body || error.message
    );
    res.status(502).json({
      error: "카카오 API 호출 실패",
      status: st,
      kakao: body,
      message: error.message,
      hint: hint || undefined,
    });
  }
});

/** 브라우저 직접 dapi staticmap 호출은 도메인 제한으로 자주 깨짐 → 서버에서 받아 전달 */
function getKakaoJavaScriptKeyForServer() {
  return (
    process.env.KAKAO_JAVASCRIPT_KEY ||
    process.env.VITE_KAKAO_JAVASCRIPT_KEY ||
    ""
  ).trim();
}

app.get("/api/kakao/static-map", async (req, res) => {
  const restKey = getKakaoRestApiKey();
  const jsKey = getKakaoJavaScriptKeyForServer();
  if (!restKey && !jsKey) {
    return res
      .status(503)
      .type("text/plain")
      .send(
        "카카오 키 없음: KAKAO_REST_API_KEY(또는 VITE_KAKAO_REST_API_KEY) 또는 KAKAO_JAVASCRIPT_KEY(VITE_)"
      );
  }
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).type("text/plain").send("lat, lng 필요");
  }
  if (lat < 31 || lat > 45 || lng < 122 || lng > 136) {
    return res.status(400).type("text/plain").send("좌표 범위 초과");
  }
  let w = parseInt(String(req.query.w), 10) || 400;
  let h = parseInt(String(req.query.h), 10) || 400;
  let level = parseInt(String(req.query.level), 10) || 3;
  w = Math.min(800, Math.max(50, w));
  h = Math.min(800, Math.max(50, h));
  level = Math.min(14, Math.max(1, level));
  const center = `${lng},${lat}`;
  const markers = `${lng},${lat}`;
  const url = "https://dapi.kakao.com/v2/maps/staticmap";
  const commonParams = { center, level, w, h, markers };

  const trySend = (buf, ctype) => {
    const len = Buffer.isBuffer(buf)
      ? buf.length
      : buf?.byteLength ?? 0;
    if (len < 80) return false;
    res.setHeader("Content-Type", ctype || "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(buf));
    return true;
  };

  try {
    if (restKey) {
      const r = await axios.get(url, {
        params: commonParams,
        headers: { Authorization: `KakaoAK ${restKey}` },
        responseType: "arraybuffer",
        timeout: 15000,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      if (r.status === 200 && trySend(r.data, r.headers["content-type"])) {
        return;
      }
    }
    if (jsKey) {
      const r = await axios.get(url, {
        params: { ...commonParams, appkey: jsKey },
        responseType: "arraybuffer",
        timeout: 15000,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      if (r.status === 200 && trySend(r.data, r.headers["content-type"])) {
        return;
      }
      console.warn(
        "kakao static-map: js appkey 요청 실패",
        r.status,
        r.headers["content-type"]
      );
    }
    res.status(502).type("text/plain").send("정적 지도를 가져오지 못했습니다");
  } catch (error) {
    console.warn("kakao static-map:", error.message);
    res.status(502).type("text/plain").send("정적 지도 오류");
  }
});

app.post("/api/kakao/search", async (req, res) => {
  try {
    const key = getKakaoRestApiKey();
    if (!key) {
      return res.status(503).json({
        error:
          "카카오 REST 키 없음: KAKAO_REST_API_KEY 또는 VITE_KAKAO_REST_API_KEY를 .env에 설정하세요.",
      });
    }
    const { query: kw, x, y, radius, size } = req.body ?? {};
    if (!kw) {
      return res.status(400).json({ error: "query가 필요합니다." });
    }
    const params = {
      query: kw,
      size: Number(size) > 0 ? Math.min(Number(size), 15) : 15,
    };
    const nx = x != null ? Number(x) : NaN;
    const ny = y != null ? Number(y) : NaN;
    if (Number.isFinite(nx) && Number.isFinite(ny)) {
      params.x = nx;
      params.y = ny;
      const r = radius != null ? Number(radius) : 500;
      if (Number.isFinite(r) && r > 0) {
        params.radius = Math.min(r, 20000);
      }
    }
    const response = await axios.get(
      "https://dapi.kakao.com/v2/local/search/keyword.json",
      {
        params,
        headers: { Authorization: `KakaoAK ${key}` },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("kakao search:", error.message);
    res.status(500).json({ error: "카카오 검색 API 호출 실패" });
  }
});

/** Google Places API (New) — 장소명·좌표로 사진 후보 (API 키·과금 필요) */
function isValidGooglePhotoResourceName(name) {
  if (typeof name !== "string" || name.includes("..")) return false;
  if (!name.startsWith("places/") || !name.includes("/photos/")) return false;
  const segs = name.split("/");
  return segs.length >= 4 && segs[0] === "places" && segs[2] === "photos";
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Text Search(New)만으로는 photos가 비는 경우가 많아 Place Details(New)로 보강 */
async function fetchGooglePlacePhotosForDetail(key, chosen) {
  const name =
    typeof chosen?.name === "string" && chosen.name.startsWith("places/")
      ? chosen.name
      : typeof chosen?.id === "string" && chosen.id
        ? `places/${chosen.id}`
        : null;
  if (!name) return [];
  const placeId = name.replace(/^places\//, "");
  const { data } = await axios.get(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "photos",
      },
      timeout: 12000,
    }
  );
  return Array.isArray(data?.photos) ? data.photos : [];
}

/** 상위 후보 여러 곳을 보며 사진이 있는 첫 장소를 모음 (첫 결과만 보면 빈 경우가 많음) */
async function collectGooglePhotoUrlsFromSearchResults(key, places, maxPlaces) {
  const cap = Math.min(
    Math.max(1, maxPlaces),
    Array.isArray(places) ? places.length : 0
  );
  const mergedUrls = [];
  const attributions = new Set();
  const seenPhoto = new Set();
  for (let pi = 0; pi < cap && mergedUrls.length < 4; pi++) {
    const p = places[pi];
    let photos = Array.isArray(p?.photos) ? p.photos : [];
    if (photos.length === 0) {
      try {
        const fromDetail = await fetchGooglePlacePhotosForDetail(key, p);
        if (fromDetail.length > 0) photos = fromDetail;
      } catch (detailErr) {
        console.warn(
          "google-place-photos (detail 보강 실패):",
          detailErr.response?.data || detailErr.message
        );
      }
    }
    for (const ph of photos) {
      const photoName = ph?.name;
      if (!isValidGooglePhotoResourceName(photoName)) continue;
      if (seenPhoto.has(photoName)) continue;
      seenPhoto.add(photoName);
      mergedUrls.push(
        `/api/google-place-photo-media?photoName=${encodeURIComponent(photoName)}`
      );
      const aa = ph.authorAttributions;
      if (Array.isArray(aa)) {
        for (const a of aa) {
          if (a?.displayName) attributions.add(String(a.displayName));
        }
      }
      if (mergedUrls.length >= 4) break;
    }
  }
  return { imageUrls: mergedUrls, attributions: [...attributions] };
}

/** 키에 Places(New)만 없고 구 Places API만 열려 있을 때 SERVICE_BLOCKED → 레거시 textsearch+photo */
async function fetchGooglePlacePhotosLegacy(key, textQuery, lat, lng, hasCoords) {
  const params = { query: textQuery, key };
  if (hasCoords) {
    params.location = `${lat},${lng}`;
    params.radius = 2000;
  }
  const { data } = await axios.get(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    { params, timeout: 12000 }
  );
  const st = data?.status;
  if (st === "REQUEST_DENIED" || st === "INVALID_REQUEST") {
    throw new Error(data?.error_message || st || "legacy textsearch 거절");
  }
  if (st !== "OK" && st !== "ZERO_RESULTS") {
    throw new Error(data?.error_message || st || "legacy textsearch 실패");
  }
  let results = Array.isArray(data.results) ? data.results : [];
  if (hasCoords && results.length > 1) {
    results = [...results].sort((a, b) => {
      const alat = a.geometry?.location?.lat;
      const alng = a.geometry?.location?.lng;
      const blat = b.geometry?.location?.lat;
      const blng = b.geometry?.location?.lng;
      if (
        !Number.isFinite(alat) ||
        !Number.isFinite(alng) ||
        !Number.isFinite(blat) ||
        !Number.isFinite(blng)
      ) {
        return 0;
      }
      return (
        haversineKm(lat, lng, alat, alng) - haversineKm(lat, lng, blat, blng)
      );
    });
  }
  const imageUrls = [];
  const attributionSet = new Set();
  for (const r of results) {
    for (const ph of r.photos || []) {
      const ref = ph.photo_reference;
      if (typeof ref === "string" && ref.trim() && imageUrls.length < 4) {
        imageUrls.push(
          `/api/google-place-photo-legacy?photoReference=${encodeURIComponent(ref.trim())}`
        );
        for (const h of ph.html_attributions || []) {
          const t = String(h).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
          if (t) attributionSet.add(t);
        }
      }
      if (imageUrls.length >= 4) break;
    }
    if (imageUrls.length >= 4) break;
  }
  return { imageUrls, attributions: [...attributionSet] };
}

app.get("/api/google-place-photos", async (req, res) => {
  const key = getGooglePlacesApiKey();
  if (!key) {
    return res.status(503).json({
      ok: false,
      error: "GOOGLE_PLACES_API_KEY 없음",
      imageUrls: [],
      attributions: [],
    });
  }
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  if (!name) {
    return res.status(400).json({
      ok: false,
      error: "name 쿼리 필요",
      imageUrls: [],
      attributions: [],
    });
  }
  const addr =
    typeof req.query.address === "string" ? req.query.address.trim() : "";
  const textQuery =
    addr && addr.length > 0 ? `${name} ${addr.slice(0, 120)}` : name;
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  try {
    const runSearch = async (withBias) => {
      const body = {
        textQuery,
        pageSize: 8,
        regionCode: "KR",
      };
      if (withBias && hasCoords) {
        body.locationBias = {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 2000,
          },
        };
        body.rankPreference = "DISTANCE";
      }
      const { data } = await axios.post(
        "https://places.googleapis.com/v1/places:searchText",
        body,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "places.id,places.name,places.displayName,places.location,places.photos",
          },
          timeout: 12000,
        }
      );
      return Array.isArray(data?.places) ? data.places : [];
    };

    let places = await runSearch(true);
    if (places.length === 0 && hasCoords) {
      places = await runSearch(false);
    }

    if (places.length === 0) {
      return res.json({ ok: true, imageUrls: [], attributions: [] });
    }

    if (hasCoords && places.length > 1) {
      places = [...places].sort((a, b) => {
        const alat = a.location?.latitude;
        const alng = a.location?.longitude;
        const blat = b.location?.latitude;
        const blng = b.location?.longitude;
        if (
          !Number.isFinite(alat) ||
          !Number.isFinite(alng) ||
          !Number.isFinite(blat) ||
          !Number.isFinite(blng)
        ) {
          return 0;
        }
        const da = haversineKm(lat, lng, alat, alng);
        const db = haversineKm(lat, lng, blat, blng);
        return da - db;
      });
    }

    let { imageUrls, attributions } = await collectGooglePhotoUrlsFromSearchResults(
      key,
      places,
      6
    );

    if (imageUrls.length === 0 && hasCoords) {
      const wide = await runSearch(false);
      if (wide.length > 0) {
        const second = await collectGooglePhotoUrlsFromSearchResults(
          key,
          wide,
          6
        );
        if (second.imageUrls.length > 0) {
          imageUrls = second.imageUrls;
          attributions = second.attributions;
        }
      }
    }

    res.json({
      ok: true,
      imageUrls,
      attributions,
      source: "google_places",
    });
  } catch (error) {
    const st = error.response?.status;
    const ge = error.response?.data;
    if (isApiKeyServiceBlocked(ge)) {
      try {
        const leg = await fetchGooglePlacePhotosLegacy(
          key,
          textQuery,
          lat,
          lng,
          hasCoords
        );
        if (leg.imageUrls.length > 0) {
          console.warn(
            "google-place-photos: Places(New) SERVICE_BLOCKED → 레거시 Places 사진 사용"
          );
          return res.json({
            ok: true,
            imageUrls: leg.imageUrls,
            attributions: leg.attributions,
            source: "google_places_legacy",
            hint:
              "키에 Places API (New)가 없어 레거시 Places로 조회했습니다. 가능하면 콘솔에서 Places API (New)를 키 제한·라이브러리에 추가하세요.",
          });
        }
      } catch (legErr) {
        console.warn("google-place-photos legacy 폴백 실패:", legErr.message);
      }
    }
    const hint = googlePlacesBackendHint(st, ge);
    console.warn(
      "google-place-photos:",
      st || "",
      hint || ge || error.message
    );
    res.status(200).json({
      ok: false,
      error: error.message,
      googleApiError: ge && typeof ge === "object" ? ge : undefined,
      googleHttpStatus: st,
      hint: hint || undefined,
      imageUrls: [],
      attributions: [],
    });
  }
});

app.get("/api/google-place-photo-legacy", async (req, res) => {
  const key = getGooglePlacesApiKey();
  if (!key) {
    return res.status(503).send("GOOGLE_PLACES_API_KEY 없음");
  }
  const photoReference =
    typeof req.query.photoReference === "string"
      ? req.query.photoReference.trim()
      : "";
  if (!photoReference || photoReference.length > 512) {
    return res.status(400).send("잘못된 photoReference");
  }
  try {
    const { data, headers, status } = await axios.get(
      "https://maps.googleapis.com/maps/api/place/photo",
      {
        params: {
          maxwidth: 960,
          photo_reference: photoReference,
          key,
        },
        responseType: "arraybuffer",
        maxRedirects: 8,
        timeout: 20000,
        validateStatus: () => true,
      }
    );
    if (status < 200 || status >= 400) {
      const snippet =
        typeof data === "object" && data != null && "byteLength" in data
          ? Buffer.from(data).toString("utf8").slice(0, 200)
          : String(data).slice(0, 200);
      console.warn("google-place-photo-legacy HTTP", status, snippet);
      return res.status(502).type("text/plain").send("이미지 로드 실패");
    }
    const len = Buffer.isBuffer(data) ? data.length : data?.byteLength ?? 0;
    if (len < 80) {
      console.warn("google-place-photo-legacy: 응답 너무 짧음", len);
      return res.status(502).type("text/plain").send("이미지 로드 실패");
    }
    const ctype = headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", ctype);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(data));
  } catch (error) {
    console.warn("google-place-photo-legacy:", error.message);
    res.status(502).send("이미지 로드 실패");
  }
});

app.get("/api/google-place-photo-media", async (req, res) => {
  const key = getGooglePlacesApiKey();
  if (!key) {
    return res.status(503).send("GOOGLE_PLACES_API_KEY 없음");
  }
  const photoName =
    typeof req.query.photoName === "string" ? req.query.photoName.trim() : "";
  if (!isValidGooglePhotoResourceName(photoName)) {
    return res.status(400).send("잘못된 photoName");
  }
  try {
    const pathEnc = photoName
      .split("/")
      .map((s) => encodeURIComponent(s))
      .join("/");
    const url = `https://places.googleapis.com/v1/${pathEnc}/media`;
    const { data, headers, status } = await axios.get(url, {
      params: { maxWidthPx: 960, maxHeightPx: 960, skipHttpRedirect: false },
      headers: { "X-Goog-Api-Key": key },
      responseType: "arraybuffer",
      maxRedirects: 8,
      timeout: 20000,
      validateStatus: () => true,
    });
    if (status < 200 || status >= 400) {
      const snippet =
        typeof data === "object" && data != null && "byteLength" in data
          ? Buffer.from(data).toString("utf8").slice(0, 200)
          : String(data).slice(0, 200);
      const hint = googlePlacesBackendHint(status, null);
      console.warn(
        "google-place-photo-media HTTP",
        status,
        hint || snippet
      );
      return res.status(502).type("text/plain").send("이미지 로드 실패");
    }
    const len =
      Buffer.isBuffer(data) ? data.length : data?.byteLength ?? 0;
    if (len < 80) {
      console.warn("google-place-photo-media: 응답 너무 짧음", len);
      return res.status(502).type("text/plain").send("이미지 로드 실패");
    }
    const ctype = headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", ctype);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(data));
  } catch (error) {
    console.warn("google-place-photo-media:", error.message);
    res.status(502).send("이미지 로드 실패");
  }
});

app.listen(port, () => {
  console.log(`AI server running on http://localhost:${port}`);
});
