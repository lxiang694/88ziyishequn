-- ===========================================================
-- 流量監控 — 資料表
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================

-- 頁面瀏覽紀錄表（每次前台頁面瀏覽寫入一筆）
CREATE TABLE IF NOT EXISTS page_views (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,                 -- 瀏覽的路徑，例如 /products/xxx
  referrer TEXT,                      -- 來源網址
  visitor_id TEXT,                    -- 訪客識別（cookie），用於計算 UV
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- 已登入會員（可為 NULL）
  user_agent TEXT,                    -- 瀏覽器資訊
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);

-- 由後端 service role 寫入與讀取，關閉 RLS
ALTER TABLE page_views DISABLE ROW LEVEL SECURITY;

-- 完成 ✓
