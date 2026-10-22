-- ═══════════════════════════════════════════════════════════
-- 商品封存：已有訂單的商品「刪除」時改成封存
--
-- 冪等，可重複執行。
--
-- 為什麼不能直接刪：訂單明細（order_items）連著商品，刪掉商品
-- 會讓過去的訂單失去對應，資料庫因此拒絕（order_items_product_id_fkey）。
-- 封存 = 從後台商品列表與前台移除，但商品資料留著，舊訂單、報表照常。
-- 封存的商品可以在後台「已封存」裡還原。
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS products_archived_at_idx ON public.products (archived_at);

-- 確認：應該看得到 archived_at
SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'archived_at';
