#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');

// 카카오 REST API 키
const KAKAO_REST_API_KEY = 'c11926540ef6a01a9447ef114af07c5d';

// 야장마스터 큐레이터 ID (실제 DB에 맞게 수정 필요)
const YAJANG_MASTER_ID = '43b3eb72-a835-4b5b-b305-da4708b53b5c';

// 상호명만 추출하는 함수
function extractBusinessName(displayName) {
  if (!displayName) return '';
  
  // 지역명 제거 (구, 동, 로 등) - 더 강력한 패턴
  const regions = [
    '구', '동', '로', '읍', '면', '리', '가', '길', '산', '천', '대로', '로', '거리', '시장', '역', '광장', '공원', '뒤', '앞', '옆', '근처', '입구', '끝', '아래', '위'
  ];
  
  let cleanName = displayName;
  
  // 특정 지역명 먼저 제거
  const specificRegions = [
    '을지로', '종로', '강남', '성수', '연남', '망원', '홍대', '신사', '청담', '합정', '상수', '공덕', '마포', '이태원', '해방촌', '낙산', '한남', '잠원', '서촌', '동대문', '반포', '여의도', '샤로수길', '석촌', '압구정', '충무로', '성북', '필동', '충정로', '동묘', '불광', '당산', '대학로', '마곡', '청량리', '구의', '성내', '다동', '도산', '염리', '뚝섬', '창동', '화곡', '선릉', '방배', '신당', '서초', '삼성', '약수', '상수', '삼전', '남영', '문래', '합정', '삼청', '영등포'
  ];
  
  specificRegions.forEach(region => {
    const regex = new RegExp(region, 'g');
    cleanName = cleanName.replace(regex, '').trim();
  });
  
  // 일반 지역명 접미사 제거
  regions.forEach(region => {
    const regex = new RegExp(region + '$', 'g');
    cleanName = cleanName.replace(regex, '').trim();
  });
  
  // 공백 정리
  cleanName = cleanName.replace(/\s+/g, ' ').trim();
  
  return cleanName;
}

// 카카오 장소 검색으로 좌표 얻기
async function geocodePlace(placeName, address) {
  try {
    // display_name에서 상호명만 추출
    const businessName = extractBusinessName(placeName);
    
    // 상호명으로 검색
    let query = businessName;
    
    // 핵심 키워드 매칭
    const keywordMap = {
      '노가리': '노가리',
      '에일당': '에일당',
      '테르트르': '테르트르',
      '더로열푸드': '더로열푸드',
      '경의선숲길': '경의선숲길',
      '대림창고': '대림창고',
      '뮤직라이브러리': '뮤직라이브러리',
      '블루페이지': '블루페이지',
      '잔치집': '잔치집',
      '현대시티아울렛': '현대시티아울렛',
      '정원': '정원',
      'GFC': 'GFC',
      '가로수길': '가로수길',
      '세빛섬': '세빛섬',
      '화목순대국': '화목순대국',
      '복덕방': '복덕방',
      '육회골목': '육회골목',
      '카페거리': '카페거리',
      '달빛술담': '달빛술담',
      '대원식당': '대원식당',
      '바이산': '바이산',
      '조셉의커피나무': '조셉의커피나무',
      '한국의집': '한국의집',
      '철길떡볶이': '철길떡볶이',
      '해담는다리': '해담는다리',
      '선유기지': '선유기지',
      '독일주택': '독일주택',
      '사이언스파크': '사이언스파크',
      '상생장': '상생장',
      '미가로': '미가로',
      '옥경이네': '옥경이네',
      '악바리': '악바리',
      '백억하누': '백억하누',
      '노가리슈퍼': '노가리슈퍼',
      '무대륙': '무대륙'
    };
    
    for (const [keyword, searchTerm] of Object.entries(keywordMap)) {
      if (businessName.includes(keyword)) {
        query = searchTerm;
        break;
      }
    }
    
    // 키워드 매칭 안되면 추출된 상호명 사용
    if (query === placeName && businessName) {
      query = businessName;
    }
    
    console.log(`검색어: "${query}" (원본: "${placeName}" -> 상호명: "${businessName}")`);
    
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      params: {
        query: query,
        size: 5, // 여러 결과 확인
        sort: 'accuracy'
      },
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    const places = response.data.documents;
    
    if (places.length > 0) {
      const place = places[0];
      console.log(`✅ 찾음: ${place.place_name} (${place.category_name})`);
      return {
        success: true,
        kakao_place_id: place.id,
        name: place.place_name,
        address: place.road_address_name || place.address_name,
        lat: parseFloat(place.y),
        lng: parseFloat(place.x),
        category: place.category_name,
        phone: place.phone
      };
    }
    
    return { success: false, error: 'Place not found', query: query };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message
    };
  }
}

