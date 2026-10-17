-- ============================================================================
-- 後台登入鎖定：同一個帳號連續輸錯 3 次密碼，鎖定 15 分鐘
-- ============================================================================
-- 沒有限制時，可以用程式不停猜密碼。鎖在資料庫（而不是伺服器記憶體）：
-- Vercel 每次請求可能是不同的機器，記在記憶體裡等於沒鎖。
--
-- 可以重複執行。在 Supabase → SQL Editor 貼上整份執行即可。
-- 還沒執行前，後台照常可以登入，只是沒有鎖定功能。
-- ============================================================================

ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS failed_login_count int NOT NULL DEFAULT 0;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- 記一次密碼錯誤。用同一個 UPDATE 加一，同時送出的多個錯誤嘗試也不會漏算。
-- 到達上限：鎖定到 now() + p_minutes，計數歸零（解鎖後重新算 3 次）。
-- 回傳更新後的錯誤次數與鎖定時間；帳號不存在時回傳空的一列。
CREATE OR REPLACE FUNCTION public.admin_login_failed(p_account text, p_max int DEFAULT 3, p_minutes int DEFAULT 15)
RETURNS TABLE (failed_count int, locked_until timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.admin_users u SET
    failed_login_count = CASE WHEN u.failed_login_count + 1 >= p_max THEN 0 ELSE u.failed_login_count + 1 END,
    locked_until       = CASE WHEN u.failed_login_count + 1 >= p_max THEN now() + make_interval(mins => p_minutes) ELSE u.locked_until END
  WHERE u.account = p_account
  RETURNING u.failed_login_count, u.locked_until;
$$;

-- 只有伺服器（service_role）能呼叫；公開金鑰不行
REVOKE ALL ON FUNCTION public.admin_login_failed(text, int, int) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.admin_login_failed(text, int, int) FROM anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.admin_login_failed(text, int, int) TO service_role';
  END IF;
END $$;

-- 被鎖住又急著進後台：超級管理員在「帳號管理」幫他改密碼就會一併解鎖；
-- 或在這裡手動解鎖（把 'admin' 換成帳號）：
--   UPDATE admin_users SET failed_login_count = 0, locked_until = NULL WHERE account = 'admin';
