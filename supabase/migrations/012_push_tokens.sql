-- Push notification tokens
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'expo', -- 'expo', 'apns', 'fcm'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tokens"
    ON push_tokens FOR ALL
    USING (user_id = auth.uid());

-- Index for looking up tokens by user
CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);

-- Badge progress helper: get user completion stats
CREATE OR REPLACE FUNCTION get_badge_progress(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_completions', (
            SELECT COUNT(*) FROM trail_completions
            WHERE user_id = p_user_id AND status = 'approved'
        ),
        'completions_by_difficulty', (
            SELECT COALESCE(json_object_agg(sub.difficulty, sub.cnt), '{}')
            FROM (
                SELECT t.difficulty, COUNT(*) as cnt
                FROM trail_completions tc
                JOIN trails t ON t.id = tc.trail_id
                WHERE tc.user_id = p_user_id AND tc.status = 'approved'
                GROUP BY t.difficulty
            ) sub
        ),
        'completions_by_region', (
            SELECT COALESCE(json_object_agg(sub.region, sub.cnt), '{}')
            FROM (
                SELECT t.region, COUNT(*) as cnt
                FROM trail_completions tc
                JOIN trails t ON t.id = tc.trail_id
                WHERE tc.user_id = p_user_id AND tc.status = 'approved'
                GROUP BY t.region
            ) sub
        ),
        'unique_regions', (
            SELECT COUNT(DISTINCT t.region)
            FROM trail_completions tc
            JOIN trails t ON t.id = tc.trail_id
            WHERE tc.user_id = p_user_id AND tc.status = 'approved'
        )
    ) INTO result;

    RETURN result;
END;
$$;
