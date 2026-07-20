-- ===========================================================
-- 會員常用收件資訊（地址簿）
-- 在 Supabase SQL Editor 執行此檔案即可
-- 依賴 membership_schema.sql 已建立的 touch_updated_at() function
-- ===========================================================

CREATE TABLE IF NOT EXISTS saved_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line_id TEXT,
  store_id BIGINT,
  store_name TEXT,
  store_address TEXT,
  store_county TEXT,
  store_district TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id ON saved_addresses(user_id);

ALTER TABLE saved_addresses DISABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS saved_addresses_touch ON saved_addresses;
CREATE TRIGGER saved_addresses_touch
BEFORE UPDATE ON saved_addresses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 完成 ✓
