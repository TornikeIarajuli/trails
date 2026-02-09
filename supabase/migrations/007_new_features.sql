-- ============================================
-- NEW ENUMS
-- ============================================
CREATE TYPE badge_category AS ENUM ('completions', 'difficulty', 'region', 'streak', 'special');
CREATE TYPE condition_type AS ENUM ('trail_clear', 'muddy', 'snow', 'fallen_tree', 'flooded', 'overgrown', 'damaged', 'closed');
CREATE TYPE severity_level AS ENUM ('info', 'warning', 'danger');

-- ============================================
-- TRAIL BOOKMARKS
-- ============================================
CREATE TABLE trail_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, trail_id)
);

CREATE INDEX idx_bookmarks_user ON trail_bookmarks(user_id);
CREATE INDEX idx_bookmarks_trail ON trail_bookmarks(trail_id);

-- ============================================
-- BADGES (definitions)
-- ============================================
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name_en TEXT NOT NULL,
    name_ka TEXT,
    description_en TEXT NOT NULL,
    description_ka TEXT,
    icon TEXT NOT NULL,
    category badge_category NOT NULL,
    threshold INT,
    region TEXT,
    difficulty trail_difficulty,
    sort_order INT DEFAULT 0
);

-- ============================================
-- USER BADGES (earned)
-- ============================================
CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);

-- ============================================
-- TRAIL CONDITIONS
-- ============================================
CREATE TABLE trail_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    condition_type condition_type NOT NULL,
    severity severity_level NOT NULL DEFAULT 'info',
    description TEXT,
    photo_url TEXT,
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_conditions_trail_active ON trail_conditions(trail_id, is_active);
CREATE INDEX idx_conditions_reported ON trail_conditions(reported_at DESC);

-- ============================================
-- TRAIL PHOTOS (community)
-- ============================================
CREATE TABLE trail_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    caption TEXT,
    taken_at TIMESTAMPTZ DEFAULT NOW(),
    likes_count INT DEFAULT 0
);

CREATE INDEX idx_trail_photos_trail ON trail_photos(trail_id);
CREATE INDEX idx_trail_photos_user ON trail_photos(user_id);

-- ============================================
-- PHOTO LIKES
-- ============================================
CREATE TABLE photo_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES trail_photos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(photo_id, user_id)
);

-- ============================================
-- RPC: Toggle photo like
-- ============================================
CREATE OR REPLACE FUNCTION toggle_photo_like(p_photo_id UUID, p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_exists BOOLEAN;
    v_new_count INT;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM photo_likes WHERE photo_id = p_photo_id AND user_id = p_user_id
    ) INTO v_exists;

    IF v_exists THEN
        DELETE FROM photo_likes WHERE photo_id = p_photo_id AND user_id = p_user_id;
        UPDATE trail_photos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_photo_id;
    ELSE
        INSERT INTO photo_likes (photo_id, user_id) VALUES (p_photo_id, p_user_id);
        UPDATE trail_photos SET likes_count = likes_count + 1 WHERE id = p_photo_id;
    END IF;

    SELECT likes_count INTO v_new_count FROM trail_photos WHERE id = p_photo_id;

    RETURN json_build_object('liked', NOT v_exists, 'likes_count', v_new_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Check and award badges
-- ============================================
CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id UUID)
RETURNS UUID[] AS $$
DECLARE
    v_badge RECORD;
    v_count INT;
    v_qualifies BOOLEAN;
    v_new_badges UUID[] := '{}';
BEGIN
    FOR v_badge IN SELECT * FROM badges LOOP
        v_qualifies := false;

        -- Skip if already earned
        IF EXISTS(SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = v_badge.id) THEN
            CONTINUE;
        END IF;

        CASE v_badge.category
            WHEN 'completions' THEN
                SELECT COUNT(*) INTO v_count
                FROM trail_completions
                WHERE user_id = p_user_id AND status = 'approved';
                v_qualifies := v_count >= COALESCE(v_badge.threshold, 1);

            WHEN 'difficulty' THEN
                SELECT COUNT(*) INTO v_count
                FROM trail_completions tc
                JOIN trails t ON t.id = tc.trail_id
                WHERE tc.user_id = p_user_id
                    AND tc.status = 'approved'
                    AND t.difficulty = v_badge.difficulty;
                v_qualifies := v_count >= COALESCE(v_badge.threshold, 1);

            WHEN 'region' THEN
                SELECT COUNT(*) INTO v_count
                FROM trail_completions tc
                JOIN trails t ON t.id = tc.trail_id
                WHERE tc.user_id = p_user_id
                    AND tc.status = 'approved'
                    AND t.region = v_badge.region;
                v_qualifies := v_count >= COALESCE(v_badge.threshold, 1);

            WHEN 'special' THEN
                CASE v_badge.key
                    WHEN 'photographer' THEN
                        SELECT COUNT(*) INTO v_count
                        FROM trail_photos WHERE user_id = p_user_id;
                        v_qualifies := v_count >= COALESCE(v_badge.threshold, 10);
                    WHEN 'reporter' THEN
                        SELECT COUNT(*) INTO v_count
                        FROM trail_conditions WHERE user_id = p_user_id;
                        v_qualifies := v_count >= COALESCE(v_badge.threshold, 5);
                    WHEN 'bookworm' THEN
                        SELECT COUNT(*) INTO v_count
                        FROM trail_bookmarks WHERE user_id = p_user_id;
                        v_qualifies := v_count >= COALESCE(v_badge.threshold, 10);
                    ELSE
                        v_qualifies := false;
                END CASE;
            ELSE
                v_qualifies := false;
        END CASE;

        IF v_qualifies THEN
            INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, v_badge.id)
            ON CONFLICT DO NOTHING;
            v_new_badges := array_append(v_new_badges, v_badge.id);
        END IF;
    END LOOP;

    RETURN v_new_badges;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Bookmarks
