CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_states (
  match_id TEXT PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL,
  minute_text TEXT,
  last_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_deliveries (
  delivery_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  lease_until INTEGER NOT NULL,
  delivered_at INTEGER,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (delivery_id, subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_updated
  ON push_subscriptions(updated_at);
CREATE INDEX IF NOT EXISTS idx_match_states_updated
  ON match_states(updated_at);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_expires
  ON push_deliveries(expires_at);
