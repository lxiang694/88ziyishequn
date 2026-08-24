-- ===========================================================
-- 陪診服務：收入結算欄位
-- 需先執行 companion_care_schema.sql
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================

-- 方案預設的陪診員報酬（平台約抽 40%，可自行調整）
alter table care_services add column if not exists companion_fee integer;

update care_services set companion_fee = 600  where code = 'basic'    and companion_fee is null;
update care_services set companion_fee = 1100 where code = 'standard' and companion_fee is null;
update care_services set companion_fee = 2000 where code = 'full'     and companion_fee is null;
update care_services set companion_fee = 900  where code = 'postop'   and companion_fee is null;

-- 每筆預約的結算欄位
alter table care_bookings add column if not exists companion_fee   integer;      -- 該筆的陪診員報酬（可個別調整）
alter table care_bookings add column if not exists extra_fee       integer default 0; -- 額外收費（超時、加購等）
alter table care_bookings add column if not exists settled_at      timestamptz;  -- 結算時間（null = 未結算）
alter table care_bookings add column if not exists settlement_note text;

create index if not exists idx_care_bookings_settled on care_bookings(settled_at);

-- 既有已完成但尚未帶入報酬的預約，補上方案預設值
update care_bookings b
set companion_fee = s.companion_fee
from care_services s
where b.service_code = s.code and b.companion_fee is null;

-- 完成 ✓
-- 想調整拆帳比例：直接改 care_services.companion_fee 即可（之後的新預約會沿用）。
