#!/usr/bin/env bash
# Mumbai(ap-south-1) → Tokyo(ap-northeast-1) Supabase 이전
#
# 사전 준비:
#   brew install supabase/tap/supabase   # 또는 npm i -g supabase
#   Supabase 대시보드 → Mumbai 프로젝트 → Settings → Database → connection string (URI)
#
# 사용:
#   export OLD_DB_URL='postgresql://postgres.[ref]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
#   export NEW_DB_URL='postgresql://postgres.[ref]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'
#   ./scripts/migrate-supabase-to-tokyo.sh
#
# ⚠️ 알파 중 downtime 10~20분 예상. 완료 후 Vercel/Railway env 교체 필수.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUMP_DIR="${ROOT}/.supabase-migration-dumps"
STAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="${DUMP_DIR}/judo_mumbai_${STAMP}.sql"

if ! command -v supabase >/dev/null 2>&1; then
  echo "❌ supabase CLI 없음. 설치: brew install supabase/tap/supabase"
  exit 1
fi

if [[ -z "${OLD_DB_URL:-}" || -z "${NEW_DB_URL:-}" ]]; then
  echo "❌ OLD_DB_URL, NEW_DB_URL 환경변수 필요"
  echo ""
  echo "Mumbai (OLD): Settings → Database → Connection string → URI (Session pooler 6543)"
  echo "Tokyo  (NEW): 새 프로젝트 생성 후 동일"
  exit 1
fi

mkdir -p "$DUMP_DIR"

echo "📦 1/3 Mumbai DB dump → ${DUMP_FILE}"
supabase db dump --db-url "$OLD_DB_URL" \
  -f "$DUMP_FILE" \
  --data-only=false \
  --use-copy

echo ""
echo "📥 2/3 Tokyo DB restore (스키마+데이터)"
echo "    ⚠️ 새 Tokyo 프로젝트는 비어 있어야 합니다 (방금 생성 직후)"
read -r -p "Tokyo 프로젝트가 비어 있고 restore 진행할까요? [y/N] " ok
if [[ "${ok,,}" != "y" ]]; then
  echo "중단. dump 파일: $DUMP_FILE"
  exit 0
fi

psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$DUMP_FILE"

echo ""
echo "✅ 3/3 DB restore 완료"
echo ""
echo "── 수동으로 해야 할 것 ──"
echo "1. Supabase Tokyo → Authentication → URL Configuration"
echo "   Site URL: https://judo-six.vercel.app (또는 실제 도메인)"
echo "   Redirect URLs: 기존 Mumbai와 동일하게 복사"
echo ""
echo "2. Authentication → Providers → Google/Kakao client id/secret 재입력"
echo ""
echo "3. Storage → buckets 재생성 (Mumbai와 동일 이름·public 정책)"
echo "   - 큐레이터 장소 사진 bucket 확인: src/utils/curatorPlacePhotos.js"
echo ""
echo "4. Storage 파일: Mumbai에서 다운로드 → Tokyo 업로드 (또는 알파면 재업로드)"
echo ""
echo "5. Vercel Environment Variables 교체:"
echo "   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY"
echo ""
echo "6. Railway Variables 교체:"
echo "   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
echo ""
echo "7. Vercel Redeploy + Railway redeploy"
echo ""
echo "8. Mumbai 프로젝트는 1~2주 뒤 pause/delete (Tokyo 검증 후)"
echo ""
echo "dump 보관: $DUMP_FILE"
