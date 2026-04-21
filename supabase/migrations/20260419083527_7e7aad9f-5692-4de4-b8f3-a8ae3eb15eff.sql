-- Add 'message' to notif_type enum
ALTER TYPE public.notif_type ADD VALUE IF NOT EXISTS 'message';

-- Need to commit enum addition before using it; create function & trigger in fresh statements
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (NEW.recipient_id, NEW.sender_id, 'message'::public.notif_type);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_insert_notify ON public.messages;
CREATE TRIGGER on_message_insert_notify
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_message();

-- When a message is marked read, clear corresponding unread message notifications
CREATE OR REPLACE FUNCTION public.clear_message_notif_on_read()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
    UPDATE public.notifications
    SET read_at = now()
    WHERE user_id = NEW.recipient_id
      AND actor_id = NEW.sender_id
      AND type = 'message'::public.notif_type
      AND read_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_read_clear_notif ON public.messages;
CREATE TRIGGER on_message_read_clear_notif
AFTER UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.clear_message_notif_on_read();