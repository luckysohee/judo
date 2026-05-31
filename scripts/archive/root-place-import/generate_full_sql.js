// 전체 248개 장소 SQL 생성 스크립트
import fs from 'fs';

// JSON 파일 읽기
const jsonData = fs.readFileSync('/Users/h/new_JD/judo/curator_places_248_full.json', 'utf8');
const places = JSON.parse(jsonData);

let sql = '-- 큐레이터 장소 데이터 import (전체 248개) - curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c\n\n';

// INSERT 문 생성
places.forEach((place, index) => {
  sql += `-- ${index + 1}. ${place.name}\n`;
  sql += `INSERT INTO places (name, address, lat, lng, created_at) \n`;
  sql += `SELECT '${place.name}', '${place.address}', ${place.latitude}, ${place.longitude}, NOW()\n`;
  sql += `WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '${place.name}');\n\n`;
});

// curator_places 관계 추가
sql += '-- Curator_Place 관계 추가 (전체 248개 장소)\n';
sql += 'INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)\n';
sql += 'SELECT \'43b3eb72-a835-4b5b-b305-da4708b53b5c\', id, false, NOW()\n';
sql += 'FROM places \n';
sql += 'WHERE name IN (\n';

places.forEach((place, index) => {
  sql += `  '${place.name}'${index < places.length - 1 ? ',' : ''}\n`;
});

sql += ')\n';
sql += 'AND id NOT IN (\n';
sql += '  SELECT place_id FROM curator_places WHERE curator_id = \'43b3eb72-a835-4b5b-b305-da4708b53b5c\'\n';
sql += ');\n';

// SQL 파일 저장
fs.writeFileSync('/Users/h/new_JD/judo/curator_places_248_complete.sql', sql);

console.log('✅ 전체 248개 장소 SQL 파일 생성 완료!');
console.log('📁 파일명: curator_places_248_complete.sql');
