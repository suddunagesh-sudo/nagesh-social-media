-- Final development repair for wallet accounts and withdrawal requests.
-- RLS is intentionally disabled on these two tables as requested for dev use.

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  blue_points integer NOT NULL DEFAULT 0,
  balance numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS id uuid,
  ADD COLUMN IF NOT EXISTS blue_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  id_type text;
  primary_key_name text;
  primary_key_is_id boolean;
BEGIN
  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'id';

  IF id_type IS DISTINCT FROM 'uuid' THEN
    ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_id_fkey;
    SELECT constraint_name INTO primary_key_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'accounts' AND constraint_type = 'PRIMARY KEY'
    LIMIT 1;
    IF primary_key_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.accounts DROP CONSTRAINT %I', primary_key_name);
    END IF;
    ALTER TABLE public.accounts ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;

  SELECT constraint_name INTO primary_key_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND table_name = 'accounts' AND constraint_type = 'PRIMARY KEY'
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_row
    JOIN pg_attribute AS attribute_row
      ON attribute_row.attrelid = constraint_row.conrelid
     AND attribute_row.attnum = ANY (constraint_row.conkey)
    WHERE constraint_row.conrelid = 'public.accounts'::regclass
      AND constraint_row.contype = 'p'
      AND attribute_row.attname = 'id'
      AND cardinality(constraint_row.conkey) = 1
  ) INTO primary_key_is_id;

  IF primary_key_name IS NOT NULL AND NOT primary_key_is_id THEN
    EXECUTE format('ALTER TABLE public.accounts DROP CONSTRAINT %I', primary_key_name);
    primary_key_name := NULL;
  END IF;
  IF primary_key_name IS NULL THEN
    ALTER TABLE public.accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.accounts'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.accounts'::regclass AND attname = 'id')]
      AND confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$$;

ALTER TABLE public.accounts
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN blue_points SET DEFAULT 0,
  ALTER COLUMN balance SET DEFAULT 0,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- Use exact monetary precision: like rewards can be fractional rupees.
ALTER TABLE public.accounts
  ALTER COLUMN balance TYPE numeric(12, 2) USING balance::numeric(12, 2);
ALTER TABLE public.accounts
  ALTER COLUMN blue_points TYPE integer USING blue_points::integer,
  ALTER COLUMN blue_points SET NOT NULL;

INSERT INTO public.accounts (id, blue_points, balance)
SELECT users.id, 0, 0
FROM auth.users AS users
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_account_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.accounts (id, blue_points, balance)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_account_after_signup ON auth.users;
CREATE TRIGGER create_account_after_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_account_for_new_user();

