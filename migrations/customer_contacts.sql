-- ═══════════════════════════════════════════════════════════
-- 客戶經營：聯繫紀錄
--
-- 冪等，可重複執行。在 Supabase → SQL Editor 貼上整份執行。
--
-- 後台「客戶經營」按「已聯繫」時記一筆：誰、什麼時候、哪一份名單、備註。
-- 之後這位客人再下單，就算「挽回成功」，可以看出主動聯繫有沒有效。
-- 客人以手機辨識（跟訂單一樣），不另外存個資。
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id            bigserial PRIMARY KEY,
  phone         text        NOT NULL CHECK (phone ~ '^09[0-9]{8}$'),
  list_key      text        NOT NULL DEFAULT 'all',
  note          text        CHECK (note IS NULL OR char_length(note) <= 200),
  admin_id      bigint,
  admin_name    text,
  contacted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_contacts_phone_idx ON public.customer_contacts (phone, contacted_at DESC);
CREATE INDEX IF NOT EXISTS customer_contacts_time_idx ON public.customer_contacts (contacted_at DESC);

-- 公開金鑰不能直接讀寫（網站伺服器用 service_role，不受影響）
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_contacts FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.customer_contacts_id_seq FROM anon, authenticated;
GRANT ALL ON public.customer_contacts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.customer_contacts_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';

-- 確認：應該看得到 customer_contacts
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'customer_contacts';
