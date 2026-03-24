BEGIN;

ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS nango_connection_id TEXT,
  ADD COLUMN IF NOT EXISTS nango_provider_config_key TEXT,
  ADD COLUMN IF NOT EXISTS nango_provider TEXT;

CREATE INDEX IF NOT EXISTS idx_platform_accounts_nango_connection
  ON platform_accounts(nango_connection_id);

COMMIT;
