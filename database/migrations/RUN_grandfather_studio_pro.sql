-- Supabase SQL Editor 즉시 실행용

UPDATE public.curators
SET studio_pro_until = timestamptz '2027-12-31 23:59:59+09'
WHERE studio_pro_until IS NULL
   OR studio_pro_until < now();

SELECT user_id, name, username, display_name, studio_pro_until,
       studio_pro_until > now() AS is_pro_now
FROM public.curators
ORDER BY name;
