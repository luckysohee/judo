const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const port = 4000;

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 네이버 API 모듈 임포트
const naverAPI = require('./naver_api');

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
    
    const pythonProcess = spawn("python", [
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

    // 2. AI 검색 실행 (블로그 리뷰 정보 포함)
    const systemPrompt = blogReviews.length > 0
      ? `너는 한국 술집 추천 큐레이터다. 사용자 검색어와 관련된 네이버 블로그 실제 리뷰 정보를 제공받았다.

실제 블로그 리뷰 데이터:
${JSON.stringify(blogReviews.slice(0, 5), null, 2)}

이 실제 리뷰를 참고해서 제공된 장소 목록에서 가장 적합한 곳을 추천해라.
추천 형식: 상호명 - 추천이유 (한줄)`
      : "너는 한국 술집 추천 큐레이터다. 추천 형식: 상호명 - 추천이유 (한줄)";

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
                `후보 장소 목록(JSON):\n${JSON.stringify(compactPlaces)}\n\n` +
                `규칙:\n` +
                `- recommendedPlaceIds는 반드시 위 목록의 id만 사용\n` +
                `- 최대 5개 추천\n` +
                `- 요청과 잘 맞는 순서대로 정렬\n` +
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
    const finalSummary = blogReviews.length > 0
      ? `${parsed.summary} (네이버 블로그 ${blogReviews.length}개 리뷰 기반)`
      : parsed.summary;

    res.json({
      summary: finalSummary,
      recommendedPlaceIds,
      reasons,
      blogReviews: blogReviews.slice(0, 10), // 최대 10개 리뷰 전달
      blogSummary,
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
