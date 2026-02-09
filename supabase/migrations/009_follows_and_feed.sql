-- ============================================
-- USER FOLLOWS
-- ============================================
CREATE TABLE user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_follows_following ON user_follows(following_id);

-- ============================================
-- ACTIVITY FEED VIEW
-- ============================================
CREATE OR REPLACE VIEW activity_feed AS

-- Completions (only approved)
SELECT
    tc.id AS activity_id,
    'completion'::TEXT AS activity_type,
    tc.user_id,
    tc.trail_id,
    tc.completed_at AS created_at,
    NULL::TEXT AS extra_text,
    tc.proof_photo_url AS photo_url
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

-- ============================================
-- RPC: Get activity feed for a user
-- ============================================
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
        p.username AS user_username,
        p.full_name AS user_full_name,
        p.avatar_url AS user_avatar_url,
        t.name_en AS trail_name_en,
        t.name_ka AS trail_name_ka,
        t.cover_image_url AS trail_cover_image_url
    FROM activity_feed af
    INNER JOIN user_follows uf ON uf.following_id = af.user_id AND uf.follower_id = p_user_id
    INNER JOIN profiles p ON p.id = af.user_id
    INNER JOIN trails t ON t.id = af.trail_id
    ORDER BY af.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Get activity feed count
-- ============================================
CREATE OR REPLACE FUNCTION get_activity_feed_count(p_user_id UUID)
RETURNS BIGINT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM activity_feed af
        INNER JOIN user_follows uf ON uf.following_id = af.user_id AND uf.follower_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are publicly readable"
    ON user_follows FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own follows"
    ON user_follows FOR INSERT
    WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can delete own follows"
    ON user_follows FOR DELETE
    USING (follower_id = auth.uid());
