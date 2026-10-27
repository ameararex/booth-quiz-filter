CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  delete_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX shares_expiry ON shares(expires_at);
CREATE TABLE share_limits (
  day TEXT PRIMARY KEY,
  created_count INTEGER NOT NULL
);
