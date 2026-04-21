-- Add audio + music prompt to stories
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS caption text;

-- Add cover/banner image to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url text;

-- Story audio storage bucket (public for streaming)
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-audio', 'story-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for story-audio
DROP POLICY IF EXISTS "Story audio is public" ON storage.objects;
CREATE POLICY "Story audio is public" ON storage.objects
  FOR SELECT USING (bucket_id = 'story-audio');

DROP POLICY IF EXISTS "Users upload own story audio" ON storage.objects;
CREATE POLICY "Users upload own story audio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'story-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own story audio" ON storage.objects;
CREATE POLICY "Users delete own story audio" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'story-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Covers bucket for profile banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Covers are public" ON storage.objects;
CREATE POLICY "Covers are public" ON storage.objects
  FOR SELECT USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "Users upload own cover" ON storage.objects;
CREATE POLICY "Users upload own cover" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own cover" ON storage.objects;
CREATE POLICY "Users update own cover" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own cover" ON storage.objects;
CREATE POLICY "Users delete own cover" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);