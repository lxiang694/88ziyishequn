-- ===========================================================
-- 社群線下活動報名
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================

CREATE TABLE IF NOT EXISTS community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  address TEXT,
  event_time TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  topic TEXT,
  companions INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON community_event_registrations(event_id);

ALTER TABLE community_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_event_registrations DISABLE ROW LEVEL SECURITY;

-- 先建立本次活動，之後可在後台「社群活動」管理修改地址、時間、說明或新增其他場次
INSERT INTO community_events (slug, title, address, event_time, description, is_active)
VALUES (
  'banqiao-2026-07',
  '7月板橋88自醫社群線下健康聚會',
  '',
  '',
  '',
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

-- 完成 ✓
