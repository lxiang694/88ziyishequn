-- ===========================================================
-- 陪診結算：額外報酬（給陪診員）與結算軌跡
-- 需先執行 companion_care_schema.sql / companion_settlement.sql
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================

-- 額外「報酬」＝加給陪診員的錢（超時、臨時加班、獎勵…）
-- 與既有的 extra_fee 不同：extra_fee 是向「客戶」多收的錢（營收），
-- extra_companion_fee 是多付給「陪診員」的錢（成本），兩者不可混用。
alter table care_bookings add column if not exists extra_companion_fee integer default 0;

-- 結算軌跡（誰在什麼時候結算的，供日後對帳查核）
alter table care_bookings add column if not exists settled_by text;

-- 完成 ✓
-- 陪診員實拿 = companion_fee + addon_companion_fee + extra_companion_fee
-- 平台營收   = price + addon_fee + extra_fee
