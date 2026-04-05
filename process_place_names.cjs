#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');

// 카카오 REST API 키
const KAKAO_REST_API_KEY = 'c11926540ef6a01a9447ef114af07c5d';
const CURATOR_ID = '43b3eb72-a835-4b5b-b305-da4708b53b5c';

// 카카오 API로 장소 검색 (상호명으로)
async function searchPlaceByName(placeName) {
  try {
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      params: {
        query: placeName,
        sort: 'accuracy' // 정확도 순으로 검색
      },
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    if (response.data.documents && response.data.documents.length > 0) {
      const place = response.data.documents[0];
      return {
        place_name: place.place_name,
        place_id: place.id,
        address: place.address_name || place.road_address_name,
        phone: place.phone,
        category_group_name: place.category_group_name,
        category_name: place.category_name,
        x: place.x,
        y: place.y
      };
    }
    return null;
  } catch (error) {
    console.error(`Error searching for ${placeName}:`, error.message);
    return null;
  }
}

// 메인 처리 함수
async function processPlaceNamesToSQL() {
  try {
    // JSON 파일 읽기
    const jsonData = fs.readFileSync('./place_names_input.json', 'utf8');
    const placeData = JSON.parse(jsonData);

    // 상호명 추출
    const placeNames = placeData.map(item => item.상호);

    console.log(`📁 ${placeNames.length}개 상호명 로드 완료`);

    const results = [];

    for (let i = 0; i < placeNames.length; i++) {
      const placeName = placeNames[i];
      console.log(`${i + 1}/${placeNames.length}. 처리 중: ${placeName}`);

      // 상호명으로 카카오 API 검색
      const kakaoPlace = await searchPlaceByName(placeName);

      if (kakaoPlace) {
        results.push({
          ...kakaoPlace,
          original_name: placeName
        });
        console.log(`  ✅ 찾음: ${kakaoPlace.place_name} (ID: ${kakaoPlace.place_id})`);
      } else {
        console.log(`  ❌ (Place not found)`);
      }
    }

    console.log(`\n📊 검색 결과: ${results.length}/${placeNames.length} 성공`);

    // SQL 파일 생성
    generateSQL(results);

    // 통계 정보 출력
    console.log('\n📋 통계 정보:');
    console.log(`- 전체 상호명: ${placeNames.length}개`);
    console.log(`- 성공: ${results.length}개`);
    console.log(`- 실패: ${placeNames.length - results.length}개`);
    
    results.forEach((place, index) => {
      console.log(`${index + 1}. ${place.place_name} (ID: ${place.place_id})`);
    });

  } catch (error) {
    console.error('Error processing places:', error);
  }
}

// SQL 파일 생성
function generateSQL(places) {
  let sql = `-- 큐레이터 장소 데이터 import (상호명 기반) - curator_id: ${CURATOR_ID}\n`;
  sql += '-- 상호명으로 카카오지도 검색 성공한 장소들만 포함\n';
  sql += '-- 카카오 지도 정보는 place_id만 저장, 나머지는 API로 바로 표시\n\n';

  places.forEach((place, index) => {
    sql += `-- ${index + 1}. ${place.place_name} (카카오 ID: ${place.place_id})\n`;
    sql += `INSERT INTO places (name, address, lat, lng, created_at) \n`;
    sql += `SELECT '${place.place_name}', '${place.address}', ${place.y}, ${place.x}, NOW()\n`;
    sql += `WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '${place.place_name}');\n\n`;
  });

  sql += '-- Curator_Place 관계 추가\n';
  sql += `INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)\n`;
  sql += `SELECT '${CURATOR_ID}', id, false, NOW()\n`;
  sql += `FROM places \n`;
  sql += `WHERE name IN (\n`;
  
  places.forEach((place, index) => {
    sql += `  '${place.place_name}'${index < places.length - 1 ? ',' : ''}\n`;
  });
  
  sql += `)\n`;
  sql += `AND id NOT IN (\n`;
  sql += `  SELECT place_id FROM curator_places WHERE curator_id = '${CURATOR_ID}'\n`;
  sql += `);`;

  fs.writeFileSync('./curator_places_from_names.sql', sql);
  console.log('\n📄 SQL 파일 생성: curator_places_from_names.sql');
}

// 실행
processPlaceNamesToSQL();
