-- Migration 024: Include user's own activity in their feed
-- Previously the feed only showed activity from people the user follows.
-- Now it includes the user's own completions and reviews as well.

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

CREATE OR REPLACE FUNCTION get_activity_feed_count(p_user_id UUID)
RETURNS BIGINT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM activity_feed af
        WHERE af.user_id = p_user_id
           OR EXISTS (
               SELECT 1 FROM user_follows uf
               WHERE uf.follower_id = p_user_id AND uf.following_id = af.user_id
           )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
