-- ═══════════════════════════════════════════════════════════
-- 好友推薦（第一階段：專屬連結＋追蹤成效，還沒有獎勵）
--
-- 冪等，可重複執行。在 Supabase → SQL Editor 貼上整份執行。
--
--   referral_codes      每位會員一組推薦碼（例如 K7M2QX），分享連結帶 ?ref=K7M2QX
--   referral_visits     有人點了推薦連結（同一位訪客同一天只記一次）
--   user_profiles.referred_by    這位會員是誰推薦來註冊的
--   orders / group_buy_orders.referral_code   這張訂單是誰推薦的
--
-- 公開金鑰（anon）讀寫不到，一律經過網站伺服器（service_role）。
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code       text NOT NULL UNIQUE CHECK (code ~ '^[A-Z2-9]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referral_visits (
  id          bigserial PRIMARY KEY,
  code        text NOT NULL CHECK (code ~ '^[A-Z2-9]{6}$'),
  visitor_id  text,
  landing     text CHECK (landing IS NULL OR char_length(landing) <= 300),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_visits_code_idx ON public.referral_visits (code, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_visits_time_idx ON public.referral_visits (created_at DESC);

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS referred_by text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS referral_code text;
CREATE INDEX IF NOT EXISTS orders_referral_code_idx ON public.orders (referral_code) WHERE referral_code IS NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.group_buy_orders') IS NOT NULL THEN
    ALTER TABLE public.group_buy_orders ADD COLUMN IF NOT EXISTS referral_code text;
    CREATE INDEX IF NOT EXISTS group_buy_orders_referral_code_idx ON public.group_buy_orders (referral_code) WHERE referral_code IS NOT NULL;
  END IF;
END $$;

-- 公開金鑰不能直接讀寫
ALTER TABLE public.referral_codes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_codes, public.referral_visits FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.referral_visits_id_seq FROM anon, authenticated;
GRANT ALL ON public.referral_codes, public.referral_visits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.referral_visits_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';

-- 確認：應該看得到兩張表與三個新欄位
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name IN ('referral_codes', 'referral_visits') AND column_name = 'code')
    OR (table_name = 'user_profiles' AND column_name = 'referred_by')
    OR (table_name IN ('orders', 'group_buy_orders') AND column_name = 'referral_code'));
