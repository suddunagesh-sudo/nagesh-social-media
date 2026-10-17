ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.withdrawals
  DROP CONSTRAINT IF EXISTS withdrawals_status_check;
ALTER TABLE public.withdrawals
  ADD CONSTRAINT withdrawals_status_check
  CHECK (status IN ('pending', 'approved', 'paid', 'rejected'));

DROP POLICY IF EXISTS "withdrawals owner updates status" ON public.withdrawals;
CREATE POLICY "withdrawals owner updates status"
  ON public.withdrawals FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.full_name = 'Chhavinath Nagesh'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.full_name = 'Chhavinath Nagesh'
    )
    AND status IN ('pending', 'approved', 'paid', 'rejected')
  );

CREATE OR REPLACE FUNCTION public.reserve_withdrawal_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  earned_amount numeric(12, 2);
  reserved_amount numeric(12, 2);
BEGIN
  IF NEW.amount < 100 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is ₹100.';
  END IF;
  IF NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'New withdrawal requests must be pending.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  SELECT COALESCE(sum(amount_delta), 0)
  INTO earned_amount
  FROM public.reward_ledger
  WHERE user_id = NEW.user_id;

  SELECT COALESCE(sum(amount), 0)
  INTO reserved_amount
  FROM public.withdrawals
  WHERE user_id = NEW.user_id
    AND status IN ('pending', 'approved', 'paid');

  IF NEW.amount > earned_amount - reserved_amount THEN
    RAISE EXCEPTION 'Withdrawal exceeds available balance of ₹%.',
      GREATEST(0, earned_amount - reserved_amount);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reserve_withdrawal_balance ON public.withdrawals;
CREATE TRIGGER reserve_withdrawal_balance
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.reserve_withdrawal_balance();

CREATE OR REPLACE FUNCTION public.validate_withdrawal_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'approved' AND NEW.status IN ('paid', 'rejected') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Invalid withdrawal status transition: % to %.', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS validate_withdrawal_status_transition ON public.withdrawals;
CREATE TRIGGER validate_withdrawal_status_transition
  BEFORE UPDATE OF status ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal_status_transition();

CREATE OR REPLACE FUNCTION public.reward_post_engagement(
  p_post_id bigint,
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

REVOKE ALL ON FUNCTION public.reward_post_engagement(bigint, uuid, text, text) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.increment_post_views(bigint);
CREATE FUNCTION public.increment_post_views(p_post_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_views integer;
  actor_id uuid := auth.uid();
BEGIN
  UPDATE public.posts
  SET views = views + 1
  WHERE id = p_post_id
  RETURNING views INTO updated_views;

  IF updated_views IS NOT NULL AND actor_id IS NOT NULL THEN
    PERFORM public.reward_post_engagement(p_post_id, actor_id, 'view');
  END IF;
  RETURN updated_views;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_post_views(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_post_views(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_post_share_count(p_post_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count integer;
  actor_id uuid := auth.uid();
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to share posts.';
  END IF;

  UPDATE public.posts
  SET share_count = share_count + 1
  WHERE id = p_post_id
  RETURNING share_count INTO updated_count;

  IF updated_count IS NOT NULL THEN
    PERFORM public.reward_post_engagement(p_post_id, actor_id, 'share', updated_count::text);
  END IF;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_post_share_count(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_post_share_count(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.award_post_like_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.reward_post_engagement(NEW.post_id, NEW.user_id, 'like');
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
  PERFORM public.reward_post_engagement(NEW.post_id, NEW.user_id, 'comment', NEW.id::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reward_new_post_comment ON public.comments;
CREATE TRIGGER reward_new_post_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.reward_new_post_comment();

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.comments;
DROP POLICY IF EXISTS "users create own comments" ON public.comments;
DROP POLICY IF EXISTS "users update own comments" ON public.comments;
DROP POLICY IF EXISTS "users delete own comments" ON public.comments;
CREATE POLICY "users create own comments"
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
REVOKE UPDATE, DELETE ON public.comments FROM authenticated;
GRANT SELECT, INSERT ON public.comments TO authenticated;

NOTIFY pgrst, 'reload schema';
