-- 알파 이전·현재 활동 큐레이터 → Studio Pro 부여 (Supabase SQL Editor에서 즉시 실행용)
-- supabase/migrations/20260705170000_grandfather_studio_pro_curators.sql 와 동일

UPDATE public.curators
SET studio_pro_until = timestamptz '2027-12-31 23:59:59+09'
WHERE studio_pro_until IS NULL
   OR studio_pro_until < now();

-- 확인
SELECT user_id, name, username, display_name, studio_pro_until,
       studio_pro_until > now() AS is_pro_now
FROM public.curators
ORDER BY name;
