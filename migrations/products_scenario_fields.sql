-- ===========================================================
-- 商品「情境化」欄位：何時吃 / 怎麼搭 / 來源
-- （「誰」沿用既有的 suitable_people 欄位）
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS intake_timing TEXT; -- 建議服用時間（逗號分隔的標籤 value）
ALTER TABLE products ADD COLUMN IF NOT EXISTS pairing_tips TEXT;  -- 搭配建議（協同 / 避免同時）
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_notes TEXT;  -- 成分來源 / 劑型 / 挑選重點

-- 完成 ✓（欄位皆為選填，未填的商品前台不會顯示對應資訊）
