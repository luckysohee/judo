-- Home 지도 bbox·카테고리 필터에 맞춘 인덱스 (lat/lng는 numeric 권장)
DROP INDEX IF EXISTS idx_places_lat_lng;

CREATE INDEX IF NOT EXISTS idx_places_lat ON public.places (lat);
CREATE INDEX IF NOT EXISTS idx_places_lng ON public.places (lng);
CREATE INDEX IF NOT EXISTS idx_places_category ON public.places (category);
