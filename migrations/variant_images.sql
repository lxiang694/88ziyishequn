-- 規格圖片：每個規格可以有自己的一張圖（不同顏色、尺寸）
--
-- 客人在前台點選規格時，主圖會換成這個規格的圖片；沒有上傳圖片的規格
-- 照舊顯示商品主圖。欄位可為空，既有規格不受影響。
--
-- 在 Supabase SQL Editor 執行一次即可；重複執行也不會出錯。
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS image_url text;

-- 只接受 http(s) 網址或空值，避免後台誤存奇怪的字串
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_image_url_http') THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_image_url_http
      CHECK (image_url IS NULL OR image_url ~ '^https?://');
  END IF;
END $$;

-- 確認：應該看到 image_url 這一欄
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'image_url';
