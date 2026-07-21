-- ===========================================================
-- 後台權限細分 + 操作稽核日誌
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================

-- 1. 每個帳號可自訂權限（覆蓋角色預設；為空則沿用角色權限）
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS permissions_json JSONB;

-- 2. 新增「社群活動人員」角色（只能查看/管理活動報名）
INSERT INTO admin_roles (role_key, role_name, permissions_json)
SELECT 'event_staff', '社群活動人員', '["events.view"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE role_key = 'event_staff');

-- 3. 操作稽核日誌（誰在什麼時間瀏覽了哪個頁面、下載了哪些資料）
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id INT,
  admin_name TEXT,
  admin_account TEXT,
  action TEXT NOT NULL,        -- page_view / export_customers / export_event_registrations ...
  detail TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at DESC);

ALTER TABLE admin_audit_logs DISABLE ROW LEVEL SECURITY;

-- 完成 ✓
