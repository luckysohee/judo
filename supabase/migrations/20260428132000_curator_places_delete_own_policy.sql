-- curator_places 에 RLS가 켜져 있고 DELETE 정책이 없으면, 클라이언트 delete 가 0건만 지워도 오류가 나지 않음.
-- RLS 사용 중일 때만 본인 curator_id 행 삭제 허용.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'curator_places'
      AND c.relrowsecurity
  ) THEN
    EXECUTE $pol$
      DROP POLICY IF EXISTS "curator_places_delete_own" ON public.curator_places;
      CREATE POLICY "curator_places_delete_own"
      ON public.curator_places
      FOR DELETE
      TO authenticated
      USING (auth.uid() = curator_id);
    $pol$;
  END IF;
END $$;
