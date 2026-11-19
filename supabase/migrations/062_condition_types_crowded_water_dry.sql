-- Two more trail condition reports: "crowded" (busy trail or parking) and "water_dry" (a spring,
-- tap or stream on the way has run dry). Existing feed queries cast the type to text, so they
-- pick the new values up as they are.
ALTER TYPE condition_type ADD VALUE IF NOT EXISTS 'crowded';
ALTER TYPE condition_type ADD VALUE IF NOT EXISTS 'water_dry';
