-- ============================================================================
-- 資料庫安全鎖：公開金鑰（anon）與會員登入（authenticated）不能直接讀寫資料表
-- ============================================================================
--
-- 為什麼要做：
--   網站的 Supabase「公開金鑰」(NEXT_PUBLIC_SUPABASE_ANON_KEY) 會出現在前台的
--   JavaScript 裡，任何人都拿得到。拿到之後可以不經過網站，直接呼叫 Supabase：
--     https://<專案>.supabase.co/rest/v1/<資料表>
--   幾個舊的遷移檔把 user_profiles、saved_addresses、community_event_registrations、
--   health_articles、page_views、admin_audit_logs 的 Row Level Security 關掉了，
--   等於會員資料、收件地址、報名名單公開可讀可改可刪。
--   orders、products、admin_users 等表不是在這個 repo 建的，狀態不明，一起鎖。
--
-- 會不會影響網站：
--   不會。網站的伺服器端一律用 service_role 金鑰（不受 RLS 限制）；前台瀏覽器
--   只用公開金鑰做會員登入（auth 結構，不在 public），不直接查資料表。
--
-- 可以重複執行。在 Supabase → SQL Editor 貼上整份執行即可。
-- ============================================================================

-- 1. 每一張 public 資料表都開啟 RLS（沒有任何 policy = anon／authenticated 一律讀不到）
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- 2. 收回 anon／authenticated 對資料表、檢視表（view 不受 RLS 管，要靠權限）、序號的所有權限
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 3. 函式：預設所有人（PUBLIC）都能執行，anon 也就能直接呼叫 place_order 等下單函式、
--    跳過網站的價格檢查。只留給伺服器（service_role）與資料庫擁有者。
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 會員註冊時 Supabase 用 supabase_auth_admin 建立帳號，觸發 handle_new_user()
-- 自動建立 user_profiles。那個函式是 SECURITY DEFINER（以擁有者身分執行、不受 RLS
-- 影響）；保險起見仍保留 supabase_auth_admin 的函式執行權限，註冊不會受影響。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO supabase_auth_admin';
  END IF;
END $$;

-- 4. 以後新建的表與函式也預設不給 anon／authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 5. 檢查：執行完下面這段應該是空的（沒有任何 public 資料表還關著 RLS）
SELECT tablename AS "仍未開啟 RLS 的資料表"
FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;
