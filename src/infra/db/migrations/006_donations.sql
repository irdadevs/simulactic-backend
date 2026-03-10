-- Donations / billing lifecycle

CREATE SCHEMA IF NOT EXISTS billing;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'billing' AND t.typname = 'donation_type'
  ) THEN
    CREATE TYPE billing.donation_type AS ENUM ('one_time', 'monthly');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'billing' AND t.typname = 'donation_status'
  ) THEN
    CREATE TYPE billing.donation_status AS ENUM (
      'pending',
      'active',
      'completed',
      'canceled',
      'failed',
      'expired'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'billing' AND t.typname = 'payment_provider'
  ) THEN
    CREATE TYPE billing.payment_provider AS ENUM ('stripe');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS billing.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  donation_type billing.donation_type NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status billing.donation_status NOT NULL DEFAULT 'pending',
  provider billing.payment_provider NOT NULL DEFAULT 'stripe',
  provider_session_id text NOT NULL UNIQUE,
  provider_customer_id text,
  provider_subscription_id text UNIQUE,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now_utc(),
  updated_at timestamptz NOT NULL DEFAULT now_utc(),
  CHECK (
    donation_type <> 'monthly' OR provider_subscription_id IS NULL OR current_period_end IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS billing.donations_archive
(LIKE billing.donations INCLUDING ALL);

CREATE TABLE IF NOT EXISTS billing.supporter_badges (
  id serial PRIMARY KEY,
  branch text NOT NULL CHECK (branch IN ('amount', 'months')),
  level integer NOT NULL CHECK (level >= 1),
  name text NOT NULL,
  quantity_label text NOT NULL,
  threshold integer NOT NULL CHECK (threshold >= 0),
  UNIQUE (branch, level),
  UNIQUE (branch, threshold)
);

CREATE TABLE IF NOT EXISTS billing.supporter_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_donated_eur_minor integer NOT NULL DEFAULT 0 CHECK (total_donated_eur_minor >= 0),
  monthly_supporting_months integer NOT NULL DEFAULT 0 CHECK (monthly_supporting_months >= 0),
  amount_level integer NOT NULL DEFAULT 0 CHECK (amount_level >= 0),
  monthly_level integer NOT NULL DEFAULT 0 CHECK (monthly_level >= 0),
  updated_at timestamptz NOT NULL DEFAULT now_utc()
);

CREATE TABLE IF NOT EXISTS billing.supporter_badge_unlocks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id integer NOT NULL REFERENCES billing.supporter_badges(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now_utc(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_donations_user
  ON billing.donations (user_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at
  ON billing.donations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_status
  ON billing.donations (status);
CREATE INDEX IF NOT EXISTS idx_donations_type
  ON billing.donations (donation_type);
CREATE INDEX IF NOT EXISTS idx_donations_active
  ON billing.donations (created_at DESC)
  WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_supporter_badges_branch_level
  ON billing.supporter_badges (branch, level);
CREATE INDEX IF NOT EXISTS idx_supporter_badge_unlocks_user
  ON billing.supporter_badge_unlocks (user_id, unlocked_at DESC);

DROP TRIGGER IF EXISTS trg_donations_updated_at ON billing.donations;
CREATE TRIGGER trg_donations_updated_at
BEFORE UPDATE ON billing.donations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION billing_soft_archive_before(p_before timestamptz)
RETURNS bigint AS $$
DECLARE
  moved_count bigint := 0;
BEGIN
  INSERT INTO billing.donations_archive
  SELECT *
  FROM billing.donations
  WHERE created_at < p_before
    AND is_archived = false
  ON CONFLICT DO NOTHING;

  UPDATE billing.donations
  SET is_archived = true,
      archived_at = now_utc()
  WHERE created_at < p_before
    AND is_archived = false;

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$ LANGUAGE plpgsql;
