-- ===========================================================
-- 商品首頁分區：88自醫社群團購商品（community）/ 小莊優選（xiaozhuang）
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS home_section TEXT;

-- 依現有商品名稱回填：名稱含「小莊代購」→ 小莊優選，其餘 → 88自醫社群
UPDATE products SET home_section = 'xiaozhuang'
WHERE home_section IS NULL AND product_name LIKE '%小莊代購%';

UPDATE products SET home_section = 'community'
WHERE home_section IS NULL;

-- 完成 ✓（之後新增/編輯商品時，可在後台自由選擇分區）
