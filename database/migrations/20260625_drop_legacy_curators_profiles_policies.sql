-- curators / profiles: Supabase 대시보드에서 만든 레거시 정책이 OR 로 남아 있으면
-- 새 RLS 정책이 전부 무효화됨 (Anyone can insert/update/delete 등).
-- 안전한 정책만 남기고 레거시 이름을 일괄 제거한다.

-- ── curators: 레거시 전부 제거 ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all operations on curators" ON public.curators;
DROP POLICY IF EXISTS "Anyone can delete curator profiles" ON public.curators;
DROP POLICY IF EXISTS "Anyone can insert curator profiles" ON public.curators;
DROP POLICY IF EXISTS "Anyone can update curator profiles" ON public.curators;
DROP POLICY IF EXISTS "Anyone can view curator profiles" ON public.curators;
DROP POLICY IF EXISTS "Anyone can view curators" ON public.curators;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.curators;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.curators;
DROP POLICY IF EXISTS "allow insert curators" ON public.curators;
DROP POLICY IF EXISTS "allow select curators" ON public.curators;
DROP POLICY IF EXISTS "Curators can update own row" ON public.curators;
DROP POLICY IF EXISTS "Admins can update curator grade and status" ON public.curators;

-- ── profiles: judo_* 와 중복되는 대시보드 레거시 ───────────────────────────
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

NOTIFY pgrst, 'reload schema';