DROP FUNCTION IF EXISTS public.request_payout(text, numeric, text, text);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',
  amount numeric(12, 2) NOT NULL CHECK (amount >= 100),
  upi_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS amount numeric(12, 2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS upi_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS upi_or_account text,
  ADD COLUMN IF NOT EXISTS ifsc text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  id_type text;
  user_id_type text;
  primary_key_name text;
  primary_key_is_id boolean;
  foreign_key_name text;
BEGIN
  SELECT data_type INTO user_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'withdrawal_requests' AND column_name = 'user_id';

  IF user_id_type IS DISTINCT FROM 'uuid' THEN
    FOR foreign_key_name IN
      SELECT constraint_row.conname
      FROM pg_constraint AS constraint_row
      WHERE constraint_row.conrelid = 'public.withdrawal_requests'::regclass
        AND constraint_row.contype = 'f'
        AND (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.withdrawal_requests'::regclass AND attname = 'user_id') = ANY (constraint_row.conkey)
    LOOP
      EXECUTE format('ALTER TABLE public.withdrawal_requests DROP CONSTRAINT %I', foreign_key_name);
    END LOOP;
    ALTER TABLE public.withdrawal_requests ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
  END IF;

  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'withdrawal_requests' AND column_name = 'id';

  IF id_type IS DISTINCT FROM 'uuid' THEN
    SELECT constraint_name INTO primary_key_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'withdrawal_requests' AND constraint_type = 'PRIMARY KEY'
    LIMIT 1;
    IF primary_key_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.withdrawal_requests DROP CONSTRAINT %I', primary_key_name);
    END IF;
    ALTER TABLE public.withdrawal_requests ALTER COLUMN id TYPE uuid USING gen_random_uuid();
  END IF;

  SELECT constraint_name INTO primary_key_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND table_name = 'withdrawal_requests' AND constraint_type = 'PRIMARY KEY'
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_row
    JOIN pg_attribute AS attribute_row
      ON attribute_row.attrelid = constraint_row.conrelid
     AND attribute_row.attnum = ANY (constraint_row.conkey)
    WHERE constraint_row.conrelid = 'public.withdrawal_requests'::regclass
      AND constraint_row.contype = 'p'
      AND attribute_row.attname = 'id'
      AND cardinality(constraint_row.conkey) = 1
  ) INTO primary_key_is_id;

  IF primary_key_name IS NOT NULL AND NOT primary_key_is_id THEN
    EXECUTE format('ALTER TABLE public.withdrawal_requests DROP CONSTRAINT %I', primary_key_name);
    primary_key_name := NULL;
  END IF;
  IF primary_key_name IS NULL THEN
    ALTER TABLE public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.withdrawal_requests'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.withdrawal_requests'::regclass AND attname = 'user_id')]
      AND confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.withdrawal_requests
      ADD CONSTRAINT withdrawal_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$$;

UPDATE public.withdrawal_requests
SET upi_id = COALESCE(NULLIF(upi_id, ''), upi_or_account, ''),
    name = COALESCE(NULLIF(name, ''), user_name, ''),
    user_name = COALESCE(NULLIF(user_name, ''), name, ''),
    status = CASE WHEN status = 'approved' THEN 'pending' ELSE status END;

ALTER TABLE public.withdrawal_requests
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN amount TYPE numeric(12, 2) USING amount::numeric(12, 2),
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.accounts TO authenticated;
GRANT SELECT ON public.withdrawal_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.request_payout(
  p_name text,
  p_amount numeric,
  p_upi_or_account text,
  p_ifsc text DEFAULT NULL
)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  new_request public.withdrawal_requests;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a withdrawal.';
  END IF;
  IF p_amount IS NULL OR p_amount < 100 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is ₹100.';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 OR length(p_name) > 100 THEN
    RAISE EXCEPTION 'Enter a valid account holder name.';
  END IF;
  IF p_upi_or_account IS NULL OR length(trim(p_upi_or_account)) < 3 OR length(p_upi_or_account) > 150 THEN
    RAISE EXCEPTION 'Enter a valid UPI ID or bank account.';
  END IF;
  IF p_ifsc IS NOT NULL AND p_ifsc !~* '^[A-Z]{4}0[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'Enter a valid IFSC code.';
  END IF;

  UPDATE public.accounts
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = current_user_id AND balance >= p_amount;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient available balance.';
  END IF;

  INSERT INTO public.withdrawal_requests
    (user_id, name, user_name, amount, upi_id, upi_or_account, ifsc)
  VALUES (
    current_user_id,
    trim(p_name),
    trim(p_name),
    p_amount,
    trim(p_upi_or_account),
    trim(p_upi_or_account),
    NULLIF(upper(trim(p_ifsc)), '')
  )
  RETURNING * INTO new_request;
  RETURN new_request;
END;
$$;
REVOKE ALL ON FUNCTION public.request_payout(text, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_payout(text, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.refund_rejected_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    UPDATE public.accounts
    SET balance = balance + NEW.amount,
        updated_at = now()
    WHERE id = NEW.user_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refund_rejected_payout ON public.withdrawal_requests;
DROP TRIGGER IF EXISTS refund_rejected_withdrawal ON public.withdrawal_requests;
CREATE TRIGGER refund_rejected_withdrawal
  BEFORE UPDATE OF status ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.refund_rejected_withdrawal();

NOTIFY pgrst, 'reload schema';
