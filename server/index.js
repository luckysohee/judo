import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// 환경 변수 로깅
console.log('🔍 환경 변수 확인:');
console.log('🔍 __dirname:', __dirname);
console.log('🔍 env path:', path.join(__dirname, '.env'));
console.log('🔍 NAVER_CLIENT_ID:', process.env.NAVER_CLIENT_ID ? '설정됨' : '설정안됨');
console.log('🔍 NAVER_CLIENT_SECRET:', process.env.NAVER_CLIENT_SECRET ? '설정됨' : '설정안됨');

import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import OpenAI from "openai";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

const port = process.env.PORT || 4000;

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // 실제 키 필요
});

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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
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
  
  console.log(`좌표 변환: KATECH(${mapx}, ${mapy}) → WGS84(${boundedLat}, ${boundedLng})`);
  
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
    
    // 지역명 + 술 종류 조합으로 단순화
    if (simplifiedQuery.includes('술집') || simplifiedQuery.includes('바') || simplifiedQuery.includes('와인')) {
      // 이미 좋은 검색어
    } else {
      // 기본 검색어 추가
      simplifiedQuery += ' 술집';
    }
    
    console.log(`🗺️ 단순화된 쿼리: ${simplifiedQuery}`);
    
    const naverPlaces = await naverMapAPI.searchPlaces(simplifiedQuery);
    console.log(`📍 네이버 지도 검색 결과: ${naverPlaces.length}개 장소`);

    // 3. AI 추천 생성 (내부 데이터 + 네이버 장소 통합)
    console.log(`🤖 AI 추천 생성 시작...`);
    
    // 네이버 장소를 internal 데이터 형식으로 변환하여 AI 추천에 포함
    const naverPlacesForAI = naverPlaces.map((place, index) => ({
      id: `naver_${index}`, // 고유 ID 생성
      name: place.title,
      address: place.address,
      region: place.address,
      primaryCurator: "네이버 지도",
      curators: ["네이버 지도"],
      tags: place.category ? [place.category] : [],
      comment: place.description || "",
      savedCount: 0,
      aiText: [
        place.title,
        place.address,
        "네이버 지도",
        place.category || "",
        place.description || "",
      ].filter(Boolean).join(" | "),
    }));
    
    // 내부 데이터와 네이버 장소 통합
    const allPlacesForAI = [...compactPlaces, ...naverPlacesForAI];
    
    console.log(`📊 AI 추천용 데이터: 내부 ${compactPlaces.length}개 + 네이버 ${naverPlaces.length}개 = 총 ${allPlacesForAI.length}개`);

    // 4. AI 검색 실행 (블로그 리뷰 + 네이버 지도 정보)
    const systemPrompt = blogReviews.length > 0
      ? `너는 한국 술집 추천 큐레이터다. 사용자 검색어와 관련된 네이버 블로그 실제 리뷰 정보를 제공받았다.

실제 블로그 리뷰 데이터:
${JSON.stringify(blogReviews.slice(0, 5), null, 2)}

블로그 리뷰에 언급된 장소와 네이버 지도 검색된 장소를 모두 고려하여 추천해라. 네이버 지도에서 검색된 최신 장소 정보를 우선적으로 고려하되, 블로그 리뷰에 실제로 언급된 장소가 있다면 가중치를 높여 추천해라.
추천 형식: 상호명 - 추천이유 (한줄)`
      : "너는 한국 술집 추천 큐레이터다. 네이버 지도에서 검색된 최신 장소 정보를 우선적으로 고려하여 추천해라. 추천 형식: 상호명 - 추천이유 (한줄)";
    // 네이버 API로 외부 데이터 검색
    console.log("🔍 네이버 API 검색 시작:", query);
    const naverResults = await searchNaverLocal(query);
    console.log("✅ 네이버 API 검색 결과:", naverResults.length, "개");
    
    // 네이버 결과를 장소 데이터로 변환
    const convertedNaverPlaces = convertNaverToPlaceData(naverResults, query);
    
    // 외부 데이터가 있으면 외부 데이터만 사용
    const finalPlaces = convertedNaverPlaces.length > 0 ? convertedNaverPlaces : places;
    
    if (!Array.isArray(finalPlaces) || finalPlaces.length === 0) {
      return res.status(400).json({ error: "검색 결과가 없습니다." });
    }

    const compactPlacesForOpenAI = compactPlacesForAI(finalPlaces);

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
                "추천 이유는 짧지만 구체적으로 써라. 예: 을지로에서 노포·소주·2차 조건에 가장 잘 맞음 같은 식으로.",
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
      summary: finalSummary,
      summary:
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

app.listen(port, () => {
  console.log(`AI server running on http://localhost:${port}`);
});
