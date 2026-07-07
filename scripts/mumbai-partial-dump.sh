#!/usr/bin/env bash
# Mumbai → public 스키마 + auth 로그인 데이터만 dump (Seoul NEW_JUDO restore용)
#
# 사용:
#   export PROJECT_ID='juordxxsjecjmgmbnzox'
#   export PGPASSWORD='Mumbai_DB비밀번호'
#   ./scripts/mumbai-partial-dump.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/.supabase-migration-dumps"
HOST="${MUMBAI_POOLER_HOST:-aws-1-ap-south-1.pooler.supabase.com}"
PROJECT_ID="${PROJECT_ID:-}"

if [[ -z "$PROJECT_ID" || -z "${PGPASSWORD:-}" ]]; then
  echo "❌ PROJECT_ID, PGPASSWORD 필요 (Mumbai)"
  exit 1
fi

USER="postgres.${PROJECT_ID}"
mkdir -p "$OUT"

echo "📦 public schema → ${OUT}/mumbai_public.sql"
pg_dump -h "$HOST" -p 5432 -U "$USER" -d postgres \
  --no-owner --no-acl --schema=public \
  -f "${OUT}/mumbai_public.sql"

echo "📦 auth users → ${OUT}/mumbai_auth_users.sql"
pg_dump -h "$HOST" -p 5432 -U "$USER" -d postgres \
  --no-owner --no-acl --schema=auth --data-only \
  -t auth.users -t auth.identities \
  -f "${OUT}/mumbai_auth_users.sql"

ls -lh "${OUT}/mumbai_public.sql" "${OUT}/mumbai_auth_users.sql"
echo "✅ 완료"
