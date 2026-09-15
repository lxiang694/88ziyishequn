-- ═══════════════════════════════════════════════════════════
-- 訂單來源欄位
--
-- 冪等，可重複執行。
--
-- 為什麼要這個欄位：
--   目前無法回答「上個月 FB 廣告花的錢帶來幾筆訂單」，因為訂單
--   完全沒有來源紀錄。沒有這欄，之後做數據分析也只是把同一份
--   沒有維度的資料換個畫面看。
--
--   埋得越晚，能回頭分析的期間就越短。這欄本身不做任何事，
--   它的價值兩個月後才會出現。
-- ═══════════════════════════════════════════════════════════

alter table orders add column if not exists source text;
alter table orders add column if not exists created_by_admin_id bigint;

-- 既有訂單一律留 null（= 未記錄）。
-- 不回填成 'web' —— 那些訂單有一部分其實是從 Line 私訊來的，
-- 由老闆代打進結帳頁，回填會製造一份看起來精確但是錯的數據。
comment on column orders.source is
  '訂單來源；null = 此欄位上線前的舊訂單，未記錄';
comment on column orders.created_by_admin_id is
  '由後台代客下單時的管理員 id；客戶自行下單為 null';

-- 白名單。沒有這個約束，來源欄位過三個月就會出現
-- 'line'、'LINE'、'line私訊'、'Line DM' 四種寫法，然後無法統計。
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_source_chk'
  ) then
    alter table orders add constraint orders_source_chk check (
      source is null or source in (
        'web',          -- 客戶自己在網站下單
        'line_dm',      -- Line 私訊，由後台代客下單
        'line_group',   -- Line 社群
        'facebook',
        'instagram',
        'threads',
        'fb_ad',        -- Facebook 付費廣告
        'phone',        -- 電話
        'other'
      )
    );
  end if;
end $$;

create index if not exists idx_orders_source
  on orders(source, created_at desc) where source is not null;

create index if not exists idx_orders_created_by_admin
  on orders(created_by_admin_id) where created_by_admin_id is not null;

-- 完成 ✓
