-- places / curator_places: relrowsecurity=false → 누구나 쓰기 가능했음
-- 지도·카드는 SELECT 공개, 쓰기는 authenticated(본인 curator_places) / admin 삭제만

-- ═══════════════════════════════════════════════════════════════════════════
-- places
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "places_select_public" ON public.places;
CREATE POLICY "places_select_public"
  ON public.places
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "places_insert_authenticated" ON public.places;
CREATE POLICY "places_insert_authenticated"
  ON public.places
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "places_update_authenticated" ON public.places;
CREATE POLICY "places_update_authenticated"
  ON public.places
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: 클라이언트 직접 삭제 금지 (RPC·service_role 만)
DROP POLICY IF EXISTS "places_delete_admin" ON public.places;
CREATE POLICY "places_delete_admin"
  ON public.places
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- curator_places (RLS OFF 였을 때 delete_own 정책이 안 붙었을 수 있음 → 전부 재생성)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.curator_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curator_places_select_public" ON public.curator_places;
CREATE POLICY "curator_places_select_public"
  ON public.curator_places
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "curator_places_insert_own" ON public.curator_places;
CREATE POLICY "curator_places_insert_own"
  ON public.curator_places
  FOR INSERT
  TO authenticated
  WITH CHECK (curator_id = auth.uid());

DROP POLICY IF EXISTS "curator_places_update_own" ON public.curator_places;
CREATE POLICY "curator_places_update_own"
  ON public.curator_places
  FOR UPDATE
  TO authenticated
  USING (curator_id = auth.uid())
  WITH CHECK (curator_id = auth.uid());

DROP POLICY IF EXISTS "curator_places_delete_own" ON public.curator_places;
CREATE POLICY "curator_places_delete_own"
  ON public.curator_places
  FOR DELETE
  TO authenticated
  USING (curator_id = auth.uid());

DROP POLICY IF EXISTS "curator_places_delete_admin" ON public.curator_places;
CREATE POLICY "curator_places_delete_admin"
  ON public.curator_places
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
