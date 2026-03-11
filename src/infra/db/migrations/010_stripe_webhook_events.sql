CREATE TABLE IF NOT EXISTS billing.stripe_webhook_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  api_version text,
  livemode boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  payload jsonb NOT NULL,
  related_session_id text,
  related_subscription_id text,
  related_customer_id text,
  error_message text,
  processed_at timestamptz,
  failed_at timestamptz,
  last_received_at timestamptz NOT NULL DEFAULT now_utc(),
  created_at timestamptz NOT NULL DEFAULT now_utc(),
  updated_at timestamptz NOT NULL DEFAULT now_utc()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type
  ON billing.stripe_webhook_events (event_type, last_received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON billing.stripe_webhook_events (status, last_received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_subscription
  ON billing.stripe_webhook_events (related_subscription_id)
  WHERE related_subscription_id IS NOT NULL;
