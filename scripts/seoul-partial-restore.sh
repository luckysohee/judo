#!/usr/bin/env bash
# NEW_JUDO(Seoul) — public DROP 후 partial restore
#
# 1) NEW_JUDO SQL Editor에서 RUN_seoul_pre_restore.sql 먼저 실행
# 2) export PROJECT_ID='myawdyvnecwpolddswus'
#    export PGPASSWORD='Seoul_DB비밀번호'
#    ./scripts/seoul-partial-restore.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/.supabase-migration-dumps"
HOST="${SEOUL_POOLER_HOST:-aws-1-ap-northeast-2.pooler.supabase.com}"
PROJECT_ID="${PROJECT_ID:-}"

if [[ -z "$PROJECT_ID" || -z "${PGPASSWORD:-}" ]]; then
  echo "❌ PROJECT_ID, PGPASSWORD 필요 (Seoul NEW_JUDO)"
  exit 1
fi

USER="postgres.${PROJECT_ID}"

for f in "${OUT}/mumbai_public.sql" "${OUT}/mumbai_auth_users.sql"; do
  if [[ ! -s "$f" ]]; then
    echo "❌ 없음 또는 0B: $f — 먼저 ./scripts/mumbai-partial-dump.sh"
    exit 1
  fi
done

echo "📥 extensions 확인 (vector, pg_trgm)..."
psql -h "$HOST" -p 5432 -U "$USER" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
SQL

echo "📥 auth users restore (public FK보다 먼저)..."
psql -h "$HOST" -p 5432 -U "$USER" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SET session_replication_role = replica;
TRUNCATE auth.identities, auth.users CASCADE;
SQL
psql -h "$HOST" -p 5432 -U "$USER" -d postgres \
  -v ON_ERROR_STOP=1 \
  -f "${OUT}/mumbai_auth_users.sql"

echo "📥 public restore..."
# pre_restore가 이미 public 스키마를 만들었으므로 dump의 CREATE SCHEMA public 은 제외
# Mumbai는 public.* — Supabase 기본은 extensions.*
sed -e '/^CREATE SCHEMA public;$/d' \
    -e '/^COMMENT ON SCHEMA public IS /d' \
    -e 's/public\.vector/extensions.vector/g' \
    -e 's/public\.vector_cosine_ops/extensions.vector_cosine_ops/g' \
    -e 's/public\.gin_trgm_ops/extensions.gin_trgm_ops/g' \
    -e 's/public\.gist_trgm_ops/extensions.gist_trgm_ops/g' \
    "${OUT}/mumbai_public.sql" | psql -h "$HOST" -p 5432 -U "$USER" -d postgres \
  -v ON_ERROR_STOP=1 \
  -f -

psql -h "$HOST" -p 5432 -U "$USER" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SET session_replication_role = DEFAULT;
SQL

echo "✅ restore 완료 — SQL Editor에서 RUN_tokyo_post_restore.sql 실행"
