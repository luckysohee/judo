#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');

// 카카오 REST API 키
const KAKAO_REST_API_KEY = 'c11926540ef6a01a9447ef114af07c5d';

// 카카오 장소 검색으로 좌표 얻기
async function geocodePlace(placeName, address) {
  try {
    // 1. 상호명으로 검색
    let query = placeName;
    
    // 2. 주소가 있으면 함께 검색 (정확도 향상)
    if (address) {
      // 주소에서 시/구만 추출
      const addressParts = address.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)?\s*([가-힣]+구|[가-힣]+시)/);
      if (addressParts) {
        query = `${addressParts[0]} ${placeName}`;
      }
    }
    
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      params: {
        query: query,
        size: 1, // 가장 정확한 결과 1개만
        sort: 'accuracy'
      },
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    const places = response.data.documents;
    
    if (places.length > 0) {
      const place = places[0];
      return {
        success: true,
        kakao_place_id: place.id,
        name: place.place_name,
        address: place.road_address_name || place.address_name,
        lat: parseFloat(place.y),
        lng: parseFloat(place.x),
        category: place.category_name,
        phone: place.phone,
        confidence: 'high'
      };
    }
    
    return { success: false, error: 'Place not found' };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      confidence: 'low'
    };
  }
}

// CSV 파일 파싱
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

// 메인 처리 함수
async function batchGeocoding(inputFile, outputFile, options = {}) {
  const { 
    nameField = 'name', 
    addressField = 'address', 
    format = 'csv',
    batchSize = 10 
  } = options;
  
  console.log('📍 일괄 좌표 변환 시작...');
  
  let places = [];
  
  // 파일 읽기
  try {
    const content = fs.readFileSync(inputFile, 'utf8');
    
    if (format === 'csv') {
      places = parseCSV(content);
    } else if (format === 'json') {
      places = JSON.parse(content);
    } else {
      throw new Error('지원하지 않는 형식입니다. csv 또는 json만 가능합니다.');
    }
    
    console.log(`📁 ${places.length}개 장소 로드 완료`);
  } catch (error) {
    console.error('❌ 파일 읽기 오류:', error.message);
    return;
  }
  
  // 일괄 처리
  const results = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < places.length; i += batchSize) {
    const batch = places.slice(i, i + batchSize);
    
    console.log(`\n🔄 ${i + 1}-${Math.min(i + batchSize, places.length)} / ${places.length} 처리 중...`);
    
    const batchPromises = batch.map(async (place, index) => {
      const placeName = place[nameField];
      const address = place[addressField];
      
      if (!placeName) {
        return {
          ...place,
          geocoding_result: { 
            success: false, 
            error: '상호명 없음',
            confidence: 'none'
          }
        };
      }
      
      process.stdout.write(`  ${i + index + 1}. ${placeName}... `);
      
      const result = await geocodePlace(placeName, address);
      
      if (result.success) {
        successCount++;
        console.log('✅ 성공');
      } else {
        failCount++;
        console.log(`❌ 실패: ${result.error}`);
      }
      
      return {
        ...place,
        geocoding_result: result,
        // 카카오 정보를 최상위 필드로 추가
        kakao_place_id: result.success ? result.kakao_place_id : null,
        lat: result.success ? result.lat : null,
        lng: result.success ? result.lng : null,
        kakao_category: result.success ? result.category : null,
        kakao_phone: result.success ? result.phone : null
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // API 요청 간격 (카카오 제한: 초당 100개)
    if (i + batchSize < places.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // 결과 저장
  try {
    if (format === 'csv') {
      // CSV로 저장
      const csvHeaders = Object.keys(results[0] || {});
      const csvContent = [
        csvHeaders.join(','),
        ...results.map(place => 
          csvHeaders.map(header => {
            const value = place[header];
            if (typeof value === 'object' && value !== null) {
              return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(',')
        )
      ].join('\n');
      
      fs.writeFileSync(outputFile, csvContent, 'utf8');
    } else {
      // JSON으로 저장
      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
    }
    
    console.log(`\n📊 처리 결과:`);
    console.log(`  - 성공: ${successCount}개 (${((successCount / places.length) * 100).toFixed(1)}%)`);
    console.log(`  - 실패: ${failCount}개 (${((failCount / places.length) * 100).toFixed(1)}%)`);
    console.log(`  - 저장 파일: ${outputFile}`);
    
  } catch (error) {
    console.error('❌ 저장 오류:', error.message);
  }
}

// 사용 예시
async function main() {
  // 예시: CSV 파일 처리
  // await batchGeocoding('places.csv', 'places_with_coordinates.csv', {
  //   nameField: '상호명',
  //   addressField: '주소',
  //   format: 'csv'
  // });
  
  // 예시: JSON 파일 처리
  // await batchGeocoding('places.json', 'places_with_coordinates.json', {
  //   nameField: 'name',
  //   addressField: 'address',
  //   format: 'json'
  // });
  
  console.log('📋 사용법:');
  console.log('1. 데이터 파일 준비 (CSV 또는 JSON)');
  console.log('2. 필드명 확인 (상호명, 주소 등)');
  console.log('3. 스크립트에 옵션 설정');
  console.log('4. 실행: node batch_geocoding.js');
  
  console.log('\n🔧 설정 예시:');
  console.log('batchGeocoding("내데이터.csv", "결과.csv", {');
  console.log('  nameField: "상호명",');
  console.log('  addressField: "주소",');
  console.log('  format: "csv"');
  console.log('});');
}

if (require.main === module) {
  main();
}

module.exports = { batchGeocoding, geocodePlace };
