/**
 * 로컬 API 서버 프록시로 카카오 장소 상세 조회 테스트 (키는 server/.env 에만).
 * 사용: npm run dev 후 `node scripts/dev-api/test_kakao_proxy.mjs`
 */
const API_BASE = (process.env.API_BASE || "http://127.0.0.1:4000").replace(/\/$/, "");
const testPlaceId = process.argv[2] || "8725439";

const res = await fetch(`${API_BASE}/api/kakao/place-details`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ placeId: testPlaceId }),
});

const data = await res.json().catch(() => ({}));
console.log("HTTP", res.status);
console.log(JSON.stringify(data, null, 2));

if (!res.ok) process.exit(1);