// JSON 데이터를 curator_places 형식으로 변환
function convertToCuratorPlaces(jsonData, curatorId) {
  return jsonData.map((item, index) => {
    // 필드명 매핑 (JSON 구조에 맞게 수정)
    const placeName = item.display_name || item.name || item.상호명 || item.title || '';
    const address = item.address || item.주소 || item.addr || '';
    const region = item.region || item.지역 || extractRegion(address) || '서울';
    
    console.log(`${index + 1}. 처리 중: ${placeName}`);
    
    return {
      // curator_places 테이블 필드
      curator_id: item.curator_id || curatorId,
      is_archived: false, // 공개 상태
      created_at: new Date().toISOString(),
      
      // places 테이블에 저장될 장소 정보
      place: {
        name: placeName,
        address: address,
        region: region,
        lat: null, // 나중에 채워짐
        lng: null, // 나중에 채워짐
        image: item.image || `https://placehold.co/800x500?text=${encodeURIComponent(placeName)}`,
        category: item.category || item.카테고리 || '주점',
        phone: item.phone || item.전화번호 || '',
        kakao_place_id: null, // 나중에 채워짐
        created_at: new Date().toISOString(),
        // 추가 정보
        one_line_reason: item.one_line_reason || '',
        alcohol_types: item.alcohol_types || [],
        tags: item.tags || []
      },
      
      // 원본 데이터 보존
      original_data: item
    };
  });
}

// 주소에서 지역 추출
function extractRegion(address) {
  if (!address) return '서울';
  
  const regions = ['을지로', '종로', '강남', '성수', '연남', '망원', '홍대', '신사', '청담', '합정', '상수', '공덕', '마포', '이태원'];
  
  for (const region of regions) {
    if (address.includes(region)) {
      return region;
    }
  }
  
  return '서울';
}

// curator_places용 SQL 생성
function generateSQL(curatorPlaces) {
  const sqlStatements = [];
  
  // 1. places 테이블에 장소 먼저 추가 (상호명만 저장)
  sqlStatements.push('-- Places 테이블에 장소 추가 (상호명만)');
  curatorPlaces.forEach((cp, index) => {
    const place = cp.place;
    const businessName = extractBusinessName(place.name);
    sqlStatements.push(`-- ${index + 1}. ${businessName}`);
    sqlStatements.push(`INSERT INTO places (name, address, lat, lng, created_at)`);
    sqlStatements.push(`VALUES (`);
    sqlStatements.push(`  '${businessName.replace(/'/g, "''")}',`);
    sqlStatements.push(`  '${place.address.replace(/'/g, "''")}',`);
    sqlStatements.push(`  ${place.lat || 'NULL'},`);
    sqlStatements.push(`  ${place.lng || 'NULL'},`);
    sqlStatements.push(`  NOW()`);
    sqlStatements.push(`);`);
    sqlStatements.push(``);
  });
  
  // 2. curator_places 테이블에 관계 추가 (상호명으로 검색)
  sqlStatements.push('-- Curator_Place 관계 추가');
  curatorPlaces.forEach((cp, index) => {
    const businessName = extractBusinessName(cp.place.name);
    sqlStatements.push(`-- ${index + 1}. ${businessName} - ${cp.curator_id}`);
    sqlStatements.push(`INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)`);
    sqlStatements.push(`VALUES (`);
    sqlStatements.push(`  '${cp.curator_id}',`);
    sqlStatements.push(`  (SELECT id FROM places WHERE name = '${businessName.replace(/'/g, "''")}' LIMIT 1),`);
    sqlStatements.push(`  false,`);
    sqlStatements.push(`  NOW()`);
    sqlStatements.push(`);`);
    sqlStatements.push(``);
  });
  
  return sqlStatements.join('\n');
}

