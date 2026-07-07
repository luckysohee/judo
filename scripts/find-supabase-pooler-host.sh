#!/usr/bin/env bash
# Supabase pooler 호스트 찾기 — tenant not found = 보통 aws-N 클러스터 불일치
#
# 사용:
#   export PROJECT_ID='your_project_ref'
#   export PGPASSWORD='DB비밀번호'
#   ./scripts/find-supabase-pooler-host.sh ap-northeast-2

set -euo pipefail

REGION="${1:-ap-south-1}"
PROJECT_ID="${PROJECT_ID:-}"
LAST_ERR=""

if [[ -z "$PROJECT_ID" || -z "${PGPASSWORD:-}" ]]; then
  echo "❌ PROJECT_ID, PGPASSWORD 환경변수 필요"
  echo "   export PROJECT_ID='juordxxsjecjmgmbnzox'"
  echo "   export PGPASSWORD='...'"
  exit 1
fi

USER="postgres.${PROJECT_ID}"
echo "Project: ${PROJECT_ID}"
echo "Region:  ${REGION}"
echo ""

for n in 0 1 2 3 4 5; do
  HOST="aws-${n}-${REGION}.pooler.supabase.com"
  echo "── trying ${HOST}:5432 ..."
  ERR_FILE="$(mktemp)"
  if psql -h "$HOST" -p 5432 -U "$USER" -d postgres -c "select 1 as ok;" 2>"$ERR_FILE" | grep -q "1 row"; then
    rm -f "$ERR_FILE"
    echo ""
    echo "✅ 성공! 이 호스트를 쓰세요:"
    echo "   HOST=${HOST}"
    echo ""
    echo "pg_dump / psql 예시:"
    echo "  -h ${HOST} -p 5432 -U ${USER} -d postgres"
    exit 0
  fi
  LAST_ERR="$(cat "$ERR_FILE" | tail -3)"
  rm -f "$ERR_FILE"
  if [[ -n "$LAST_ERR" ]]; then
    echo "   ${LAST_ERR}"
  else
    echo "   (실패)"
  fi
done

echo ""
echo "❌ aws-0~5 모두 실패."
echo ""
echo "체크리스트:"
echo "  1) PROJECT_ID = Settings → API → Project URL 의 xxx (NEW_JUDO 것 맞는지)"
echo "  2) PGPASSWORD = 그 프로젝트 DB 비밀번호 (Mumbai 비번 아님)"
echo "  3) Settings → General → Region 이 ${REGION} 맞는지"
echo "  4) 프로젝트가 아직 Creating 이면 2~3분 후 재시도"
echo ""
echo "대시보드: 프로젝트 홈 → Connect → Session mode → Host 복사"
