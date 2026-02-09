-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Trail media bucket (photos, videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('trail-media', 'trail-media', true)
ON CONFLICT DO NOTHING;

-- Proof photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-photos', 'proof-photos', true)
ON CONFLICT DO NOTHING;

-- Storage policies: trail-media
CREATE POLICY "Trail media is publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'trail-media');

CREATE POLICY "Authenticated users can upload trail media"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'trail-media'
        AND auth.role() = 'authenticated'
    );

-- Storage policies: proof-photos
CREATE POLICY "Proof photos are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'proof-photos');

CREATE POLICY "Authenticated users can upload proof photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'proof-photos'
        AND auth.role() = 'authenticated'
    );
