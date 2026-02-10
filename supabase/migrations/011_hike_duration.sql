-- Migration 011: Store actual hike duration
ALTER TABLE trail_completions ADD COLUMN elapsed_seconds INT;
