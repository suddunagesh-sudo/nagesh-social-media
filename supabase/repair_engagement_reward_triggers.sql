-- Apply in the Supabase SQL Editor. The live database's engagement triggers
-- call a missing/wrongly typed reward function, rolling back like/comment writes.

CREATE OR REPLACE FUNCTION public.reward_post_engagement(
  p_post_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_event_id text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  post_owner_id uuid;
  event_key text;
  reward_inserted boolean;
BEGIN
  IF p_event_type NOT IN ('like', 'view', 'comment', 'share') THEN
    RAISE EXCEPTION 'Unsupported reward event.';
  END IF;
  IF p_actor_id IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id THEN
    RETURN;
  END IF;

  SELECT user_id INTO post_owner_id
  FROM public.posts
  WHERE id = p_post_id;
  IF post_owner_id IS NULL OR post_owner_id = p_actor_id THEN
    RETURN;
  END IF;

  event_key := p_event_type || ':' || p_post_id::text || ':' || p_actor_id::text;
  IF p_event_type IN ('comment', 'share') THEN
    IF p_event_id IS NULL OR length(p_event_id) = 0 THEN
      RAISE EXCEPTION 'Reward event ID is required.';
    END IF;
    event_key := event_key || ':' || p_event_id;
  END IF;

  INSERT INTO public.reward_ledger (event_key, user_id, blue_points_delta, amount_delta)
  VALUES (event_key, post_owner_id, 1, 0.10)
  ON CONFLICT (event_key) DO NOTHING
  RETURNING true INTO reward_inserted;

  IF reward_inserted THEN
    INSERT INTO public.accounts (id, balance, blue_points)
    VALUES (post_owner_id, 0.10, 1)
    ON CONFLICT (id) DO UPDATE
    SET balance = public.accounts.balance + 0.10,
        blue_points = public.accounts.blue_points + 1;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reward_post_engagement(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_post_like_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.reward_post_engagement(NEW.post_id, NEW.user_id, 'like'::text, ''::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_post_like_reward ON public.likes;
CREATE TRIGGER award_post_like_reward
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.award_post_like_reward();

CREATE OR REPLACE FUNCTION public.reward_new_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.reward_post_engagement(
    NEW.post_id,
    NEW.user_id,
    'comment'::text,
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reward_new_post_comment ON public.comments;
CREATE TRIGGER reward_new_post_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.reward_new_post_comment();

NOTIFY pgrst, 'reload schema';
