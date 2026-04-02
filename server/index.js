import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import axios from "axios";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY가 없습니다. server/.env 확인");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function compactPlacesForAI(places = []) {
  return places.slice(0, 150).map((place) => ({
    id: String(place.id),
    name: place.name || "",
    region: place.region || "",
    address: place.address || "",
    primaryCurator: place.primaryCurator || "",
    curators: Array.isArray(place.curators) ? place.curators : [],
    tags: Array.isArray(place.tags) ? place.tags : [],
    comment: place.comment || "",
    savedCount: Number(place.savedCount || 0),
    aiText:
      place.aiText ||
      [
        place.name,
        place.region,
        place.address,
        place.primaryCurator,
        ...(Array.isArray(place.curators) ? place.curators : []),
        ...(Array.isArray(place.tags) ? place.tags : []),
        place.comment,
        place.savedCount ? `저장 ${place.savedCount}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
  }));
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
        mapx: '320000',
        mapy: '530000',
        category: '와인바',
        telephone: '02-5678-1234'
      }
    );
  }
  
  // 기본 샘플 데이터
  if (sampleData.length === 0) {
    sampleData.push(
      {
        title: '서울 와인바 비노테카',
        address: '서울 종로구 삼청동 101',
        mapx: '319600',
        mapy: '530100',
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
  // 1 KATECH 단위 ≈ 0.0001도 (약 11m)
  const SCALE = 0.0001;
  
  const deltaX = mapx - SEOUL_CENTER_X;
  const deltaY = mapy - SEOUL_CENTER_Y;
  
  const lat = SEOUL_LAT + (deltaY * SCALE);
  const lng = SEOUL_LNG + (deltaX * SCALE);
  
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

    // 네이버 API로 외부 데이터 검색
    console.log("🔍 네이버 API 검색 시작:", query);
    const naverResults = await searchNaverLocal(query);
    console.log("✅ 네이버 API 검색 결과:", naverResults.length, "개");
    
    // 네이버 결과를 장소 데이터로 변환
    const naverPlaces = convertNaverToPlaceData(naverResults, query);
    
    // 외부 데이터가 있으면 외부 데이터만 사용
    const finalPlaces = naverPlaces.length > 0 ? naverPlaces : places;
    
    if (!Array.isArray(finalPlaces) || finalPlaces.length === 0) {
      return res.status(400).json({ error: "검색 결과가 없습니다." });
    }

    const compactPlaces = compactPlacesForAI(finalPlaces);

    const response = await openai.responses.create({
      model: "gpt-5.4",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "너는 한국 술집 추천 큐레이터다. " +
                "반드시 제공된 장소 목록 안에서만 추천해야 한다. " +
                "없는 장소를 만들어내지 말고, 정보가 부족하면 보수적으로 판단해라. " +
                "사용자 요청에서 지역, 술 종류, 분위기, 상황(1차/2차/데이트/회식/혼술), 취향을 해석해 가장 잘 맞는 장소를 최대 5개 고른다. " +
                "tags, comment, curators, savedCount, aiText를 적극 활용해라. " +
                "savedCount가 높다고 무조건 우선하지 말고, 요청 적합성을 더 우선하되 동점이면 savedCount가 높은 곳을 선호해라. " +
                "comment에 적힌 문맥을 중요하게 보아라. 예: 소주 한잔, 분위기 좋은, 심야, 안주가 탄탄 같은 표현을 해석해라. " +
                "추천 이유는 짧지만 구체적으로 써라. 예: 을지로에서 노포·소주·2차 조건에 가장 잘 맞음 같은 식으로."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `사용자 검색어:\n${query}\n\n` +
                `후보 장소 목록(JSON):\n${JSON.stringify(compactPlaces)}\n\n` +
                `규칙:\n` +
                `- recommendedPlaceIds는 반드시 위 목록의 id만 사용\n` +
                `- 최대 5개 추천\n` +
                `- 요청과 잘 맞는 순서대로 정렬\n` +
                `- reasons에는 각 장소를 왜 골랐는지 사용자 검색어 기준으로 설명`
            }
          ]
        }
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
                type: "string"
              },
              recommendedPlaceIds: {
                type: "array",
                items: { type: "string" }
              },
              reasons: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    placeId: { type: "string" },
                    reason: { type: "string" }
                  },
                  required: ["placeId", "reason"]
                }
              }
            },
            required: ["summary", "recommendedPlaceIds", "reasons"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.output_text);

    const validIdSet = new Set(compactPlaces.map((p) => String(p.id)));

    let recommendedPlaceIds = Array.isArray(parsed.recommendedPlaceIds)
      ? parsed.recommendedPlaceIds
          .map((id) => String(id))
          .filter((id) => validIdSet.has(id))
          .slice(0, 5)
      : [];

    let reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons
          .map((item) => ({
            placeId: String(item.placeId),
            reason: String(item.reason || ""),
          }))
          .filter((item) => validIdSet.has(item.placeId))
      : [];

    if (recommendedPlaceIds.length === 0) {
      const fallback = [...compactPlaces]
        .sort((a, b) => b.savedCount - a.savedCount)
        .slice(0, 5);

      recommendedPlaceIds = fallback.map((item) => item.id);
      reasons = fallback.map((item) => ({
        placeId: item.id,
        reason: "AI가 완벽히 일치하는 결과를 좁히지 못해 인기 높은 후보로 보완했어요.",
      }));
    }

    res.json({
      summary:
        parsed.summary ||
        "요청 조건에 맞는 후보를 네이버 검색 결과에서 골라봤어요.",
      recommendedPlaceIds,
      reasons,
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