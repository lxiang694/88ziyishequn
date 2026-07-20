-- ===========================================================
-- 社群包裝設計票選
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================

CREATE TABLE IF NOT EXISTS design_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id TEXT NOT NULL,
  option_key TEXT NOT NULL,
  voter_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (poll_id, voter_key)
);

CREATE INDEX IF NOT EXISTS idx_design_votes_poll_id ON design_votes(poll_id);

ALTER TABLE design_votes DISABLE ROW LEVEL SECURITY;

-- 完成 ✓
