-- #18: Add missing CHECK constraints and fix products.price type

-- profiles.total_trails_completed >= 0
ALTER TABLE profiles
  ADD CONSTRAINT profiles_total_trails_completed_non_negative
  CHECK (total_trails_completed >= 0);

-- events.max_participants > 0 (when set)
ALTER TABLE events
  ADD CONSTRAINT events_max_participants_positive
  CHECK (max_participants IS NULL OR max_participants > 0);

-- trail_photos.likes_count >= 0
ALTER TABLE trail_photos
  ADD CONSTRAINT trail_photos_likes_count_non_negative
  CHECK (likes_count >= 0);

-- products.price: convert TEXT → DECIMAL (strip currency symbol ₾ first)
ALTER TABLE products
  ALTER COLUMN price TYPE DECIMAL(10, 2)
  USING regexp_replace(price, '[^0-9.]', '', 'g')::DECIMAL(10, 2);

-- Ensure price is positive
ALTER TABLE products
  ADD CONSTRAINT products_price_positive
  CHECK (price > 0);
