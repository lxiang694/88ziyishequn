-- ═══════════════════════════════════════════════════════════
-- 流量來源：記下分享連結上的 utm 標記
--
-- 冪等，可重複執行。
--
-- 後台「流量監控 → 流量來源」不執行這個檔案也能用（依來源網址與
-- LINE／Facebook 內建瀏覽器判斷）；執行後，帶 ?utm_source=line 這類
-- 標記的連結會被準確歸類，也能看到「哪一則貼文帶來多少人」。
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS utm_campaign text;

-- 讓 API 立刻認得新欄位
NOTIFY pgrst, 'reload schema';

-- 確認：應該看得到三個欄位
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'page_views' AND column_name LIKE 'utm_%';
