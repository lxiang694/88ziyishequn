-- ═══════════════════════════════════════════════════════════
-- 首頁橫幅（取代原本寫死的「四步驟完成購物」區塊）
--
-- 冪等，可重複執行。
--
-- 原本那塊是寫死在 components/front/HomeClient.tsx 裡的四個步驟圖示，
-- 要換內容得改程式重新部署。改成後台上傳一張 16:9 的圖片。
--
-- 沒有上傳、或圖片被關掉時，首頁會自動用回原本的四步驟區塊 ——
-- 首頁不該因為一個還沒設定的欄位就開一個天窗。
-- ═══════════════════════════════════════════════════════════

create table if not exists home_banners (
  -- 只會有一列。用 CHECK 鎖住 id，避免哪天多插了一列之後，
  -- 前台到底該顯示哪一張變成看運氣。
  id          int primary key default 1,

  image_url   text,
  -- 圖片的文字說明。這塊區域原本放的是「怎麼完成下單」這種實際資訊，
  -- 換成圖片之後沒有說明文字，用讀屏軟體的人與搜尋引擎就什麼都拿不到。
  -- 所以前台把「有 alt_text」當成顯示條件之一。
  alt_text    text not null default '',
  -- 點擊後前往的站內路徑；留空代表圖片不可點
  link_path   text,
  is_active   boolean not null default false,

  updated_at  timestamptz not null default now(),
  updated_by_admin_id bigint,

  constraint home_banner_singleton check (id = 1),
  constraint home_banner_alt_len_chk check (char_length(alt_text) <= 200),
  -- 與 site_popups 同一套規則：只能是站內路徑，且不可帶參數
  constraint home_banner_link_chk check (
    link_path is null
    or (link_path like '/%' and link_path not like '//%'
        and position('?' in link_path) = 0
        and position('#' in link_path) = 0)
  )
);

-- 先放一列空的，後台開啟頁面時就有東西可以編輯，不用處理「還沒有列」的狀況
insert into home_banners (id) values (1) on conflict (id) do nothing;


-- ═══════════════════════════════════════════════════════════
-- 執行完之後
-- ═══════════════════════════════════════════════════════════
-- 後台 →「前台彈窗」下方的「首頁橫幅」，上傳圖片並打開開關即可。
-- 建議尺寸 1600×900（16:9）。比例不同不會破版，但會被裁掉邊，
-- 上傳時畫面會告訴你會裁到哪裡。
-- ═══════════════════════════════════════════════════════════
