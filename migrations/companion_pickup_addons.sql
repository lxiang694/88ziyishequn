-- ===========================================================
-- 陪診服務：到府接送地址與加購費用
-- 需先執行 companion_care_schema.sql / companion_settlement.sql
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================

-- 接送資訊（客服與客戶確認後填寫）
alter table care_bookings add column if not exists pickup_address text;  -- 接送詳細地址
alter table care_bookings add column if not exists pickup_time    text;  -- 到府時間，例：08:00
alter table care_bookings add column if not exists pickup_note    text;  -- 補充：大樓警衛、電梯、需上樓攙扶…

-- 加購費用
alter table care_bookings add column if not exists addon_fee           integer default 0; -- 客戶加付金額（應收）
alter table care_bookings add column if not exists addon_companion_fee integer default 0; -- 加購部分給陪診員的報酬

-- 完成 ✓
-- 營收 = price + addon_fee + extra_fee
-- 陪診員報酬 = companion_fee + addon_companion_fee
