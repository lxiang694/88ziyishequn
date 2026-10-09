-- ═══════════════════════════════════════════════════════════
-- 商品銷量檢視：每個商品賣出幾件（不含已取消的訂單）
--
-- 冪等，可重複執行。只建立一個檢視，不修改任何資料。
--
-- 為什麼需要：網站原本把整張訂單明細讀回來自己加總，但 Supabase 每次最多
-- 回 1000 列，明細超過一千筆後「N 人買過」就開始少算。改成在資料庫裡加總，
-- 一個商品只回一列。
--
-- 沒執行這份也不會壞：程式會改用逐頁讀明細的備援，數字一樣正確，只是比較慢。
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.product_sales
WITH (security_invoker = true) AS
SELECT oi.product_id, sum(oi.quantity)::bigint AS sold
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE oi.product_id IS NOT NULL
  AND o.order_status IS DISTINCT FROM '已取消'
GROUP BY oi.product_id;

-- 只給網站伺服器讀；前台訪客不能直接查銷量
REVOKE ALL ON public.product_sales FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.product_sales TO service_role;

-- 確認：應該看到每個商品一列，sold 是賣出件數
SELECT * FROM public.product_sales ORDER BY sold DESC LIMIT 20;
