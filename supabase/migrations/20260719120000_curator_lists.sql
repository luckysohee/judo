-- 맛집첩(리스트): 동선 없는 장소 묶음. curator_courses 와 대칭, 순서는 느슨한 정렬용.

CREATE TABLE IF NOT EXISTS public.curator_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id UUID NOT NULL REFERENCES public.curators (user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  area TEXT,
  theme_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'draft',
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT curator_lists_status_check
    CHECK (status IN ('draft', 'published', 'private')),
  CONSTRAINT curator_lists_title_nonempty_check
    CHECK (char_length(trim(title)) > 0),
  CONSTRAINT curator_lists_is_public_implies_published_check
    CHECK (NOT is_public OR status = 'published')
);

COMMENT ON TABLE public.curator_lists IS
  '큐레이터 맛집첩(장소 묶음). 코스와 달리 도보 동선·스탬프 없음. is_public 이면 status=published.';

COMMENT ON COLUMN public.curator_lists.curator_id IS
  'auth 사용자 UUID = public.curators.user_id';

CREATE INDEX IF NOT EXISTS idx_curator_lists_curator_id
  ON public.curator_lists (curator_id);

CREATE INDEX IF NOT EXISTS idx_curator_lists_status_public_created
  ON public.curator_lists (status, is_public, created_at DESC);

CREATE TABLE IF NOT EXISTS public.curator_list_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.curator_lists (id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places (id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT curator_list_places_order_nonnegative_check
    CHECK (order_index >= 0),
  CONSTRAINT curator_list_places_list_place_unique
    UNIQUE (list_id, place_id)
);

COMMENT ON TABLE public.curator_list_places IS
  '맛집첩 내 장소. order_index 는 카드 정렬용(동선 아님). 최대 24곳.';

CREATE INDEX IF NOT EXISTS idx_curator_list_places_list_order
  ON public.curator_list_places (list_id, order_index);

CREATE INDEX IF NOT EXISTS idx_curator_list_places_place_id
  ON public.curator_list_places (place_id);

CREATE OR REPLACE FUNCTION public.curator_list_places_enforce_max_twenty_four()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
DECLARE
  n integer;
BEGIN
  SELECT count(*)::integer INTO n
  FROM public.curator_list_places
  WHERE list_id = NEW.list_id;

  IF n >= 24 THEN
    RAISE EXCEPTION 'curator_list_places: a list may have at most 24 places'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS curator_list_places_enforce_max_twenty_four_trg
  ON public.curator_list_places;
CREATE TRIGGER curator_list_places_enforce_max_twenty_four_trg
  BEFORE INSERT ON public.curator_list_places
  FOR EACH ROW
  EXECUTE FUNCTION public.curator_list_places_enforce_max_twenty_four();

CREATE OR REPLACE FUNCTION public.curator_lists_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS curator_lists_touch_updated_at_trg ON public.curator_lists;
CREATE TRIGGER curator_lists_touch_updated_at_trg
  BEFORE UPDATE ON public.curator_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.curator_lists_touch_updated_at();

ALTER TABLE public.curator_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curator_list_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curator_lists_select_visible" ON public.curator_lists;
CREATE POLICY "curator_lists_select_visible"
  ON public.curator_lists
  FOR SELECT
  TO anon, authenticated
  USING (
    (status = 'published' AND is_public = true)
    OR (
      auth.uid() IS NOT NULL
      AND auth.uid() = curator_id
    )
  );

DROP POLICY IF EXISTS "curator_lists_insert_own_curator" ON public.curator_lists;
CREATE POLICY "curator_lists_insert_own_curator"
  ON public.curator_lists
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = curator_id
    AND EXISTS (
      SELECT 1 FROM public.curators c WHERE c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "curator_lists_update_own" ON public.curator_lists;
CREATE POLICY "curator_lists_update_own"
  ON public.curator_lists
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = curator_id)
  WITH CHECK (
    auth.uid() = curator_id
    AND EXISTS (
      SELECT 1 FROM public.curators c WHERE c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "curator_lists_delete_own" ON public.curator_lists;
CREATE POLICY "curator_lists_delete_own"
  ON public.curator_lists
  FOR DELETE
  TO authenticated
  USING (auth.uid() = curator_id);

DROP POLICY IF EXISTS "curator_list_places_select_visible" ON public.curator_list_places;
CREATE POLICY "curator_list_places_select_visible"
  ON public.curator_list_places
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.curator_lists cl
      WHERE cl.id = list_id
      AND (
        (cl.status = 'published' AND cl.is_public = true)
        OR (
          auth.uid() IS NOT NULL
          AND cl.curator_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "curator_list_places_insert_list_owner" ON public.curator_list_places;
CREATE POLICY "curator_list_places_insert_list_owner"
  ON public.curator_list_places
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.curator_lists cl
      WHERE cl.id = list_id AND cl.curator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "curator_list_places_update_list_owner" ON public.curator_list_places;
CREATE POLICY "curator_list_places_update_list_owner"
  ON public.curator_list_places
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.curator_lists cl
      WHERE cl.id = list_id AND cl.curator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.curator_lists cl
      WHERE cl.id = list_id AND cl.curator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "curator_list_places_delete_list_owner" ON public.curator_list_places;
CREATE POLICY "curator_list_places_delete_list_owner"
  ON public.curator_list_places
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.curator_lists cl
      WHERE cl.id = list_id AND cl.curator_id = auth.uid()
    )
  );

GRANT SELECT ON public.curator_lists TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.curator_lists TO authenticated;
GRANT SELECT ON public.curator_list_places TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.curator_list_places TO authenticated;
