import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 사용
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// 네이버 블로그 크롤러 실행 함수 (개선된 버전)
async function runNaverCrawler(query) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 네이버 블로그 크롤링 시작: ${query}`);
    
    // Python 스크립트 경로
    const crawlerPath = path.join(__dirname, '..', 'naver_blog_crawler_standalone.py');
    
    // Python 스크립트가 있는지 확인
    if (!fs.existsSync(crawlerPath)) {
      console.error(`❌ 크롤러 파일을 찾을 수 없음: ${crawlerPath}`);
      resolve({
        success: false,
        error: '크롤러 파일을 찾을 수 없습니다.'
      });
      return;
    }
    
    // Python 실행 (맥북 환경 고려)
    const pythonProcess = spawn('python3', [crawlerPath, query, '2'], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8'
      }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('📝 크롤러 출력:', data.toString().trim());
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('❌ 크롤러 오류:', data.toString().trim());
    });

    // 타임아웃 설정 (30초)
    const timeout = setTimeout(() => {
      pythonProcess.kill();
      resolve({
        success: false,
        error: '크롤러 실행 시간 초과'
      });
    }, 30000);

    pythonProcess.on('close', async (code) => {
      clearTimeout(timeout);
      
      console.log(`🔍 크롤러 종료 (code: ${code})`);
      console.log(`📝 stdout: ${stdout.length} chars`);
      console.log(`❌ stderr: ${stderr.length} chars`);
      
      if (code === 0) {
        try {
          // results 폴더에서 최신 JSON 파일 찾기
          const resultsDir = path.join(__dirname, '..', 'results');
          
          if (!fs.existsSync(resultsDir)) {
            console.error('❌ results 폴더가 없습니다');
            resolve({
              success: false,
              error: 'results 폴더를 찾을 수 없습니다.'
            });
            return;
          }
          
          const files = fs.readdirSync(resultsDir)
            .filter(file => file.endsWith('.json'))
            .map(file => ({
              name: file,
              path: path.join(resultsDir, file),
              mtime: fs.statSync(path.join(resultsDir, file)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);

          if (files.length > 0) {
            const latestFile = files[0];
            console.log(`📁 최신 파일: ${latestFile.name}`);
            
            const blogData = JSON.parse(fs.readFileSync(latestFile.path, 'utf8'));
            
            console.log(`✅ 네이버 블로그 크롤링 완료: ${blogData.length}개 리뷰`);
            
            // 간단한 리뷰 정보 출력
            blogData.slice(0, 3).forEach((review, index) => {
              console.log(`📝 ${index + 1}. ${review.place_name} - ${review.content?.substring(0, 50) || '내용 없음'}...`);
            });
            
            resolve({
              success: true,
              data: blogData,
              file: latestFile.name
            });
          } else {
            console.error('❌ 결과 파일을 찾을 수 없습니다');
            resolve({
              success: false,
              error: '크롤링 결과 파일을 찾을 수 없습니다.'
            });
          }
        } catch (error) {
          console.error('❌ 크롤링 결과 파싱 오류:', error);
          resolve({
            success: false,
            error: `크롤링 결과 파싱 실패: ${error.message}`
          });
        }
      } else {
        console.error(`❌ 크롤러 실행 오류 (code: ${code}):`, stderr);
        resolve({
          success: false,
          error: `크롤러 실행 실패: ${stderr || '알 수 없는 오류'}`
        });
      }
    });

    pythonProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error('❌ 크롤러 프로세스 오류:', error);
      reject(error);
    });
  });
}

// 크롤러 테스트 엔드포인트
app.get("/api/test-crawler", async (req, res) => {
  try {
    const { query = "을지로 술집" } = req.query;
    
    console.log(`🧪 크롤러 테스트 시작: ${query}`);
    
    const result = await runNaverCrawler(query);
    
    res.json({
      success: true,
      message: "크롤러 테스트 완료",
      result
    });
    
  } catch (error) {
    console.error('❌ 크롤러 테스트 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ 
    ok: true,
    timestamp: new Date().toISOString(),
    crawler: 'ready'
  });
});

app.post("/api/ai-search", async (req, res) => {
  try {
    const { query, places } = req.body ?? {};

    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "query가 비어 있습니다." });
    }

    if (!Array.isArray(places) || places.length === 0) {
      return res.status(400).json({ error: "places가 비어 있습니다." });
    }

    const compactPlaces = compactPlacesForAI(places);
    console.log(`🔍 AI 검색 시작: ${query} (${compactPlaces.length}개 장소)`);

    // 1. 네이버 블로그 크롤링 실행 (병렬 처리)
    console.log(`🔍 네이버 블로그 크롤링 시작: ${query} 후기`);
    
    let blogReviews = [];
    let blogSummary = "";
    let crawlerSuccess = false;
    
    try {
      const crawlerResult = await Promise.race([
        runNaverCrawler(query + " 후기"),
        new Promise(resolve => setTimeout(() => resolve({ success: false, error: '타임아웃' }), 25000)
      ]);
      
      if (crawlerResult.success) {
        blogReviews = crawlerResult.data;
        blogSummary = `네이버 블로그에서 ${blogReviews.length}개의 실제 리뷰를 찾았습니다.`;
        crawlerSuccess = true;
        
        // 블로그 리뷰에서 장소 이름 추출
        const blogPlaces = blogReviews
          .filter(review => review.place_name && review.place_name !== "장소명 미확인")
          .map(review => review.place_name);
        
        console.log(`📝 발견된 장소: ${blogPlaces.join(", ")}`);
      } else {
        console.log(`⚠️ 블로그 크롤링 실패: ${crawlerResult.error}`);
        blogSummary = "블로그 리뷰를 불러오지 못했지만, 기존 데이터로 추천해드릴게요.";
      }
    } catch (error) {
      console.error(`❌ 블로그 크롤링 중 오류:`, error);
      blogSummary = "블로그 리뷰를 불러오지 못했지만, 기존 데이터로 추천해드릴게요.";
    }

    // 2. AI 검색 실행 (블로그 리뷰 정보 포함)
    const systemPrompt = crawlerSuccess ? 
      `너는 한국 술집 추천 큐레이터다. 사용자 검색어와 관련된 네이버 블로그 실제 리뷰 정보를 제공받았다.
      
