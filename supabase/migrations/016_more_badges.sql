-- ============================================
-- Migration 016: 6 new badges + updated RPC
-- ============================================

-- Insert 6 new badges
INSERT INTO badges (key, name_en, name_ka, description_en, description_ka, icon, category, threshold, difficulty, region, sort_order)
VALUES
  -- Completion milestones
  ('serial_hiker',   'Serial Hiker',      NULL, 'Complete 50 trails.',                 NULL, 'trophy',   'completions', 50,  NULL,    NULL, 20),
  ('mountain_god',   'Mountain God',      NULL, 'Complete 100 trails.',                NULL, 'rocket',   'completions', 100, NULL,    NULL, 21),

  -- Difficulty achievements
  ('hard_core',      'Hard Core',         NULL, 'Complete 5 hard-difficulty trails.',   NULL, 'flame',    'difficulty',  5,   'hard',  NULL, 22),
  ('peak_bagger',    'Peak Bagger',       NULL, 'Complete 3 ultra-difficulty trails.',  NULL, 'snow',     'difficulty',  3,   'ultra', NULL, 23),

  -- Multi-region explorer (threshold = 4 distinct regions)
  ('all_rounder',    'All Rounder',       NULL, 'Complete trails in 4 different regions.', NULL, 'compass', 'special',  4,   NULL,    NULL, 24),

  -- Streak badge (4 consecutive weeks with ≥1 hike)
  ('streaker',       'Streaker',          NULL, 'Hike for 4 consecutive weeks.',        NULL, 'footsteps','streak',      4,   NULL,    NULL, 25)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Update check_and_award_badges RPC
-- Adds 'streak' category + 'all_rounder' special key
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

            WHEN 'streak' THEN
                -- Count max consecutive ISO weeks with >= 1 completion
                DECLARE
                    v_max_streak INT := 0;
                    v_cur_streak INT := 0;
                    v_prev_week TEXT := NULL;
                    v_cur_week TEXT;
                    v_prev_week_num INT;
                    v_cur_week_num INT;
                    v_prev_year INT;
                    v_cur_year INT;
                BEGIN
                    FOR v_cur_week IN
                        SELECT DISTINCT TO_CHAR(completed_at, 'IYYY-IW') AS iso_week
                        FROM trail_completions
                        WHERE user_id = p_user_id AND status = 'approved'
                        ORDER BY iso_week
                    LOOP
                        IF v_prev_week IS NULL THEN
                            v_cur_streak := 1;
                        ELSE
                            v_prev_year := SPLIT_PART(v_prev_week, '-', 1)::INT;
                            v_cur_year  := SPLIT_PART(v_cur_week,  '-', 1)::INT;
                            v_prev_week_num := SPLIT_PART(v_prev_week, '-', 2)::INT;
                            v_cur_week_num  := SPLIT_PART(v_cur_week,  '-', 2)::INT;
                            IF (v_cur_year = v_prev_year AND v_cur_week_num = v_prev_week_num + 1)
                               OR (v_cur_year = v_prev_year + 1 AND v_prev_week_num >= 52 AND v_cur_week_num = 1)
                            THEN
                                v_cur_streak := v_cur_streak + 1;
                            ELSE
                                v_cur_streak := 1;
                            END IF;
                        END IF;
                        IF v_cur_streak > v_max_streak THEN
                            v_max_streak := v_cur_streak;
                        END IF;
                        v_prev_week := v_cur_week;
                    END LOOP;
                    v_qualifies := v_max_streak >= COALESCE(v_badge.threshold, 4);
                END;

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
                    WHEN 'all_rounder' THEN
                        SELECT COUNT(DISTINCT t.region) INTO v_count
                        FROM trail_completions tc
                        JOIN trails t ON t.id = tc.trail_id
                        WHERE tc.user_id = p_user_id AND tc.status = 'approved';
                        v_qualifies := v_count >= COALESCE(v_badge.threshold, 4);
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
