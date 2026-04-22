-- CrewAI 등 에이전트 스테이징: 큐레이션 본문을 임시 적재 후 places 등으로 머지
-- 클라이언트 직접 접근 없음 — 서비스 롤(백엔드 워커)만 INSERT 권장
--
-- 기존에 대시보드로 만든 place_import_tmp가 있으면 CREATE는 스킵되므로,
-- 아래 ADD COLUMN IF NOT EXISTS로 컬럼을 보강한 뒤 COMMENT를 적용한다.

BEGIN;

CREATE TABLE IF NOT EXISTS public.place_import_tmp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  location text,
  content text,
  category text,
  curator_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS curator_id text;
ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.place_import_tmp SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE public.place_import_tmp ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.place_import_tmp ALTER COLUMN created_at SET NOT NULL;

COMMENT ON TABLE public.place_import_tmp IS
  '큐레이션 임포트 스테이징. 에이전트 출력 검증 후 places 등 정식 테이블로 반영.';

COMMENT ON COLUMN public.place_import_tmp.title IS
  '큐레이션 제목 (예: 성수동 데이트/2차 큐레이션)';
COMMENT ON COLUMN public.place_import_tmp.location IS
  '지역명 — 필터링용 (예: 성수동, 을지로)';
COMMENT ON COLUMN public.place_import_tmp.content IS
  '상세 큐레이션 본문 — 에이전트 생성 긴 글';
COMMENT ON COLUMN public.place_import_tmp.category IS
  '업종 구분 (예: bar, nopo)';
COMMENT ON COLUMN public.place_import_tmp.curator_id IS
  '작성자 식별자 (예: judo_ai)';
COMMENT ON COLUMN public.place_import_tmp.created_at IS
  '생성 시각 (UTC 기본 now())';

ALTER TABLE public.place_import_tmp ENABLE ROW LEVEL SECURITY;

-- anon/authenticated: 정책 없음 → PostgREST로는 접근 불가
-- 백엔드는 service_role 키 사용(RLS 우회). 필요 시 SELECT/INSERT 정책만 별도 추가

NOTIFY pgrst, 'reload schema';

COMMIT;
