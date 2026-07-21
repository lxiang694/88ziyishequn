-- ===========================================================
-- 社群見面會：新增「活動開始時間」欄位（用於自動截止報名）
-- 報名將於活動開始前 2 小時自動關閉
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================

ALTER TABLE community_events ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;

-- 將既有活動名稱的「聚會」改為「見面會」
UPDATE community_events
SET title = REPLACE(title, '聚會', '見面會')
WHERE title LIKE '%聚會%';

-- 設定本次板橋見面會的開始時間（台灣時間 2026/07/26 13:30）
-- 報名會在 2026/07/26 11:30 自動關閉
UPDATE community_events
SET starts_at = '2026-07-26 13:30:00+08'
WHERE slug = 'banqiao-2026-07' AND starts_at IS NULL;

-- 完成 ✓
