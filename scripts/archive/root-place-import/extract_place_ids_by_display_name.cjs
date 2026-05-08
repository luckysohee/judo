#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');

// 카카오 REST API 키
const KAKAO_REST_API_KEY = 'c11926540ef6a01a9447ef114af07c5d';

// 카카오 API로 장소 검색 (display_name으로)
async function searchPlaceByDisplayName(displayName, lat, lng) {
  try {
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      params: {
        query: displayName,
        x: lng,
        y: lat,
        radius: 500, // 500m 반경 검색
        sort: 'distance'
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
        distance: place.distance,
        x: place.x,
        y: place.y
      };
    }
    return null;
  } catch (error) {
    console.error(`Error searching for ${displayName}:`, error.message);
    return null;
  }
}

// 메인 처리 함수
async function processPlacesByDisplayName() {
  try {
    // JSON 파일 읽기
    const jsonData = fs.readFileSync('./curator_places_50_complete.json', 'utf8');
    const places = JSON.parse(jsonData);

    console.log(`📁 ${places.length}개 데이터 로드 완료`);

    const results = [];

    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      console.log(`${i + 1}/${places.length}. 처리 중: ${place.display_name}`);

      // display_name으로 카카오 API 검색
      const kakaoPlace = await searchPlaceByDisplayName(place.display_name, place.lat, place.lng);

      if (kakaoPlace) {
        // 기존 데이터 + 카카오 place_id 합치기
        const finalPlace = {
          ...place,
          kakao_place_name: kakaoPlace.place_name,
          kakao_place_id: kakaoPlace.place_id,
          kakao_address: kakaoPlace.address,
          kakao_phone: kakaoPlace.phone,
          kakao_category_group_name: kakaoPlace.category_group_name,
          kakao_category_name: kakaoPlace.category_name,
          kakao_distance: kakaoPlace.distance
        };
        results.push(finalPlace);
        console.log(`  ✅ 찾음: ${kakaoPlace.place_name} (ID: ${kakaoPlace.place_id}, ${kakaoPlace.distance}m)`);
      } else {
        // 검색 실패한 경우에도 기존 데이터는 유지
        const failedPlace = {
          ...place,
          kakao_place_name: null,
          kakao_place_id: null,
          kakao_address: null,
          kakao_phone: null,
          kakao_category_group_name: null,
          kakao_category_name: null,
          kakao_distance: null
        };
        results.push(failedPlace);
        console.log(`  ❌ (Place not found)`);
      }
    }

    console.log(`\n📊 검색 결과: ${results.filter(r => r.kakao_place_id).length}/${places.length} 성공`);

    // 최종 JSON 파일 저장
    fs.writeFileSync('./curator_places_display_name_with_place_ids.json', JSON.stringify(results, null, 2));
    console.log('\n📄 최종 파일 생성: curator_places_display_name_with_place_ids.json');

    // 성공한 장소만 필터링한 파일도 저장
    const successfulPlaces = results.filter(r => r.kakao_place_id);
    fs.writeFileSync('./curator_places_display_name_successful_only.json', JSON.stringify(successfulPlaces, null, 2));
    console.log('📄 성공한 장소만: curator_places_display_name_successful_only.json');

    // SQL 파일 생성
    generateSQLByDisplayName(results);

    // 통계 정보 출력
    console.log('\n📋 통계 정보:');
    console.log(`- 전체 장소: ${places.length}개`);
    console.log(`- 성공: ${successfulPlaces.length}개`);
    console.log(`- 실패: ${places.length - successfulPlaces.length}개`);
    
    successfulPlaces.forEach((place, index) => {
      console.log(`${index + 1}. ${place.kakao_place_name} (ID: ${place.kakao_place_id})`);
      console.log(`   📞 전화번호: ${place.kakao_phone || '정보없음'}`);
      console.log(`   📍 주소: ${place.kakao_address}`);
      console.log(`   🏷️ 카테고리: ${place.kakao_category_name || '정보없음'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error processing places:', error);
  }
}

// SQL 파일 생성 (display_name 기반 - 기본 정보만)
function generateSQLByDisplayName(places) {
  let sql = '-- 큐레이터 장소 데이터 import (display_name 기반) - curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c\n';
  sql += '-- display_name으로 카카오지도 검색 성공한 장소들만 포함\n';
  sql += '-- 카카오 지도 정보(주소, 전화번호, 카테고리)는 DB 저장 없이 바로 표시\n\n';

  const successfulPlaces = places.filter(p => p.kakao_place_id);
  
  successfulPlaces.forEach((place, index) => {
    sql += `-- ${index + 1}. ${place.kakao_place_name} (카카오 ID: ${place.kakao_place_id})\n`;
    sql += `INSERT INTO places (name, address, lat, lng, created_at) \n`;
    sql += `SELECT '${place.kakao_place_name}', '${place.kakao_address}', ${place.lat}, ${place.lng}, NOW()\n`;
    sql += `WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '${place.kakao_place_name}');\n\n`;
  });

  sql += '-- Curator_Place 관계 추가 (display_name 기반)\n';
  sql += `INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)\n`;
  sql += `SELECT '43b3eb72-a835-4b5b-b305-da4708b53b5c', id, false, NOW()\n`;
  sql += `FROM places \n`;
  sql += `WHERE name IN (\n`;
  
  successfulPlaces.forEach((place, index) => {
    sql += `  '${place.kakao_place_name}'${index < successfulPlaces.length - 1 ? ',' : ''}\n`;
  });
  
  sql += `)\n`;
  sql += `AND id NOT IN (\n`;
  sql += `  SELECT place_id FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c'\n`;
  sql += `);`;

  fs.writeFileSync('./curator_places_display_name_simple.sql', sql);
  console.log('📄 SQL 파일 생성: curator_places_display_name_simple.sql');
}

// 실행
processPlacesByDisplayName();
