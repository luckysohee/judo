// 브라우저 콘솔에서 place 데이터 확인
console.log('🔍 현재 마커 데이터 테스트');

// 마커 클릭 시 place 데이터 확인
// 개발자 도구 콘솔에서 실행
const testPlace = {
  id: '2a5c72ac-eb00-4a89-95da-b89594d61a7b',
  name: '마당족발',
  lat: 37.5462443878874,
  lng: 127.073354473115
};

console.log('🔍 테스트 데이터:', testPlace);
console.log('🔍 키 목록:', Object.keys(testPlace));
console.log('🔍 place_id:', testPlace.place_id);

// Supabase 직접 조회 테스트
import { supabase } from './src/lib/supabase.js';

supabase
  .from('places')
  .select('id, name, place_id')
  .eq('name', '마당족발')
  .then(({ data }) => {
    console.log('🔍 DB에서 조회한 마당족발:', data);
  });
