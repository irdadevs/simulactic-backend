-- Daily FX rates for donation normalization to EUR

CREATE TABLE IF NOT EXISTS billing.fx_rates_daily (
  rate_date date NOT NULL,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  rate_to_eur numeric(18, 10) NOT NULL CHECK (rate_to_eur > 0),
  source text NOT NULL DEFAULT 'ECB',
  fetched_at timestamptz NOT NULL DEFAULT now_utc(),
  PRIMARY KEY (rate_date, currency)
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_daily_currency_date
  ON billing.fx_rates_daily (currency, rate_date DESC);

-- Ensure EUR baseline exists for current date.
INSERT INTO billing.fx_rates_daily (rate_date, currency, rate_to_eur, source)
VALUES (CURRENT_DATE, 'EUR', 1, 'SYSTEM')
ON CONFLICT (rate_date, currency) DO NOTHING;
