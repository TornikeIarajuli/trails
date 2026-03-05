-- Migration 030: get_trail_route(uuid) — returns trail route as GeoJSON
-- PostgREST returns geometry columns as raw hex WKB by default.
-- This RPC converts them to readable GeoJSON so the admin panel can
-- render the route on a map without a separate geometry library.

CREATE OR REPLACE FUNCTION get_trail_route(trail_uuid UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT ST_AsGeoJSON(route)::jsonb
  FROM trails
  WHERE id = trail_uuid AND route IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION get_trail_route TO anon, authenticated, service_role;

INSERT INTO schema_migrations (version, description)
VALUES ('030', 'get_trail_route_function')
ON CONFLICT (version) DO NOTHING;
