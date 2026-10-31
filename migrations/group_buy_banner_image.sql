-- ═══════════════════════════════════════════════════════════
-- 每月團購：首頁入口的背景圖
--
-- 冪等，可重複執行。
-- 執行後到後台「團購管理」→ 編輯檔期 →「首頁入口背景圖」上傳圖片，
-- 首頁「每月團購」那一塊就會用這張圖當背景（每一檔可以放不同的圖）。
-- 沒上傳的檔期維持原本的綠色背景。
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.group_buy_campaigns ADD COLUMN IF NOT EXISTS banner_image_url text;

DO $$ BEGIN
  ALTER TABLE public.group_buy_campaigns
    ADD CONSTRAINT group_buy_campaigns_banner_image_url_check
    CHECK (banner_image_url IS NULL OR (banner_image_url ~ '^https?://' AND char_length(banner_image_url) <= 1000));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 確認：應該看到 banner_image_url 這個欄位
SELECT column_name FROM information_schema.columns
WHERE table_name = 'group_buy_campaigns' AND column_name = 'banner_image_url';
