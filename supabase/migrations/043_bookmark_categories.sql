-- Migration 043: Add note and category to bookmarks
-- Allows users to organize saved trails into categories with optional notes

ALTER TABLE trail_bookmarks
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'saved'
    CHECK (category IN ('saved', 'want_to_hike', 'in_progress', 'favorites')),
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_trail_bookmarks_category
  ON trail_bookmarks (user_id, category);
