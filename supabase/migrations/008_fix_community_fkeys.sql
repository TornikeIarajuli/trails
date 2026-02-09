-- ============================================
-- FIX: Change trail_conditions and trail_photos
-- user_id FK from auth.users(id) to profiles(id)
-- so PostgREST can resolve the profiles:user_id join
-- ============================================

-- trail_conditions: drop old FK, add new one pointing to profiles
ALTER TABLE trail_conditions
    DROP CONSTRAINT trail_conditions_user_id_fkey,
    ADD CONSTRAINT trail_conditions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- trail_photos: drop old FK, add new one pointing to profiles
ALTER TABLE trail_photos
    DROP CONSTRAINT trail_photos_user_id_fkey,
    ADD CONSTRAINT trail_photos_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
