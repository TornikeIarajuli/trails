-- ============================================
-- RPC: Find nearby trails
-- ============================================
CREATE OR REPLACE FUNCTION find_nearby_trails(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_m DOUBLE PRECISION DEFAULT 50000
)
RETURNS TABLE (
    id UUID,
    name_en TEXT,
    name_ka TEXT,
    difficulty trail_difficulty,
    region TEXT,
    distance_km DECIMAL,
    elevation_gain_m INT,
    estimated_hours DECIMAL,
    cover_image_url TEXT,
    distance_from_user_m DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
    SELECT
        t.id,
        t.name_en,
        t.name_ka,
        t.difficulty,
        t.region,
        t.distance_km,
        t.elevation_gain_m,
        t.estimated_hours,
        t.cover_image_url,
        ST_Distance(
            t.start_point::geography,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        ) AS distance_from_user_m
    FROM trails t
    WHERE t.is_published = true
      AND t.start_point IS NOT NULL
      AND ST_DWithin(
          t.start_point::geography,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
          radius_m
      )
    ORDER BY distance_from_user_m ASC;
$$;

-- ============================================
-- RPC: Calculate distance from photo GPS to trail endpoint
-- ============================================
CREATE OR REPLACE FUNCTION distance_to_trail_endpoint(
    p_trail_id UUID,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql STABLE
AS $$
    SELECT ST_Distance(
        t.end_point::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )
    FROM trails t
    WHERE t.id = p_trail_id
      AND t.end_point IS NOT NULL;
$$;

-- ============================================
-- RPC: Increment user trail completion count
-- ============================================
CREATE OR REPLACE FUNCTION increment_trail_count(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
    UPDATE profiles
    SET total_trails_completed = total_trails_completed + 1
    WHERE id = p_user_id;
$$;