ALTER TABLE trail_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bookmarks"
    ON trail_bookmarks FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own bookmarks"
    ON trail_bookmarks FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own bookmarks"
    ON trail_bookmarks FOR DELETE
    USING (user_id = auth.uid());

-- Badges
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are publicly readable"
    ON badges FOR SELECT
    USING (true);

-- User Badges
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User badges are publicly readable"
    ON user_badges FOR SELECT
    USING (true);

-- Trail Conditions
ALTER TABLE trail_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conditions are publicly readable"
    ON trail_conditions FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own conditions"
    ON trail_conditions FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conditions"
    ON trail_conditions FOR UPDATE
    USING (user_id = auth.uid());

-- Trail Photos
ALTER TABLE trail_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photos are publicly readable"
    ON trail_photos FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own photos"
    ON trail_photos FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own photos"
    ON trail_photos FOR DELETE
    USING (user_id = auth.uid());

-- Photo Likes
ALTER TABLE photo_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes are publicly readable"
    ON photo_likes FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own likes"
    ON photo_likes FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own likes"
    ON photo_likes FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- SEED BADGE DEFINITIONS
-- ============================================
INSERT INTO badges (key, name_en, name_ka, description_en, description_ka, icon, category, threshold, region, difficulty, sort_order) VALUES
-- Completions
('first_trail', 'First Steps', 'პირველი ნაბიჯები', 'Complete your first trail', 'დაასრულეთ თქვენი პირველი ბილიკი', 'footsteps', 'completions', 1, NULL, NULL, 1),
('explorer', 'Explorer', 'მკვლევარი', 'Complete 5 trails', 'დაასრულეთ 5 ბილიკი', 'compass', 'completions', 5, NULL, NULL, 2),
('trailblazer', 'Trailblazer', 'ბილიკის გამკვალავი', 'Complete 10 trails', 'დაასრულეთ 10 ბილიკი', 'flame', 'completions', 10, NULL, NULL, 3),
('legend', 'Legend', 'ლეგენდა', 'Complete 25 trails', 'დაასრულეთ 25 ბილიკი', 'trophy', 'completions', 25, NULL, NULL, 4),
-- Difficulty
('easy_going', 'Easy Going', 'მარტივი', 'Complete 5 easy trails', 'დაასრულეთ 5 მარტივი ბილიკი', 'leaf', 'difficulty', 5, NULL, 'easy', 5),
('summit_seeker', 'Summit Seeker', 'მწვერვალის მაძიებელი', 'Complete 3 hard trails', 'დაასრულეთ 3 რთული ბილიკი', 'flag', 'difficulty', 3, NULL, 'hard', 6),
('ultra_runner', 'Ultra Runner', 'ულტრა მორბენალი', 'Complete an ultra trail', 'დაასრულეთ ულტრა ბილიკი', 'rocket', 'difficulty', 1, NULL, 'ultra', 7),
-- Region
('svaneti_explorer', 'Svaneti Explorer', 'სვანეთის მკვლევარი', 'Complete 3 trails in Svaneti', 'დაასრულეთ 3 ბილიკი სვანეთში', 'snow', 'region', 3, 'Svaneti', NULL, 8),
('tusheti_trekker', 'Tusheti Trekker', 'თუშეთის მოლაშქრე', 'Complete 3 trails in Tusheti', 'დაასრულეთ 3 ბილიკი თუშეთში', 'trail-sign', 'region', 3, 'Tusheti', NULL, 9),
('kakheti_wanderer', 'Kakheti Wanderer', 'კახეთის მოხეტიალე', 'Complete 3 trails in Kakheti', 'დაასრულეთ 3 ბილიკი კახეთში', 'wine', 'region', 3, 'Kakheti', NULL, 10),
-- Special
('photographer', 'Photographer', 'ფოტოგრაფი', 'Upload 10 trail photos', 'ატვირთეთ 10 ბილიკის ფოტო', 'camera', 'special', 10, NULL, NULL, 11),
('reporter', 'Trail Reporter', 'ბილიკის რეპორტიორი', 'Report 5 trail conditions', 'შეატყობინეთ 5 ბილიკის მდგომარეობა', 'megaphone', 'special', 5, NULL, NULL, 12),
('bookworm', 'Collector', 'კოლექციონერი', 'Bookmark 10 trails', 'შეინახეთ 10 ბილიკი', 'bookmark', 'special', 10, NULL, NULL, 13);

-- ============================================
-- UNLOCK ALL BADGES FOR ADMIN USER
-- ============================================
INSERT INTO user_badges (user_id, badge_id)
SELECT u.id, b.id
FROM auth.users u
CROSS JOIN badges b
WHERE u.email = 'tornikeiarajuli@gmail.com'
ON CONFLICT DO NOTHING;