// 메인 처리 함수
async function importToCuratorPlaces(jsonFile, curatorId = YAJANG_MASTER_ID) {
  console.log('🔄 curator_places로 데이터 import 시작...');
  
  try {
    // JSON 파일 읽기
    const jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    console.log(`📁 ${jsonData.length}개 데이터 로드 완료`);
    
    // curator_places 형식으로 변환
    const curatorPlaces = convertToCuratorPlaces(jsonData, curatorId);
    console.log(`🔄 ${curatorPlaces.length}개 데이터 변환 완료`);
    
    // 좌표 일괄 처리
    console.log('\n📍 좌표 변환 시작...');
    let successCount = 0;
    
    for (let i = 0; i < curatorPlaces.length; i++) {
      const cp = curatorPlaces[i];
      const placeName = cp.place.name;
      const address = cp.place.address;
      
      process.stdout.write(`${i + 1}/${curatorPlaces.length}. ${placeName}... `);
      
      const geoResult = await geocodePlace(placeName, address);
      
      if (geoResult.success) {
        cp.place.lat = geoResult.lat;
        cp.place.lng = geoResult.lng;
        cp.place.kakao_place_id = geoResult.kakao_place_id;
        cp.place.phone = geoResult.phone || cp.place.phone;
        cp.place.category = geoResult.category || cp.place.category;
        successCount++;
        console.log('✅');
      } else {
        console.log(`❌ (${geoResult.error})`);
      }
      
      // API 요청 간격
      if (i < curatorPlaces.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`\n📊 좌표 변환 결과: ${successCount}/${curatorPlaces.length} 성공`);
    
    // SQL 파일 생성
    const sqlContent = generateSQL(curatorPlaces);
    const sqlFile = jsonFile.replace('.json', '_curator_places.sql');
    
    fs.writeFileSync(sqlFile, sqlContent, 'utf8');
    console.log(`\n📄 SQL 파일 생성: ${sqlFile}`);
    
    // JSON 결과 파일 생성
    const resultFile = jsonFile.replace('.json', '_curator_places_ready.json');
    fs.writeFileSync(resultFile, JSON.stringify(curatorPlaces, null, 2), 'utf8');
    console.log(`📄 결과 파일 생성: ${resultFile}`);
    
    console.log(`\n🎉 import 준비 완료!`);
    console.log(`📋 다음 단계:`);
    console.log(`1. ${sqlFile} 파일을 Supabase에서 실행`);
    console.log(`2. curator_id를 실제 큐레이터 ID로 수정`);
    console.log(`3. 필요시 place_id 매핑 확인`);
    
  } catch (error) {
    console.error('❌ 처리 오류:', error.message);
  }
}

// 사용 예시
async function main() {
  console.log('📋 사용법:');
  console.log('node import_to_curator_places.js your_data.json');
  
  if (process.argv.length < 3) {
    console.log('\n❌ JSON 파일 경로를 지정해주세요.');
    return;
  }
  
  const jsonFile = process.argv[2];
  const curatorId = process.argv[3] || YAJANG_MASTER_ID;
  
  if (!fs.existsSync(jsonFile)) {
    console.log(`❌ 파일을 찾을 수 없습니다: ${jsonFile}`);
    return;
  }
  
  await importToCuratorPlaces(jsonFile, curatorId);
}

if (require.main === module) {
  main();
}

module.exports = { importToCuratorPlaces, convertToCuratorPlaces };
