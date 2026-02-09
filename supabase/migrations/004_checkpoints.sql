-- ============================================
-- CHECKPOINT TYPE ENUM
-- ============================================
CREATE TYPE checkpoint_type AS ENUM (
    'viewpoint', 'water_source', 'campsite', 'landmark',
    'summit', 'shelter', 'bridge', 'pass', 'lake',
    'waterfall', 'ruins', 'church', 'tower'
);

-- ============================================
-- TRAIL CHECKPOINTS
-- ============================================
CREATE TABLE trail_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    name_en TEXT NOT NULL,
    name_ka TEXT,
    description_en TEXT,
    description_ka TEXT,
    type checkpoint_type NOT NULL DEFAULT 'landmark',
    coordinates GEOMETRY(Point, 4326) NOT NULL,
    elevation_m INT,
    photo_url TEXT,
    sort_order INT DEFAULT 0,
    is_checkable BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checkpoints_trail ON trail_checkpoints(trail_id);
CREATE INDEX idx_checkpoints_coordinates ON trail_checkpoints USING GIST(coordinates);
CREATE INDEX idx_checkpoints_type ON trail_checkpoints(type);

-- ============================================
-- CHECKPOINT COMPLETIONS
-- ============================================
CREATE TABLE checkpoint_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    checkpoint_id UUID NOT NULL REFERENCES trail_checkpoints(id) ON DELETE CASCADE,
    proof_photo_url TEXT NOT NULL,
    photo_lat DECIMAL(10,7),
    photo_lng DECIMAL(10,7),
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, checkpoint_id)
);

CREATE INDEX idx_checkpoint_completions_user ON checkpoint_completions(user_id);
CREATE INDEX idx_checkpoint_completions_checkpoint ON checkpoint_completions(checkpoint_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE trail_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checkpoints are publicly readable"
    ON trail_checkpoints FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage checkpoints"
    ON trail_checkpoints FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

ALTER TABLE checkpoint_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view checkpoint completions"
    ON checkpoint_completions FOR SELECT
    USING (true);

CREATE POLICY "Users can submit their own checkpoint completions"
    ON checkpoint_completions FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE TRIGGER update_checkpoints_updated_at
    BEFORE UPDATE ON trail_checkpoints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
