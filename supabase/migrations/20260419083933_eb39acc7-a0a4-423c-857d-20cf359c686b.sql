-- Image support on messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url text;
-- Allow content to be empty when an image is sent
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN content SET DEFAULT '';

-- Reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone in the message conversation can see the reactions
DROP POLICY IF EXISTS "View reactions on visible messages" ON public.message_reactions;
CREATE POLICY "View reactions on visible messages"
ON public.message_reactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_reactions.message_id
      AND (auth.uid() = m.sender_id OR auth.uid() = m.recipient_id)
  )
);

DROP POLICY IF EXISTS "React to visible messages" ON public.message_reactions;
CREATE POLICY "React to visible messages"
ON public.message_reactions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_reactions.message_id
      AND (auth.uid() = m.sender_id OR auth.uid() = m.recipient_id)
  )
);

DROP POLICY IF EXISTS "Remove own reaction" ON public.message_reactions;
CREATE POLICY "Remove own reaction"
ON public.message_reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;