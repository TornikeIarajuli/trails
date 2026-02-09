-- ============================================
-- RPC: Distance from photo GPS to checkpoint
-- ============================================
CREATE OR REPLACE FUNCTION distance_to_checkpoint(
    p_checkpoint_id UUID,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql STABLE
AS $$
    SELECT ST_Distance(
        c.coordinates::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )
    FROM trail_checkpoints c
    WHERE c.id = p_checkpoint_id;
$$;

-- ============================================
-- RPC: Get checkpoints near a location
-- ============================================
CREATE OR REPLACE FUNCTION find_nearby_checkpoints(
    p_trail_id UUID,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_radius_m DOUBLE PRECISION DEFAULT 300
)
RETURNS TABLE (
    id UUID,
    name_en TEXT,
    name_ka TEXT,
    type checkpoint_type,
    is_checkable BOOLEAN,
    distance_m DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
    SELECT
        c.id,
        c.name_en,
        c.name_ka,
        c.type,
        c.is_checkable,
        ST_Distance(
            c.coordinates::geography,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        ) AS distance_m
    FROM trail_checkpoints c
    WHERE c.trail_id = p_trail_id
      AND ST_DWithin(
          c.coordinates::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          p_radius_m
      )
    ORDER BY distance_m ASC;
$$;
