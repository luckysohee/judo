#!/usr/bin/env node

const axios = require('axios');

// 카카오 REST API 키
const KAKAO_REST_API_KEY = 'c11926540ef6a01a9447ef114af07c5d';

// 야장 관련 검색 키워드
const YAJANG_KEYWORDS = [
  '이자카야', '야장', '심야주점', '일본식주점', '사케바', '일본술집',
  '深夜', '深夜酒場', '居酒屋', '日本酒', '사케', '일본식',
  '야식', '야식주점', '늦은시간', '24시간', '심야'
];

// 서울 주요 지역
const SEOUL_REGIONS = [
  '을지로', '종로', '강남', '성수', '연남', '망원', '홍대', 
  '신사', '청담', '합정', '상수', '공덕', '마포', '이태원',
  '광화문', '시청', '명동', '삼성', '선릉', '역삼', '교대'
];

// 카카오 장소 검색
async function searchKakaoPlaces(keyword, region = '') {
  try {
    const query = region ? `${region} ${keyword}` : keyword;
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      params: {
        query: query,
        category_group_code: 'FD6', // 음식점 카테고리
        size: 15,
        sort: 'accuracy'
      },
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    return response.data.documents.map(place => ({
      id: place.id, // 카카오 place_id
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      region: region || '서울',
      lat: place.y,
      lng: place.x,
      category: place.category_name,
      phone: place.phone,
      image: `https://placehold.co/800x500?text=${encodeURIComponent(place.place_name)}`,
      primaryCurator: "야장마스터",
      curators: ["야장마스터"],
      tags: extractTags(place.category_name, place.place_name),
      comment: `${region}의 ${place.place_name}. ${place.category_name} 카테고리.`,
      savedCount: Math.floor(Math.random() * 500) + 10,
      kakao_place_id: place.id, // 카카오 지도용 ID
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error(`검색 오류 (${keyword}):`, error.response?.data || error.message);
    return [];
  }
}

// 태그 추출
function extractTags(category, name) {
  const tags = [];
  
  if (category.includes('이자카야') || name.includes('이자카야')) tags.push('이자카야');
  if (category.includes('일본') || name.includes('일본')) tags.push('일본식');
  if (category.includes('주점') || name.includes('주점')) tags.push('주점');
  if (category.includes('술') || name.includes('술')) tags.push('술집');
  if (category.includes('바') || name.includes('바')) tags.push('바');
  if (name.includes('심야') || name.includes('深夜')) tags.push('심야');
  if (name.includes('야장') || name.includes('夜場')) tags.push('야장');
  if (category.includes('사케') || name.includes('사케')) tags.push('사케');
  
  return tags.length > 0 ? tags : ['주점', '야장'];
}

// 중복 제거
function removeDuplicates(places) {
  const seen = new Set();
  return places.filter(place => {
    const key = `${place.name}_${place.address}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// 메인 수집 함수
async function collectRealYajangPlaces() {
  console.log('🔍 실제 야장 장소 수집 시작...');
  
  const allPlaces = [];
  let totalSearched = 0;
  
  for (const region of SEOUL_REGIONS) {
    console.log(`\n📍 ${region} 지역 검색 중...`);
    
    for (const keyword of YAJANG_KEYWORDS) {
      totalSearched++;
      process.stdout.write(`  검색: ${keyword}... `);
      
      const places = await searchKakaoPlaces(keyword, region);
      console.log(`${places.length}개 발견`);
      
      allPlaces.push(...places);
      
      // API 요청 간격 (초당 100개 제한)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // 중복 제거
  const uniquePlaces = removeDuplicates(allPlaces);
  
  // 야장 관련성 필터링
  const yajangPlaces = uniquePlaces.filter(place => {
    const isYajangRelated = 
      place.tags.includes('야장') || 
      place.tags.includes('심야') ||
      place.tags.includes('이자카야') ||
      place.name.includes('심야') ||
      place.name.includes('深夜') ||
      place.name.includes('야장') ||
      place.category.includes('주점');
    
    return isYajangRelated;
  });
  
  console.log(`\n📊 수집 결과:`);
  console.log(`  - 총 검색: ${totalSearched}회`);
  console.log(`  - 발견 장소: ${allPlaces.length}개`);
  console.log(`  - 중복 제거: ${uniquePlaces.length}개`);
  console.log(`  - 야장 필터링: ${yajangPlaces.length}개`);
  
  return yajangPlaces;
}

// 실행
async function main() {
  try {
    const places = await collectRealYajangPlaces();
    
    if (places.length === 0) {
      console.log('❌ 야장 장소를 찾지 못했습니다.');
      return;
    }
    
    // 기존 places.json과 합치기
    const fs = require('fs');
    const path = require('path');
    
    const placesPath = path.join(__dirname, 'src/data/places.json');
    let existingPlaces = [];
    
    try {
      const existingData = fs.readFileSync(placesPath, 'utf8');
      existingPlaces = JSON.parse(existingData);
      console.log(`\n📁 기존 장소: ${existingPlaces.length}개`);
    } catch (error) {
      console.log('\n📁 기존 파일이 없습니다. 새로 생성합니다.');
    }
    
    // 기존 장소와 합치기 (중복 제거)
    const existingIds = new Set(existingPlaces.map(p => p.id));
    const newPlaces = places.filter(p => !existingIds.has(p.id));
    
    const allPlaces = [...existingPlaces, ...newPlaces];
    
    // 저장
    fs.writeFileSync(placesPath, JSON.stringify(allPlaces, null, 2), 'utf8');
    
    console.log(`\n✅ 저장 완료:`);
    console.log(`  - 새로 추가: ${newPlaces.length}개`);
    console.log(`  - 총 장소: ${allPlaces.length}개`);
    console.log(`  - 저장 위치: src/data/places.json`);
    
    // 샘플 출력
    console.log(`\n📋 샘플 장소 (상위 5개):`);
    newPlaces.slice(0, 5).forEach((place, i) => {
      console.log(`  ${i+1}. ${place.name} (${place.region}) - ID: ${place.id}`);
    });
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}
