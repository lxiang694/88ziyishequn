-- ═══════════════════════════════════════════════════════════
-- 賣貨便賣場標記「現貨／預購」
--
-- 冪等，可重複執行。
--
-- 客人同時買現貨和預購時，訂單會從兩個賣場各寄一個包裹、各付一次錢。
-- 網站依這個標記在結帳頁、下單成功頁、代客下單確認訊息告訴客人：
-- 哪些是現貨（約 3 個工作日到店）、哪些是預購（約 7 個工作日到店）、
-- 每一包取貨時要付多少。
-- ═══════════════════════════════════════════════════════════

ALTER TABLE myship_marketplaces ADD COLUMN IF NOT EXISTS ship_kind text;

DO $$ BEGIN
  ALTER TABLE myship_marketplaces
    ADD CONSTRAINT myship_marketplaces_ship_kind_check CHECK (ship_kind IS NULL OR ship_kind IN ('現貨','預購'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 小莊備用88 → 現貨；88好康 → 預購（依賣場名稱比對，簡繁都可以）
UPDATE myship_marketplaces SET ship_kind = '現貨'
  WHERE ship_kind IS DISTINCT FROM '現貨' AND (id = 'GM2601252733206' OR name LIKE '%備用88%' OR name LIKE '%备用88%');
UPDATE myship_marketplaces SET ship_kind = '預購'
  WHERE ship_kind IS DISTINCT FROM '預購' AND name LIKE '%好康%';

-- 確認結果：每個賣場的 ship_kind 都應該有值
SELECT id, name, ship_kind, enabled FROM myship_marketplaces ORDER BY id;

-- 完成 ✓
-- 如果上面有賣場的 ship_kind 是空的，用這行手動指定（把代碼換成那個賣場的）：
--   UPDATE myship_marketplaces SET ship_kind = '預購' WHERE id = 'GM 開頭的賣場代碼';
