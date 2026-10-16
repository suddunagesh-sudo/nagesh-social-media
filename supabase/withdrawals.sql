-- Run in the Supabase SQL Editor to enable manual UPI/bank withdrawals.
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 100),
  upi_id text NOT NULL CHECK (length(trim(upi_id)) BETWEEN 3 AND 150),
  ifsc text CHECK (ifsc IS NULL OR ifsc ~* '^[A-Z]{4}0[A-Z0-9]{6}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawals read own" ON public.withdrawals;
CREATE POLICY "withdrawals read own"
  ON public.withdrawals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "withdrawals owner reads all" ON public.withdrawals;
CREATE POLICY "withdrawals owner reads all"
  ON public.withdrawals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.full_name = 'Chhavinath Nagesh'
    )
  );

DROP POLICY IF EXISTS "withdrawals insert own" ON public.withdrawals;
CREATE POLICY "withdrawals insert own"
  ON public.withdrawals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

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
    AND status IN ('pending', 'paid', 'rejected')
  );

GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT UPDATE (status) ON public.withdrawals TO authenticated;
REVOKE DELETE ON public.withdrawals FROM anon, authenticated;

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
    AND status IN ('pending', 'paid');

  IF NEW.amount > earned_amount - reserved_amount THEN
    RAISE EXCEPTION 'Withdrawal exceeds available balance of ₹%.',
      GREATEST(0, earned_amount - reserved_amount);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_withdrawal_balance() FROM PUBLIC;

DROP TRIGGER IF EXISTS reserve_withdrawal_balance ON public.withdrawals;
CREATE TRIGGER reserve_withdrawal_balance
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.reserve_withdrawal_balance();

CREATE INDEX IF NOT EXISTS withdrawals_user_created_idx
  ON public.withdrawals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_pending_created_idx
  ON public.withdrawals (created_at)
  WHERE status = 'pending';

NOTIFY pgrst, 'reload schema';
