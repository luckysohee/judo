-- 공개 "픽" (폴더 저장·한잔함과 분리). 큐레이터/일반 유저 동일 동작, is_curator 로만 구분.

CREATE TABLE IF NOT EXISTS public.place_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places (id) ON DELETE CASCADE,
  is_curator BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT place_picks_user_place_unique UNIQUE (user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_place_picks_place_id
  ON public.place_picks (place_id);

CREATE INDEX IF NOT EXISTS idx_place_picks_user_created
  ON public.place_picks (user_id, created_at DESC);

COMMENT ON TABLE public.place_picks IS
  '공개 픽(중복 불가: user+place). 폴더 저장과 무관. is_curator=해당 시점 curators.user_id 존재 여부.';

COMMENT ON COLUMN public.place_picks.is_curator IS
  'INSERT 시점에 public.curators 에 user_id 가 있으면 true (노출·가중치는 앱/배치에서 구분).';

-- INSERT 시 is_curator 자동 세팅 (클라이언트가 값을 내도 트리거가 덮어씀)
CREATE OR REPLACE FUNCTION public.place_picks_set_is_curator_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  NEW.is_curator := EXISTS (
    SELECT 1 FROM public.curators c WHERE c.user_id = NEW.user_id
  );
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS place_picks_set_is_curator_trg ON public.place_picks;
CREATE TRIGGER place_picks_set_is_curator_trg
  BEFORE INSERT ON public.place_picks
  FOR EACH ROW
  EXECUTE FUNCTION public.place_picks_set_is_curator_before_insert();

CREATE OR REPLACE FUNCTION public.place_picks_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS place_picks_touch_updated_at_trg ON public.place_picks;
CREATE TRIGGER place_picks_touch_updated_at_trg
  BEFORE UPDATE ON public.place_picks
  FOR EACH ROW
  EXECUTE FUNCTION public.place_picks_touch_updated_at();

ALTER TABLE public.place_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "place_picks_select_public" ON public.place_picks;
CREATE POLICY "place_picks_select_public"
  ON public.place_picks
  FOR SELECT
  USING (true);

COMMENT ON POLICY "place_picks_select_public" ON public.place_picks IS
  '비로그인 포함 전역 조회(공개 픽).';

DROP POLICY IF EXISTS "place_picks_insert_own" ON public.place_picks;
CREATE POLICY "place_picks_insert_own"
  ON public.place_picks
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "place_picks_delete_own" ON public.place_picks;
CREATE POLICY "place_picks_delete_own"
  ON public.place_picks
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON TABLE public.place_picks TO anon, authenticated;
GRANT INSERT, DELETE ON TABLE public.place_picks TO authenticated;

-- 한 번의 왕복으로 집계 (RLS: 공개 SELECT 와 동일하게 전체 행 카운트)
CREATE OR REPLACE FUNCTION public.get_place_pick_summary(p_place_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $func$
  SELECT jsonb_build_object(
    'total_count', (SELECT count(*)::int FROM public.place_picks pp WHERE pp.place_id = p_place_id),
    'curator_pick_count',
      (SELECT count(*)::int FROM public.place_picks pp WHERE pp.place_id = p_place_id AND pp.is_curator = true),
    'user_pick_count',
      (SELECT count(*)::int FROM public.place_picks pp WHERE pp.place_id = p_place_id AND pp.is_curator = false)
  );
$func$;

COMMENT ON FUNCTION public.get_place_pick_summary(uuid) IS
  '장소별 픽 수 집계(공개). PostgREST RPC 또는 서비스에서 호출.';

REVOKE ALL ON FUNCTION public.get_place_pick_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_place_pick_summary(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
