-- 商品介紹「整篇貼上」：一個欄位存整篇文案（重點、特色、適合誰、使用方法、
-- 搭配建議、成分規格、注意事項、保存方式…），前台依小標題自動分區排版。
--
-- 原本分開的欄位（適合誰、使用方法、成分說明…）不刪：儲存時會從整篇自動拆開
-- 寫回去，文章推薦、AI 文案等功能照常使用。
--
-- 在 Supabase SQL Editor 執行一次即可；重複執行也不會出錯。
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description text;

-- 確認：應該看到 description 這一欄
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'description';
