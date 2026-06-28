-- ===========================================================
-- LINE 邀請裂變 + 積分系統 — 資料表
-- 在 Supabase SQL Editor 執行此檔案即可
-- ===========================================================
-- 流程：
--   1. 每位會員有一組專屬 referral_code 與積分 points
--   2. 會員分享邀請連結（/invite/{code}）給朋友
--   3. 朋友加入 LINE 官方帳號並送出含邀請碼的訊息
--   4. LINE webhook 收到後，自動發 10 積分給邀請人（同一個 LINE 帳號只計一次）
-- ===========================================================

-- 1. user_profiles 增加「邀請碼」與「積分」欄位
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 0;

-- 邀請碼唯一索引（NULL 不受限，待會員第一次開啟邀請頁才產生）
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_referral_code
  ON user_profiles(referral_code)
  WHERE referral_code IS NOT NULL;

-- 2. 邀請成功紀錄表（一個 LINE 帳號只能被邀請成功一次）
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- 邀請人（會員）
  referred_line_user_id TEXT NOT NULL,        -- 被邀請的朋友（LINE userId）
  code TEXT NOT NULL,                          -- 當時使用的邀請碼
  status TEXT NOT NULL DEFAULT 'rewarded',     -- rewarded / pending / void
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 同一個 LINE 帳號只能成功被邀請一次（防刷的關鍵）
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_line_user
  ON referrals(referred_line_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(created_at DESC);

ALTER TABLE referrals DISABLE ROW LEVEL SECURITY;

-- 3. 積分異動明細（每次加減分都留一筆，方便對帳）
CREATE TABLE IF NOT EXISTS points_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INT NOT NULL,                          -- 正數加分、負數扣分
  reason TEXT NOT NULL,                         -- referral / manual / redeem ...
  ref_type TEXT,                               -- 關聯類型，例如 line_follow
  ref_id TEXT,                                 -- 關聯 ID，例如被邀請者的 LINE userId
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON points_ledger(user_id, created_at DESC);

ALTER TABLE points_ledger DISABLE ROW LEVEL SECURITY;

-- 4. 核心函式：兌換邀請積分（原子操作，避免併發重複發分）
--    回傳 jsonb：{ status, referrer, points }
--    status = rewarded / already_referred / invalid_code
CREATE OR REPLACE FUNCTION public.redeem_referral(
  p_code text,
  p_line_user_id text,
  p_points int DEFAULT 10
)
RETURNS jsonb AS $$
DECLARE
  v_referrer uuid;
  v_new_points int;
BEGIN
  -- 找出邀請碼對應的會員
  SELECT id INTO v_referrer
  FROM user_profiles
  WHERE referral_code = upper(p_code)
  LIMIT 1;

  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  -- 這個 LINE 帳號之前已被邀請成功過 → 不重複發分
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_line_user_id = p_line_user_id) THEN
    RETURN jsonb_build_object('status', 'already_referred');
  END IF;

  -- 記錄邀請成功 + 發積分 + 寫明細
  INSERT INTO referrals(referrer_user_id, referred_line_user_id, code, status, points_awarded)
  VALUES (v_referrer, p_line_user_id, upper(p_code), 'rewarded', p_points);

  UPDATE user_profiles
  SET points = COALESCE(points, 0) + p_points
  WHERE id = v_referrer
  RETURNING points INTO v_new_points;

  INSERT INTO points_ledger(user_id, delta, reason, ref_type, ref_id)
  VALUES (v_referrer, p_points, 'referral', 'line_follow', p_line_user_id);

  RETURN jsonb_build_object('status', 'rewarded', 'referrer', v_referrer, 'points', v_new_points);

EXCEPTION WHEN unique_violation THEN
  -- 併發情況下另一個請求已先寫入 → 視為已邀請
  RETURN jsonb_build_object('status', 'already_referred');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 完成 ✓
