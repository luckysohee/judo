-- 알파 이전·현재 활동 큐레이터 → Studio Pro 부여
-- 이 마이그레이션 적용 **이후** 새로 승인되는 큐레이터는 studio_pro_until NULL → AI 코스 초안 월 5회

-- Pro 만료일 (초기 멤버 — 2027년 말까지)
DO $$
DECLARE
  v_pro_until timestamptz := timestamptz '2027-12-31 23:59:59+09';
  v_updated integer;
BEGIN
  UPDATE public.curators
  SET studio_pro_until = v_pro_until
  WHERE studio_pro_until IS NULL
     OR studio_pro_until < now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'grandfather_studio_pro: updated % curator(s)', v_updated;
END $$;

COMMENT ON COLUMN public.curators.studio_pro_until IS
  'Studio Pro 만료. NULL/과거=무료(AI 코스 초안 월 5회). 알파 이전 기존 큐레이터는 grandfather 마이그레이션으로 Pro 부여.';

NOTIFY pgrst, 'reload schema';
