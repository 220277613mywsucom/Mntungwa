-- ============ STORIES ============
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_stories_user_active ON public.stories(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON public.stories(expires_at);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active stories viewable" ON public.stories;
CREATE POLICY "Active stories viewable" ON public.stories
FOR SELECT TO authenticated USING (expires_at > now());

DROP POLICY IF EXISTS "Create own stories" ON public.stories;
CREATE POLICY "Create own stories" ON public.stories
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own stories" ON public.stories;
CREATE POLICY "Delete own stories" ON public.stories
FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.story_views (
  story_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Story owner sees views" ON public.story_views;
CREATE POLICY "Story owner sees views" ON public.story_views
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_views.story_id AND s.user_id = auth.uid())
  OR auth.uid() = viewer_id
);

DROP POLICY IF EXISTS "Mark story viewed" ON public.story_views;
CREATE POLICY "Mark story viewed" ON public.story_views
FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

-- Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for stories (public read, owner-folder writes)
DROP POLICY IF EXISTS "Stories public read" ON storage.objects;
CREATE POLICY "Stories public read" ON storage.objects
FOR SELECT USING (bucket_id = 'stories');

DROP POLICY IF EXISTS "Stories owner upload" ON storage.objects;
CREATE POLICY "Stories owner upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Stories owner delete" ON storage.objects;
CREATE POLICY "Stories owner delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Voice notes (private). Participants in the message see via signed URLs from app code.
DROP POLICY IF EXISTS "Voice owner upload" ON storage.objects;
CREATE POLICY "Voice owner upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Voice owner read" ON storage.objects;
CREATE POLICY "Voice owner read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Voice owner delete" ON storage.objects;
CREATE POLICY "Voice owner delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ MESSAGES extras ============
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id uuid;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS audio_duration_ms integer;

-- ============ PROFILES: student number ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_student_number boolean NOT NULL DEFAULT false;

-- handle_new_user: capture student_number from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare base_username text; final_username text; counter int := 0;
begin
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  if base_username = '' then base_username := 'student'; end if;
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || counter::text;
  end loop;
  insert into public.profiles (id, username, display_name, student_number)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', final_username),
    new.raw_user_meta_data->>'student_number'
  );
  return new;
end; $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;