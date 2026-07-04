-- supabase/migrations/20260704140000_user_taste_preferences_ops_fields.sql 와 동일
ALTER TABLE public.user_taste_preferences
  ADD COLUMN IF NOT EXISTS drink_frequency text,
  ADD COLUMN IF NOT EXISTS drink_capacity text,
  ADD COLUMN IF NOT EXISTS budget_per_person text,
  ADD COLUMN IF NOT EXISTS out_time text,
  ADD COLUMN IF NOT EXISTS anju_styles text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.user_taste_preferences.drink_frequency IS
  '음주 빈도: rarely | monthly | biweekly | weekly | multi_weekly';
COMMENT ON COLUMN public.user_taste_preferences.drink_capacity IS
  '주량: light | moderate | heavy | varies';
COMMENT ON COLUMN public.user_taste_preferences.budget_per_person IS
  '1인당 예산: under_30k | 30_50k | 50_80k | 80k_plus';
COMMENT ON COLUMN public.user_taste_preferences.out_time IS
  '외출 시간대: early | prime | late | flexible';
COMMENT ON COLUMN public.user_taste_preferences.anju_styles IS
  '안주 선호: meal | light | share_plate | dessert_after 등';

NOTIFY pgrst, 'reload schema';
