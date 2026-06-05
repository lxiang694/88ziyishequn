-- ===========================================================
-- 會員系統 Phase 1 — 資料表
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================

-- 1. 個人資料表（與 Supabase auth.users 一對一）
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  default_store_id BIGINT,
  default_store_name TEXT,
  default_store_address TEXT,
  default_store_county TEXT,
  default_store_district TEXT,
  line_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone);

ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 2. orders 表加入 user_id 欄位（已存在訂單會保持 NULL，可由舊手機號碼回溯關聯）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- 3. 自動建立 profile 的 trigger
-- 註冊時會自動把 user_metadata 裡的 name/phone 複製到 user_profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. 自動更新 updated_at 的 trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_touch ON user_profiles;
CREATE TRIGGER user_profiles_touch
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 完成 ✓
