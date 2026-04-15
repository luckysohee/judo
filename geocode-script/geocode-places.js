// geocode-places.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !KAKAO_REST_API_KEY) {
  throw new Error(
    '환경변수 누락: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KAKAO_REST_API_KEY 확인'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function geocodeAddress(address) {
  const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
  url.searchParams.set('query', address);
  url.searchParams.set('analyze_type', 'similar');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`카카오 API 오류 ${res.status}: ${text}`);
  }

  const json = await res.json();
  const doc = json.documents?.[0];

  if (!doc) return null;

  return {
    lng: Number(doc.x),
    lat: Number(doc.y),
    road_address: doc.road_address?.address_name ?? null,
    address_name: doc.address_name ?? null,
  };
}

async function updatePlaceLatLng(place) {
  try {
    const geo = await geocodeAddress(place.address);

    if (!geo) {
      console.log(`좌표 못찾음: [${place.id}] ${place.name} / ${place.address}`);
      return { ok: false, reason: 'not_found' };
    }

    const { error } = await supabase
      .from('places')
      .update({
        lat: geo.lat,
        lng: geo.lng,
      })
      .eq('id', place.id);

    if (error) {
      console.error(`DB 업데이트 실패: [${place.id}] ${place.name}`, error.message);
      return { ok: false, reason: 'db_error' };
    }

    console.log(
      `완료: [${place.id}] ${place.name} -> lat=${geo.lat}, lng=${geo.lng}`
    );
    return { ok: true };
  } catch (err) {
    console.error(`실패: [${place.id}] ${place.name}`, err.message);
    return { ok: false, reason: 'exception' };
  }
}

async function main() {
  const pageSize = 1000;

  const { data: places, error } = await supabase
    .from('places')
    .select('id, name, address, lat, lng')
    .is('lat', null)
    .is('lng', null)
    .limit(pageSize);

  if (error) {
    throw new Error(`places 조회 실패: ${error.message}`);
  }

  console.log(`대상 ${places.length}개 시작`);

  let success = 0;
  let fail = 0;

  for (const place of places) {
    const result = await updatePlaceLatLng(place);

    if (result.ok) success += 1;
    else fail += 1;

    // 너무 빠르게 쏘지 않게 약간 텀
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.log(`끝. 성공=${success}, 실패=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});