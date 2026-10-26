-- ═══════════════════════════════════════════════════════════
-- 商品評價
--
-- 冪等，可重複執行。在 Supabase → SQL Editor 貼上整份執行。
--
-- 規則：
--   • 只有會員能寫，一位會員對一個商品只有一則評價（可以修改）
--   • 1～5 顆星，內容 5～500 字，可選幾個快速標籤
--   • 名字只存遮蔽後的暱稱（例如 王*明），不存真名
--   • verified_purchase：這位會員真的買過這個商品（未取消的訂單）
--   • 寫完直接公開；後台可以隱藏、回覆（賣家回覆）
--
-- 安全：跟其他資料表一樣，公開金鑰（anon）與 authenticated 讀寫不到，
-- 一律經過網站伺服器（service_role）。
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id                bigserial PRIMARY KEY,
  product_id        bigint      NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      text        NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 30),
  rating            smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content           text        NOT NULL CHECK (char_length(content) BETWEEN 5 AND 500),
  tags              text[]      NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 6),
  variant_name      text,
  verified_purchase boolean     NOT NULL DEFAULT false,
  status            text        NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  admin_reply       text        CHECK (admin_reply IS NULL OR char_length(admin_reply) <= 500),
  admin_reply_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_reviews_one_per_member UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS product_reviews_product_idx
  ON public.product_reviews (product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_reviews_created_idx
  ON public.product_reviews (created_at DESC);

-- 公開金鑰不能直接讀寫（網站伺服器用 service_role，不受影響）
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_reviews FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.product_reviews_id_seq FROM anon, authenticated;
GRANT ALL ON public.product_reviews TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.product_reviews_id_seq TO service_role;

-- 讓 API 立刻認得新資料表
NOTIFY pgrst, 'reload schema';

-- 確認：應該看得到 product_reviews
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'product_reviews';
