-- Run this migration in the Supabase SQL Editor to allow public story media.
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES ('stories', 'stories', true, ARRAY['image/*', 'video/*'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "story media are public" ON storage.objects;
CREATE POLICY "story media are public"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'stories');

DROP POLICY IF EXISTS "story owners can upload media" ON storage.objects;
CREATE POLICY "story owners can upload media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'stories'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
