// 브라우저 콘솔에서 직접 Supabase 쿼리 테스트
import { supabase } from './src/lib/supabase.js';

// 1. 직접 places 테이블 조회
supabase
  .from('places')
  .select('id, name, place_id, lat, lng')
  .eq('name', '더백테라스 신용산점')
  .then(({ data, error }) => {
    console.log('🔍 직접 places 조회:', { data, error });
    if (data && data[0]) {
      console.log('🔍 place_id:', data[0].place_id);
    }
  });

// 2. curator_places 조인 조회 (Home.jsx와 동일)
supabase
  .from('curator_places')
  .select(`
    *,
    places (*),
    curators!curator_places_curator_id_fkey (username, display_name)
  `)
  .eq('is_archived', false)
  .then(({ data, error }) => {
    console.log('🔍 조인 조회:', { data, error });
    if (data && data.length > 0) {
      const targetPlace = data.find(item => item.places?.name === '더백테라스 신용산점');
      if (targetPlace) {
        console.log('🔍 조인된 place 데이터:', targetPlace.places);
        console.log('🔍 조인된 place_id:', targetPlace.places?.place_id);
        console.log('🔍 키 목록:', Object.keys(targetPlace.places || {}));
      }
    }
  });
