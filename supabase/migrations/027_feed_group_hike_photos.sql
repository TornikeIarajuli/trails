-- Migration 027: Group hike photos under their completion in the feed.
-- Photos taken during a hike (trail_photos with a matching approved completion)
-- are no longer shown as separate feed items — they are embedded as a JSON array
-- on the completion row. Standalone photo uploads (no completion for that trail)
-- still appear as individual photo entries.

CREATE OR REPLACE VIEW activity_feed AS

-- Completions: include all hike photo URLs as a JSON array (most recent first)
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
    ) AS photo_url,
    (SELECT jsonb_agg(url ORDER BY taken_at DESC)
     FROM trail_photos
     WHERE user_id = tc.user_id AND trail_id = tc.trail_id
    ) AS photo_urls
FROM trail_completions tc
WHERE tc.status = 'approved'

UNION ALL

-- Photos: only when user has NO approved completion for that trail
SELECT
    tp.id AS activity_id,
    'photo'::TEXT AS activity_type,
    tp.user_id,
    tp.trail_id,
    tp.taken_at AS created_at,
    tp.caption AS extra_text,
    tp.url AS photo_url,
    NULL::JSONB AS photo_urls
FROM trail_photos tp
WHERE NOT EXISTS (
    SELECT 1 FROM trail_completions tc
    WHERE tc.user_id = tp.user_id
      AND tc.trail_id = tp.trail_id
      AND tc.status = 'approved'
)

UNION ALL

-- Conditions
SELECT
    tco.id AS activity_id,
    'condition'::TEXT AS activity_type,
    tco.user_id,
    tco.trail_id,
    tco.reported_at AS created_at,
    tco.condition_type::TEXT AS extra_text,
    tco.photo_url AS photo_url,
    NULL::JSONB AS photo_urls
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
    NULL::TEXT AS photo_url,
    NULL::JSONB AS photo_urls
FROM trail_reviews tr;

-- Drop and recreate because return type changed (added photo_urls column)
DROP FUNCTION IF EXISTS get_activity_feed(uuid, integer, integer);

CREATE OR REPLACE FUNCTION get_activity_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    activity_id UUID,
    activity_type TEXT,
    user_id UUID,
    trail_id UUID,
    created_at TIMESTAMPTZ,
    extra_text TEXT,
    photo_url TEXT,
    photo_urls JSONB,
    user_username TEXT,
    user_full_name TEXT,
    user_avatar_url TEXT,
    trail_name_en TEXT,
    trail_name_ka TEXT,
    trail_cover_image_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        af.activity_id,
        af.activity_type,
        af.user_id,
        af.trail_id,
        af.created_at,
        af.extra_text,
        af.photo_url,
        af.photo_urls,
        p.username AS user_username,
        p.full_name AS user_full_name,
        p.avatar_url AS user_avatar_url,
        t.name_en AS trail_name_en,
        t.name_ka AS trail_name_ka,
        t.cover_image_url AS trail_cover_image_url
    FROM activity_feed af
    INNER JOIN profiles p ON p.id = af.user_id
    INNER JOIN trails t ON t.id = af.trail_id
    WHERE af.user_id = p_user_id
       OR EXISTS (
           SELECT 1 FROM user_follows uf
           WHERE uf.follower_id = p_user_id AND uf.following_id = af.user_id
       )
    ORDER BY af.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
