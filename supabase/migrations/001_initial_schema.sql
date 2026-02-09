-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Difficulty enum
CREATE TYPE trail_difficulty AS ENUM ('easy', 'medium', 'hard', 'ultra');

-- Media type enum
CREATE TYPE media_type AS ENUM ('photo', 'video');

-- Completion status enum
CREATE TYPE completion_status AS ENUM ('pending', 'approved', 'rejected');

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    total_trails_completed INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================
-- TRAILS
-- ============================================
CREATE TABLE trails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en TEXT NOT NULL,
    name_ka TEXT,
    description_en TEXT,
    description_ka TEXT,
    difficulty trail_difficulty NOT NULL DEFAULT 'easy',
    region TEXT NOT NULL,
    distance_km DECIMAL(6,2),
    elevation_gain_m INT,
    estimated_hours DECIMAL(4,1),
    route GEOMETRY(LineString, 4326),
    start_point GEOMETRY(Point, 4326),
    end_point GEOMETRY(Point, 4326),
    start_address TEXT,
    gpx_file_url TEXT,
    cover_image_url TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trails_difficulty ON trails(difficulty);
CREATE INDEX idx_trails_region ON trails(region);
CREATE INDEX idx_trails_published ON trails(is_published);
CREATE INDEX idx_trails_start_point ON trails USING GIST(start_point);
CREATE INDEX idx_trails_route ON trails USING GIST(route);

-- ============================================
-- TRAIL MEDIA
-- ============================================
CREATE TABLE trail_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    type media_type NOT NULL DEFAULT 'photo',
    url TEXT NOT NULL,
    caption TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trail_media_trail ON trail_media(trail_id);

-- ============================================
-- TRAIL COMPLETIONS
-- ============================================
CREATE TABLE trail_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    proof_photo_url TEXT NOT NULL,
    photo_lat DECIMAL(10,7),
    photo_lng DECIMAL(10,7),
    status completion_status DEFAULT 'pending',
    reviewer_note TEXT,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, trail_id)
);

CREATE INDEX idx_completions_user ON trail_completions(user_id);
CREATE INDEX idx_completions_trail ON trail_completions(trail_id);
CREATE INDEX idx_completions_status ON trail_completions(status);

-- ============================================
-- TRAIL REVIEWS
-- ============================================
CREATE TABLE trail_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, trail_id)
);

CREATE INDEX idx_reviews_trail ON trail_reviews(trail_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Trails RLS
ALTER TABLE trails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published trails are publicly readable"
    ON trails FOR SELECT
    USING (is_published = true);

CREATE POLICY "Admins can manage trails"
    ON trails FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Trail Media RLS
ALTER TABLE trail_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trail media is publicly readable"
    ON trail_media FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage trail media"
    ON trail_media FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Trail Completions RLS
ALTER TABLE trail_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approved completions"
    ON trail_completions FOR SELECT
    USING (status = 'approved' OR user_id = auth.uid());

CREATE POLICY "Users can submit their own completions"
    ON trail_completions FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Trail Reviews RLS
ALTER TABLE trail_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are publicly readable"
    ON trail_reviews FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own reviews"
    ON trail_reviews FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reviews"
    ON trail_reviews FOR UPDATE
    USING (user_id = auth.uid());

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_trails_updated_at
    BEFORE UPDATE ON trails
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
