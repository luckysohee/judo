// 임시 스크립트: tags 컬럼 추가
import { supabase } from './src/lib/supabase.js';

async function addTagsColumn() {
  try {
    // SQL 실행
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE places 
        ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
        
        UPDATE places 
        SET tags = '{}' 
        WHERE tags IS NULL;
        
        CREATE INDEX IF NOT EXISTS idx_places_tags ON places USING GIN(tags);
      `
    });

    if (error) {
      console.error('SQL 실행 오류:', error);
    } else {
      console.log('✅ tags 컬럼이 성공적으로 추가되었습니다.');
    }
  } catch (error) {
    console.error('오류:', error);
  }
}

addTagsColumn();
