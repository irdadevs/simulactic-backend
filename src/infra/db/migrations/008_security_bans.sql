CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS security.user_bans (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  source text NOT NULL CHECK (source IN ('admin', 'system')),
  banned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now_utc(),
  expires_at timestamptz NULL,
  revoked_at timestamptz NULL,
  revoked_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_bans_user ON security.user_bans (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_bans_active
  ON security.user_bans (user_id, created_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS security.ip_bans (
  id bigserial PRIMARY KEY,
  ip_address text NOT NULL,
  reason text NOT NULL,
  source text NOT NULL CHECK (source IN ('admin', 'system')),
  banned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now_utc(),
  expires_at timestamptz NULL,
  revoked_at timestamptz NULL,
  revoked_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ip_bans_ip ON security.ip_bans (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_bans_active
  ON security.ip_bans (ip_address, created_at DESC)
  WHERE revoked_at IS NULL;
