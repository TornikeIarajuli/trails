-- Migration 025: Show hike photos (trail_photos) for completions in the feed.
-- Falls back to proof_photo_url, then trail cover image (handled client-side).
-- Previously only proof_photo_url was shown for completions.

CREATE OR REPLACE VIEW activity_feed AS

-- Completions (only approved) — prefer most-recent hike photo over proof photo
SELECT
    tc.id AS activity_id,
    'completion'::TEXT AS activity_type,
    tc.user_id,
    tc.trail_id,
    tc.completed_at AS created_at,
    NULL::TEXT AS extra_text,
    COALESCE(
        (SELECT url FROM trail_photos
         WHERE user_id = tc.user_id AND trail_id = tc.trail_id
         ORDER BY taken_at DESC LIMIT 1),
        tc.proof_photo_url
    ) AS photo_url
FROM trail_completions tc
WHERE tc.status = 'approved'

UNION ALL

-- Photos
SELECT
    tp.id AS activity_id,
    'photo'::TEXT AS activity_type,
    tp.user_id,
    tp.trail_id,
    tp.taken_at AS created_at,
    tp.caption AS extra_text,
    tp.url AS photo_url
FROM trail_photos tp

UNION ALL

-- Conditions
SELECT
    tco.id AS activity_id,
    'condition'::TEXT AS activity_type,
    tco.user_id,
    tco.trail_id,
    tco.reported_at AS created_at,
    tco.condition_type::TEXT AS extra_text,
    tco.photo_url AS photo_url
FROM trail_conditions tco
WHERE tco.is_active = true

UNION ALL

-- Reviews
SELECT
    tr.id AS activity_id,
    'review'::TEXT AS activity_type,
    tr.user_id,
    tr.trail_id,
    tr.created_at AS created_at,
    tr.rating::TEXT AS extra_text,
    NULL::TEXT AS photo_url
FROM trail_reviews tr;
