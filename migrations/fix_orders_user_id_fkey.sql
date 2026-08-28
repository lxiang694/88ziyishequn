-- ═══════════════════════════════════════════════════════════
-- 修正：orders.user_id 的外鍵指向錯誤的表
--
-- 症狀
--   會員登入後下單，訂單成立、拿得到訂單編號，但「我的訂單」
--   看不到。收件人資料剛好等於註冊資料時看得到 —— 因為那是靠
--   手機號碼比對撈出來的，不是靠 user_id。
--
-- 原因
--   正式資料庫的 orders_user_id_fkey 指向 public.app_users，
--   但這個專案沒有 app_users 這張表（整個 repo 裡不存在）。
--   會員系統用的是 Supabase Auth，寫進 orders.user_id 的一定是
--   auth.users.id，永遠不會出現在 app_users 裡，所以每一次連結
--   都以 23503 外鍵違反失敗。舊程式碼沒有檢查更新結果，
--   於是失敗了幾百次都沒有任何紀錄。
--
--   membership_schema.sql 原本就寫 references auth.users(id)，
--   所以這是資料庫被改過，不是 migration 寫錯。推測是把別的
--   專案（app_user 那一套 schema）的 migration 跑到這個資料庫上。
--
-- 冪等，可重複執行。
-- ═══════════════════════════════════════════════════════════

-- ── 1. 先清掉對不上 auth.users 的殘留值 ────────────────────
-- 正常情況下這裡是 0 筆（因為以前從來沒寫成功過）。
-- 有值的話代表那些 id 來自別的系統，留著會讓下面的 add 失敗。
update orders
   set user_id = null
 where user_id is not null
   and user_id not in (select id from auth.users);


-- ── 2. 重建外鍵，指向 auth.users ───────────────────────────
alter table orders drop constraint if exists orders_user_id_fkey;

alter table orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

create index if not exists idx_orders_user_id on orders(user_id);


-- ── 3. 驗證 ────────────────────────────────────────────────
-- 應回傳一筆，「目前指向」是 auth.users
--
--   select ccu.table_schema || '.' || ccu.table_name as 目前指向
--   from information_schema.table_constraints tc
--   join information_schema.constraint_column_usage ccu
--     on ccu.constraint_name = tc.constraint_name
--   where tc.constraint_type = 'FOREIGN KEY'
--     and tc.table_name = 'orders'
--     and tc.constraint_name = 'orders_user_id_fkey';
--
-- 另外建議檢查還有沒有其他表的外鍵也被指到 app_users：
--
--   select tc.table_name as 來源表, kcu.column_name as 欄位
--   from information_schema.table_constraints tc
--   join information_schema.key_column_usage kcu
--     on kcu.constraint_name = tc.constraint_name
--   join information_schema.constraint_column_usage ccu
--     on ccu.constraint_name = tc.constraint_name
--   where tc.constraint_type = 'FOREIGN KEY'
--     and ccu.table_name in ('app_users','app_user');

-- 完成 ✓
