// 코스 동네 오염 자동 감사 — 실제 DB + 실제 필터(resolveCourseAreaPool)로 점검.
// 각 동네 bbox(3.2km)를 가져와 실제 코스 필터를 돌린 뒤, 센터에서 먼데
// 살아남은 장소(=오염 의심)를 거리순으로 표시한다.
//
// 실행: node --env-file=.env scripts/audit-course-areas.mjs
//   특정 동네만:  node --env-file=.env scripts/audit-course-areas.mjs 종로 을지로
import { createClient } from "@supabase/supabase-js";
import { resolveCourseAreaPool } from "../src/utils/generateCourseOptions.js";
import { getRegionCenterCoords } from "../src/utils/searchParser.js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_KEY 환경변수 필요");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

// 센터 좌표가 정의된 코스 동네 (getRegionCenterCoords 가 값을 주는 것만 점검)
const ALL_AREAS = [
  "이태원", "홍대", "성수", "을지로", "강남", "압구정",
  "종로", "명동", "신촌", "문정", "잠실", "서초",
];

const BBOX_KM = 3.2; // fetchCoursePlacesForNamedArea 와 동일
const FLAG_KM = 2.5; // 이보다 먼데 살아남으면 오염 의심으로 표시

function distKm(c, lat, lng) {
  const R = 6371;
  const dLat = ((lat - c.lat) * Math.PI) / 180;
  const dLng = ((lng - c.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((c.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function guOf(addr) {
  const s = String(addr || "");
  // "서울특별시 강남구", "서울 종로구 …" 등에서 N구 추출 (한글 \b 미지원 회피)
  const m = s.match(/서울(?:특별시)?\s*([가-힣]{1,4}구)/) || s.match(/([가-힣]{1,4}구)(?=\s|\d|$)/);
  return m ? m[1] : "구미상";
}

async function fetchBbox(center) {
  const latD = BBOX_KM / 111;
  const lngD = BBOX_KM / (111 * Math.cos((center.lat * Math.PI) / 180));
  const bb = {
    south: center.lat - latD,
    north: center.lat + latD,
    west: center.lng - lngD,
    east: center.lng + lngD,
  };
  const res = await sb
    .from("places")
    .select("id,name,lat,lng,address")
    .gte("lat", bb.south).lte("lat", bb.north)
    .gte("lng", bb.west).lte("lng", bb.east)
    .limit(1000);
  return res.data || [];
}

async function curatorCounts(placeIds) {
  const cnt = new Map();
  for (let i = 0; i < placeIds.length; i += 200) {
    const r = await sb
      .from("curator_places")
      .select("place_id")
      .in("place_id", placeIds.slice(i, i + 200))
      .eq("is_archived", false);
    for (const cp of r.data || []) {
      const pid = String(cp.place_id);
      cnt.set(pid, (cnt.get(pid) || 0) + 1);
    }
  }
  return cnt;
}

const argv = process.argv.slice(2);
const areas = argv.length ? argv : ALL_AREAS;

let totalFlags = 0;
for (const area of areas) {
  const center = getRegionCenterCoords(area);
  if (!center) {
    console.log(`\n### ${area} — 센터 좌표 없음, 건너뜀`);
    continue;
  }
  const places = await fetchBbox(center);
  const cnt = await curatorCounts(places.map((p) => String(p.id)));

  // 실제 앱과 동일한 필터
  const { areaPlaces } = resolveCourseAreaPool(places, {
    area,
    raw: `${area} 데이트 코스`,
  });

  const survivors = areaPlaces
    .filter((p) => Number.isFinite(+p.lat) && Number.isFinite(+p.lng))
    .map((p) => ({
      name: p.name,
      address: p.address || "",
      d: distKm(center, +p.lat, +p.lng),
      pick: cnt.get(String(p.id)) || 0,
      gu: guOf(p.address),
    }));

  // 홈 구(區): 코어 1km 안 생존 장소의 구 = 이 동네의 정상 구로 간주
  const homeGu = new Map();
  for (const s of survivors) {
    if (s.d <= 1.0 && s.gu !== "구미상") {
      homeGu.set(s.gu, (homeGu.get(s.gu) || 0) + 1);
    }
  }
  const homeSet = new Set(homeGu.keys());

  // 의심 = 다른 구(타지역) 이거나, 같은 구라도 FLAG_KM 초과(먼 외곽)
  const flagged = survivors
    .filter((p) => {
      const foreignGu = p.gu !== "구미상" && homeSet.size > 0 && !homeSet.has(p.gu);
      return foreignGu || p.d > FLAG_KM;
    })
    .map((p) => ({
      ...p,
      foreign: p.gu !== "구미상" && homeSet.size > 0 && !homeSet.has(p.gu),
    }))
    .sort((a, b) => b.d - a.d);

  const guDist = {};
  for (const s of survivors) guDist[s.gu] = (guDist[s.gu] || 0) + 1;
  const guStr = Object.entries(guDist)
    .sort((a, b) => b[1] - a[1])
    .map(([g, n]) => `${g}:${n}`)
    .join("  ");

  const foreignCount = flagged.filter((f) => f.foreign).length;
  console.log(
    `\n### ${area}  (bbox ${places.length} → 통과 ${survivors.length})  홈구[${[...homeSet].join(",") || "?"}]  의심 ${flagged.length}(타지역 ${foreignCount})`
  );
  console.log(`   구 분포: ${guStr}`);
  if (flagged.length) {
    totalFlags += flagged.length;
    for (const p of flagged.slice(0, 12)) {
      const tag = p.foreign ? "🚫타지역" : "⚠️먼곳";
      console.log(
        `   ${tag} ${p.d.toFixed(2)}km 픽${p.pick} [${p.gu}]  ${p.name}  (${p.address || "주소없음"})`
      );
    }
    if (flagged.length > 12) console.log(`   … 외 ${flagged.length - 12}곳`);
  } else {
    console.log("   ✅ 오염 없음");
  }
}

console.log(`\n===== 점검 완료: 의심 장소 합계 ${totalFlags} =====`);
