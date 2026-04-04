#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 야장마스터 큐레이터 정보
const YAJANG_MASTER = {
  name: "야장마스터",
  color: "#FF6B6B",
  subtitle: "야장 전문 큐레이터",
  bio: "深夜の酒場専門家。日本の居酒屋文化に詳しく、隠れ家的なバーを厳選します。",
  avatar: "https://placehold.co/240x240?text=야장마스터"
};

// 야장 관련 태그
const YAJANG_TAGS = [
  "야장", "심야", "조용한", "혼술", "2차", "일본식", "이자카야", 
  "사케", "일본주", "안주맛집", "분위기", "은밀한", "노포", "가성비"
];

// 서울 주요 지역
const SEOUL_REGIONS = [
  "을지로", "종로", "강남", "성수", "연남", "망원", "홍대", 
  "신사", "청담", "합정", "상수", "공덕", "마포", "이태원",
  "광화문", "시청", "명동", "삼성", "선릉", "역삼", "교대",
  "서초", "방배", "사당", "낙성대", "동작", "신대문", "창동",
  "도봉", "노원", "월계", "중랑", "면목", "왕십리", "청량리",
  "신설동", "동대문", "장충", "을지로입구", "충무로", "동작"
];

// 장소 이름 생성 (야장 스타일)
function generateYajangPlaceName(region, index) {
  const prefixes = ["深夜", "夜", "宵", "夕", "晩"];
  const types = ["酒場", "バー", "居酒屋", "食堂", "料理", "餐酒"];
  const suffixes = ["", "屋", "家", "堂", "館", "軒"];
  
  const prefix = prefixes[index % prefixes.length];
  const type = types[Math.floor(index / prefixes.length) % types.length];
  const suffix = suffixes[Math.floor(index / (prefixes.length * types.length)) % suffixes.length];
  
  return `${prefix}${type}${suffix}`;
}

// 좌표 생성 (지역별 중심 + 약간의 랜덤)
function generateCoordinates(region) {
  const regionCoords = {
    "을지로": { lat: 37.5662, lng: 126.9918 },
    "종로": { lat: 37.5712, lng: 126.9903 },
    "강남": { lat: 37.4987, lng: 127.0277 },
    "성수": { lat: 37.5447, lng: 127.0557 },
    "연남": { lat: 37.5612, lng: 126.9228 },
    "망원": { lat: 37.5563, lng: 126.9087 },
    "홍대": { lat: 37.5568, lng: 126.9240 },
    "신사": { lat: 37.5172, lng: 127.0200 },
    "청담": { lat: 37.5142, lng: 127.0180 },
    "합정": { lat: 37.5442, lng: 126.9420 },
    "상수": { lat: 37.5482, lng: 126.9220 },
    "공덕": { lat: 37.5422, lng: 126.9520 },
    "마포": { lat: 37.5662, lng: 126.9020 },
    "이태원": { lat: 37.5342, lng: 126.9940 },
    "광화문": { lat: 37.5722, lng: 126.9760 },
    "시청": { lat: 37.5662, lng: 126.9780 },
    "명동": { lat: 37.5632, lng: 126.9840 },
    "삼성": { lat: 37.5132, lng: 127.0440 },
    "선릉": { lat: 37.5082, lng: 127.0380 },
    "역삼": { lat: 37.5002, lng: 127.0420 },
    "교대": { lat: 37.4922, lng: 127.0320 },
    "서초": { lat: 37.4862, lng: 127.0280 },
    "방배": { lat: 37.4782, lng: 127.0220 },
    "사당": { lat: 37.4762, lng: 126.9880 },
    "낙성대": { lat: 37.4662, lng: 126.9620 },
    "동작": { lat: 37.5122, lng: 126.9520 },
    "신대문": { lat: 37.5882, lng: 127.0180 },
    "창동": { lat: 37.6562, lng: 127.0820 },
    "도봉": { lat: 37.6682, lng: 127.0320 },
    "노원": { lat: 37.6422, lng: 127.0620 },
    "월계": { lat: 37.6322, lng: 127.0720 },
    "중랑": { lat: 37.6062, lng: 127.0920 },
    "면목": { lat: 37.5882, lng: 127.0880 },
    "왕십리": { lat: 37.5922, lng: 127.0720 },
    "청량리": { lat: 37.5922, lng: 127.0420 },
    "신설동": { lat: 37.5722, lng: 127.0280 },
    "동대문": { lat: 37.5822, lng: 127.0520 },
    "장충": { lat: 37.5622, lng: 127.0380 },
    "을지로입구": { lat: 37.5722, lng: 126.9980 },
    "충무로": { lat: 37.5622, lng: 127.0120 },
    "동작": { lat: 37.5122, lng: 126.9520 }
  };
  
  const base = regionCoords[region] || { lat: 37.5662, lng: 126.9780 };
  
  // 약간의 랜덤 변화 (±0.01도, 약 1km 범위)
  return {
    lat: base.lat + (Math.random() - 0.5) * 0.02,
    lng: base.lng + (Math.random() - 0.5) * 0.02
  };
}