실제 블로그 리뷰 데이터:
${JSON.stringify(blogReviews.slice(0, 3), null, 2)}

이 실제 리뷰를 참고해서 제공된 장소 목록 안에서 가장 적합한 곳을 추천해라.
블로그에서 언급된 장소나 비슷한 분위기의 장소가 목록에 있다면 우선적으로 고려해라.
반드시 제공된 장소 목록 안에서만 추천해야 한다.` :
      "너는 한국 술집 추천 큐레이터다.";

    console.log(`🤖 AI 모델 호출 시작...`);
    
    const response = await openai.responses.create({
      model: "gpt-4o-mini",  // 더 빠른 모델 사용
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt +
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
                `블로그 리뷰 요약:\n${blogSummary}\n\n` +
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
    console.log(`🤖 AI 응답 수신 완료`);

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

    // 3. 블로그 리뷰 정보 추가
    const finalSummary = crawlerSuccess ? 
      `${parsed.summary} (네이버 블로그 ${blogReviews.length}개 리뷰 기반)` :
      parsed.summary;

    console.log(`✅ AI 검색 완료: ${recommendedPlaceIds.length}개 추천, ${blogReviews.length}개 블로그 리뷰`);

    res.json({
      summary: finalSummary,
      recommendedPlaceIds,
      reasons,
      blogReviews: blogReviews.slice(0, 10), // 최대 10개 리뷰 전달
      blogSummary,
      crawlerSuccess
    });
  } catch (error) {
    console.error("❌ AI search error:", error);

    const message =
      error?.message ||
      error?.error?.message ||
      "AI 검색 중 오류가 발생했습니다.";

    res.status(500).json({
      error: message,
    });
  }
});

// 서버 시작
app.listen(port, () => {
  console.log(`🚀 AI server with crawler running on http://localhost:${port}`);
  console.log(`📝 크롤러 통합 버전 - 맥북 최적화`);
  console.log(`🧪 테스트: http://localhost:${port}/api/test-crawler?query=을지로`);
  console.log(`💚 헬스체크: http://localhost:${port}/api/health`);
});
