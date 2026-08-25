-- ═══════════════════════════════════════════════════════════
-- Sprint C 權限開通（選用）
--
-- 建議做法是到後台「系統管理 → 帳號管理」用勾選的，
-- 這份 SQL 是給想一次設定好的人。全部可重複執行。
--
-- 權限存在兩個地方：
--   admin_roles.permissions_json  —— 角色預設
--   admin_users.permissions_json  —— 個別帳號覆蓋（有值就蓋過角色）
--
-- super_admin 的權限是 'all'，本來就涵蓋全部，不需要動。
-- ═══════════════════════════════════════════════════════════


-- ── A. 先看目前有哪些角色與權限 ────────────────────────────
-- 執行後對照結果，再決定下面要跑哪幾段。

select role_key, role_name, permissions_json from admin_roles order by role_key;

select id, name, account, role_key, permissions_json
from admin_users order by id;


-- ── B. 建立三個建議角色 ────────────────────────────────────
-- 刻意把「能力驗證」與「派工」分給不同角色：
-- 否則派工的人可以自己補一張能力驗證，繞過媒合檢查。

insert into admin_roles (role_key, role_name, permissions_json)
select 'care_hr', '陪診人資',
       '["care_operations.view","care_staff.manage","care_staff_credential.manage"]'::jsonb
where not exists (select 1 from admin_roles where role_key = 'care_hr');

insert into admin_roles (role_key, role_name, permissions_json)
select 'care_scheduler', '陪診排班客服',
       '["care_operations.view","care_schedule.manage","care_staff_time_off.review"]'::jsonb
where not exists (select 1 from admin_roles where role_key = 'care_scheduler');

insert into admin_roles (role_key, role_name, permissions_json)
select 'care_dispatcher', '陪診派工客服',
       '["care_operations.view","care_schedule.manage","care_dispatch.manage"]'::jsonb
where not exists (select 1 from admin_roles where role_key = 'care_dispatcher');


-- ── C. 若角色已存在，改用這段更新權限 ──────────────────────
-- （B 段的 insert 遇到已存在的角色不會覆蓋，這是刻意的，
--   避免不小心洗掉您手動調整過的設定。要更新請跑這段。）

-- update admin_roles
--   set permissions_json = '["care_operations.view","care_staff.manage","care_staff_credential.manage"]'::jsonb
--   where role_key = 'care_hr';

-- update admin_roles
--   set permissions_json = '["care_operations.view","care_schedule.manage","care_staff_time_off.review"]'::jsonb
--   where role_key = 'care_scheduler';

-- update admin_roles
--   set permissions_json = '["care_operations.view","care_schedule.manage","care_dispatch.manage"]'::jsonb
--   where role_key = 'care_dispatcher';


-- ── D. 把某個既有帳號直接加上人力權限 ──────────────────────
-- 把 '您的帳號' 換成 admin_users.account 的實際值。
-- 這是「附加」：保留原本已有的權限，只補上缺的，不會重複。

-- update admin_users
--   set permissions_json = (
--     select jsonb_agg(distinct p)
--     from jsonb_array_elements_text(
--       coalesce(permissions_json, '[]'::jsonb)
--       || '["care_operations.view","care_staff.manage","care_staff_credential.manage",
--            "care_schedule.manage","care_staff_time_off.review","care_dispatch.manage"]'::jsonb
--     ) as p
--   )
--   where account = '您的帳號';


-- ── E. 五個權限代碼對照 ────────────────────────────────────
--
--   care_staff.manage             名冊、僱用型態、服務區域
--   care_staff_credential.manage  能力驗證（陪診員不能自行標記為已驗證）
--   care_schedule.manage          班表與可服務時段檢視
--   care_staff_time_off.review    請假／暫停接案審核
--   care_dispatch.manage          人工媒合與兼職邀請
--
-- 讀取類清單接受上述任一項；寫入動作各自要求對應的那一個。


-- ── F. 設定完成後驗證 ──────────────────────────────────────

select u.account, u.name, u.role_key,
       coalesce(u.permissions_json, r.permissions_json) as effective_permissions
from admin_users u
left join admin_roles r on r.role_key = u.role_key
order by u.id;

-- 完成 ✓