// 랜덤 태그 선택
function getRandomTags(count = 3) {
  const shuffled = [...YAJANG_TAGS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 랜덤 주소 생성
function generateAddress(region) {
  const streetTypes = ["로", "길", "동", "가"];
  const numbers = Math.floor(Math.random() * 100) + 1;
  const streetType = streetTypes[Math.floor(Math.random() * streetTypes.length)];
  
  return `서울특별시 ${region} ${numbers}-${Math.floor(Math.random() * 50) + 1}`;
}

// 메인 생성 함수
function generateYajangPlaces(count = 250) {
  const places = [];
  
  for (let i = 0; i < count; i++) {
    const region = SEOUL_REGIONS[i % SEOUL_REGIONS.length];
    const coords = generateCoordinates(region);
    const name = generateYajangPlaceName(region, i);
    const tags = getRandomTags(3);
    
    places.push({
      id: `yajang_${i + 1}_${Date.now()}`,
      name: name,
      region: region,
      lat: coords.lat,
      lng: coords.lng,
      image: `https://placehold.co/800x500?text=${encodeURIComponent(name)}`,
      primaryCurator: "야장마스터",
      curators: ["야장마스터"],
      tags: tags,
      comment: `${region}의 숨겨진 야장. ${tags.join(", ")} 스타일의 술집입니다.`,
      savedCount: Math.floor(Math.random() * 1000) + 50,
      address: generateAddress(region),
      telephone: `02-${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  return places;
}

// 실행
const newPlaces = generateYajangPlaces(250);

// 기존 places.json 읽기
const placesPath = path.join(__dirname, 'src/data/places.json');
let existingPlaces = [];

try {
  const existingData = fs.readFileSync(placesPath, 'utf8');
  existingPlaces = JSON.parse(existingData);
  console.log(`기존 장소: ${existingPlaces.length}개`);
} catch (error) {
  console.log('기존 파일이 없습니다. 새로 생성합니다.');
}

// 중복 확인 (이름과 지역으로)
const existingKeys = existingPlaces.map(p => `${p.name}_${p.region}`);
const uniqueNewPlaces = newPlaces.filter(p => 
  !existingKeys.includes(`${p.name}_${p.region}`)
);

console.log(`새로 추가할 장소: ${uniqueNewPlaces.length}개`);

// 합치기
const allPlaces = [...existingPlaces, ...uniqueNewPlaces];

// 저장
fs.writeFileSync(placesPath, JSON.stringify(allPlaces, null, 2), 'utf8');

console.log(`✅ 총 ${allPlaces.length}개 장소를 저장했습니다.`);
console.log(`📍 ${uniqueNewPlaces.length}개의 새로운 야장 장소가 추가되었습니다.`);

// 야장마스터 큐레이터 정보도 추가
const curatorsPath = path.join(__dirname, 'src/data/curators.js');
try {
  const curatorsContent = fs.readFileSync(curatorsPath, 'utf8');
  
  // 야장마스터가 이미 있는지 확인
  if (!curatorsContent.includes('야장마스터')) {
    const newCurator = `
  {
    name: "야장마스터",
    color: "#FF6B6B",
    subtitle: "야장 전문 큐레이터",
    bio: "深夜の酒場専門家。日本の居酒屋文化に詳しく、隠れ家的なバーを厳選します。",
    avatar: "https://placehold.co/240x240?text=야장마스터",
    followers: 150000,
    isPower: true,
  },`;
    
    const updatedContent = curatorsContent.replace(
      /(\];\s*$)/,
      `${newCurator}\n];`
    );
    
    fs.writeFileSync(curatorsPath, updatedContent, 'utf8');
    console.log('✅ 야장마스터 큐레이터를 추가했습니다.');
  } else {
    console.log('ℹ️ 야장마스터 큐레이터가 이미 존재합니다.');
  }
} catch (error) {
  console.log('⚠️ 큐레이터 파일 업데이트 실패:', error.message);
}

console.log('\n🎉 야장마스터의 250개 장소가 성공적으로 추가되었습니다!');
console.log('📁 파일 위치: src/data/places.json');
