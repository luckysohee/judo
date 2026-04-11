-- 승급 검토 큐: 등록 장소 수 기준 추천 등급 > 현재 등급일 때 enqueue (관리자 알림용)
-- 수동 등급 변경 시 suggested 이상이면 자동 resolve

CREATE OR REPLACE FUNCTION public.grade_from_place_count(p_count int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_count >= 1000 THEN 'diamond'
    WHEN p_count >= 500 THEN 'platinum'
    WHEN p_count >= 200 THEN 'gold'
    WHEN p_count >= 100 THEN 'silver'
    ELSE 'bronze'
  END;
$$;

CREATE OR REPLACE FUNCTION public.grade_rank(p_grade text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(COALESCE(p_grade, 'bronze')))
    WHEN 'diamond' THEN 4
    WHEN 'platinum' THEN 3
    WHEN 'gold' THEN 2
    WHEN 'silver' THEN 1
    ELSE 0
  END;
$$;

CREATE TABLE IF NOT EXISTS public.curator_grade_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_user_id uuid NOT NULL REFERENCES public.curators (user_id) ON DELETE CASCADE,
  current_grade text NOT NULL DEFAULT 'bronze',
  suggested_grade text NOT NULL,
  total_places_at_trigger int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_action text CHECK (
    resolved_action IS NULL
    OR resolved_action IN ('applied', 'dismissed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS curator_grade_review_open_uidx
  ON public.curator_grade_review_queue (curator_user_id)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS curator_grade_review_unresolved_created_idx
  ON public.curator_grade_review_queue (created_at DESC)
  WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.enqueue_curator_grade_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sug text;
  cur text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.total_places IS NOT DISTINCT FROM OLD.total_places THEN
    RETURN NEW;
  END IF;

  cur := lower(trim(COALESCE(NEW.grade, 'bronze')));
  sug := public.grade_from_place_count(COALESCE(NEW.total_places, 0));

  IF public.grade_rank(sug) <= public.grade_rank(cur) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.curator_grade_review_queue (
    curator_user_id,
    current_grade,
    suggested_grade,
    total_places_at_trigger
  )
  VALUES (
    NEW.user_id,
    cur,
    sug,
    COALESCE(NEW.total_places, 0)
  )
  ON CONFLICT (curator_user_id) WHERE (resolved_at IS NULL)
  DO UPDATE SET
    current_grade = EXCLUDED.current_grade,
    suggested_grade = EXCLUDED.suggested_grade,
    total_places_at_trigger = EXCLUDED.total_places_at_trigger,
    created_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enqueue_curator_grade_review ON public.curators;
CREATE TRIGGER tr_enqueue_curator_grade_review
  AFTER INSERT OR UPDATE OF total_places ON public.curators
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_curator_grade_review();

CREATE OR REPLACE FUNCTION public.resolve_curator_grade_review_on_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.grade IS NOT DISTINCT FROM OLD.grade THEN
    RETURN NEW;
  END IF;

  UPDATE public.curator_grade_review_queue q
  SET
    resolved_at = now(),
    resolved_action = 'applied'
  WHERE q.curator_user_id = NEW.user_id
    AND q.resolved_at IS NULL
    AND public.grade_rank(COALESCE(NEW.grade, 'bronze')) >= public.grade_rank(q.suggested_grade);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_resolve_grade_review_on_grade ON public.curators;
CREATE TRIGGER tr_resolve_grade_review_on_grade
  AFTER UPDATE OF grade ON public.curators
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_curator_grade_review_on_grade();

ALTER TABLE public.curator_grade_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin select curator_grade_review_queue" ON public.curator_grade_review_queue;
CREATE POLICY "Admin select curator_grade_review_queue"
  ON public.curator_grade_review_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin update curator_grade_review_queue" ON public.curator_grade_review_queue;
CREATE POLICY "Admin update curator_grade_review_queue"
  ON public.curator_grade_review_queue
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

GRANT SELECT, UPDATE ON public.curator_grade_review_queue TO authenticated;

COMMENT ON TABLE public.curator_grade_review_queue IS
  '등록 장소 수로 추천 등급이 현재 등급보다 높을 때 관리자 승급 검토 알림';

NOTIFY pgrst, 'reload schema';
