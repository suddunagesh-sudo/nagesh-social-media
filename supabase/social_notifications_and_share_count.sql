-- Apply this migration in the Supabase SQL Editor.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL CONSTRAINT notifications_recipient_id_fkey
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL CONSTRAINT notifications_actor_id_fkey
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id bigint NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'comment')),
  content text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_not_self CHECK (recipient_id <> actor_id)
);

CREATE INDEX IF NOT EXISTS notifications_recipient_unread_created_idx
  ON public.notifications (recipient_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification recipient reads own" ON public.notifications;
CREATE POLICY "notification recipient reads own"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "post owner notification insert" ON public.notifications;
CREATE POLICY "post owner notification insert"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND recipient_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.posts
      WHERE posts.id = notifications.post_id
        AND posts.user_id = notifications.recipient_id
    )
  );

DROP POLICY IF EXISTS "notification recipient marks read" ON public.notifications;
CREATE POLICY "notification recipient marks read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

GRANT SELECT, INSERT ON public.notifications TO authenticated;
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_post_share_count(p_post_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.posts
  SET share_count = share_count + 1
  WHERE id = p_post_id
  RETURNING share_count INTO updated_count;

  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_post_share_count(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_post_share_count(bigint) TO authenticated;
