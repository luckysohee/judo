-- Database Cleanup & Security Script
-- Based on codebase analysis and recommendations

-- ==========================================
-- 1. CHECK CURRENT RLS POLICIES (UNRESTRICTED ISSUE)
-- ==========================================

-- Check places table RLS
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  forcerlspolicy
FROM pg_tables 
WHERE tablename = 'places';

-- Check published_maps table RLS  
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  forcerlspolicy
FROM pg_tables 
WHERE tablename = 'published_maps';

-- Check existing RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('places', 'published_maps');

-- ==========================================
-- 2. FIX RLS FOR PLACES (SECURE WRITE, PUBLIC READ)
-- ==========================================

-- Enable RLS if not enabled
ALTER TABLE places ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Places can be viewed by everyone" ON places;
DROP POLICY IF EXISTS "Places can be inserted by authenticated users" ON places;
DROP POLICY IF EXISTS "Places can be updated by owners" ON places;
DROP POLICY IF EXISTS "Places can be deleted by owners" ON places;

-- Create proper RLS policies
CREATE POLICY "Places can be viewed by everyone" ON places
  FOR SELECT USING (true);

CREATE POLICY "Places can be inserted by authenticated users" ON places
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Places can be updated by owners" ON places
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Places can be deleted by owners" ON places  
  FOR DELETE USING (auth.uid() = created_by);

-- ==========================================
-- 3. FIX RLS FOR PUBLISHED_MAPS (OWNER CONTROL)
-- ==========================================

-- Enable RLS if not enabled
ALTER TABLE published_maps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Published maps can be viewed by everyone" ON published_maps;
DROP POLICY IF EXISTS "Published maps can be managed by owners" ON published_maps;

-- Create proper RLS policies
CREATE POLICY "Published maps can be viewed by everyone" ON published_maps
  FOR SELECT USING (true);

CREATE POLICY "Published maps can be managed by owners" ON published_maps
  FOR ALL USING (auth.uid() = curator_id);

-- ==========================================
-- 4. CREATE CHECKINS TABLE (CORE REAL-TIME FEATURE)
-- ==========================================

-- Create checkins table
CREATE TABLE IF NOT EXISTS public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkins_visibility_check 
    CHECK (visibility IN ('public', 'private'))
);

-- Enable RLS for checkins
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for checkins
CREATE POLICY "Checkins can be viewed based on visibility" ON checkins
  FOR SELECT USING (
    visibility = 'public' OR 
    (visibility = 'private' AND auth.uid() = user_id)
  );

CREATE POLICY "Users can create their own checkins" ON checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checkins" ON checkins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checkins" ON checkins
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_checkins_user_id ON checkins(user_id);
CREATE INDEX idx_checkins_place_id ON checkins(place_id);
CREATE INDEX idx_checkins_created_at ON checkins(created_at DESC);
CREATE INDEX idx_checkins_visibility ON checkins(visibility) WHERE visibility = 'public';

-- ==========================================
-- 5. CLEANUP UNUSED TABLES (OPTIONAL - BACKUP FIRST!)
-- ==========================================

-- NOTE: Run these only after backing up data and confirming no usage
-- These tables are not used in the current codebase

-- -- Freeze follows table (rename to indicate deprecated status)
-- ALTER TABLE follows RENAME TO follows_deprecated_2024;

-- -- Freeze curator_live_sessions table (rename to indicate deprecated status)  
-- ALTER TABLE curator_live_sessions RENAME TO curator_live_sessions_deprecated_2024;

-- ==========================================
-- 6. USEFUL VIEWS FOR COMMON QUERIES
-- ==========================================

-- Recent public checkins for place details
CREATE OR REPLACE VIEW recent_place_checkins AS
SELECT 
  p.id as place_id,
  p.name as place_name,
  c.user_id,
  c.created_at,
  pr.nickname as user_nickname,
  pr.avatar_url as user_avatar
FROM checkins c
JOIN places p ON c.place_id = p.id  
JOIN profiles pr ON c.user_id = pr.id
WHERE c.visibility = 'public'
ORDER BY c.created_at DESC;

-- 1시간 이내 핫플레이스 뷰
CREATE OR REPLACE VIEW hot_places_1h AS
SELECT 
    p.id,
    p.name,
    p.address,
    p.region,
    p.lat,
    p.lng,
    p.image,
    p.comment,
    p.tags,
    p.curators,
    p.saved_count,
    COUNT(c.id) as checkin_count,
    COUNT(DISTINCT c.user_id) as unique_visitors,
    MAX(c.created_at) as last_checkin_time
FROM places p
LEFT JOIN checkins c ON p.id = c.place_id 
    AND c.created_at >= NOW() - INTERVAL '1 hour'
    AND c.visibility = 'public'
GROUP BY p.id, p.name, p.address, p.region, p.lat, p.lng, p.image, p.comment, p.tags, p.curators, p.saved_count
HAVING COUNT(c.id) > 0
ORDER BY checkin_count DESC, last_checkin_time DESC;

-- 24시간 이내 핫플레이스 뷰 (기존)
CREATE OR REPLACE VIEW hot_places_24h AS
SELECT 
    p.id,
    p.name,
    p.address,
    p.region,
    p.lat,
    p.lng,
    p.image,
    p.comment,
    p.tags,
    p.curators,
    p.saved_count,
    COUNT(c.id) as checkin_count,
    COUNT(DISTINCT c.user_id) as unique_visitors,
    MAX(c.created_at) as last_checkin_time
FROM places p
LEFT JOIN checkins c ON p.id = c.place_id 
    AND c.created_at >= NOW() - INTERVAL '24 hour'
    AND c.visibility = 'public'
GROUP BY p.id, p.name, p.address, p.region, p.lat, p.lng, p.image, p.comment, p.tags, p.curators, p.saved_count
HAVING COUNT(c.id) > 0
ORDER BY checkin_count DESC, last_checkin_time DESC;

-- ==========================================
-- 7. VERIFICATION QUERIES
-- ==========================================

-- Test RLS policies (run as different users)
-- SELECT * FROM places LIMIT 1;  -- Should work for anyone
-- INSERT INTO places (name, created_by) VALUES ('Test', auth.uid()); -- Should work for authenticated
-- UPDATE places SET name = 'Updated' WHERE id = 'some-id'; -- Should only work for owner

-- Test checkins functionality
-- SELECT * FROM recent_place_checkins LIMIT 5;
-- SELECT * FROM hot_places_24h LIMIT 10;
