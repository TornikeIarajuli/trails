-- Efficient RPC to return distinct region names from published trails
CREATE OR REPLACE FUNCTION get_distinct_regions()
RETURNS TABLE(region text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT t.region
  FROM trails t
  WHERE t.is_published = true
    AND t.region IS NOT NULL
  ORDER BY t.region;
$$;
