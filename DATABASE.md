# DATABASE

> 本文件於 Sprint B 建立。專案先前沒有任何 `.md` 文件，因此這裡只記錄
> **已經確認存在於程式碼中的內容**，不追溯補寫未經驗證的歷史。

## Migration 慣例

Migration 放在 `migrations/`，以 SQL 檔存在，由人工於 Supabase SQL Editor 執行。

專案**沒有** `supabase/` 目錄，也沒有 Supabase CLI 的 migration 流程。
所有檔案都寫成可重複執行（`create table if not exists` / `add column if not exists` /
`create or replace function`），因此不確定跑過與否時可以再跑一次。

已套用的 migration 不得改寫；要修正就新增一個檔案。

## 陪診營運（Sprint B）

Migration：`migrations/care_operations_schema.sql`

### 責任邊界

| 資料表 | 責任 | 不負責 |
|---|---|---|
| `care_intakes` | 人工初評所需的最低必要服務安排資訊 | 不是預約，不是醫療紀錄 |
| `care_cases` | 營運案件的生命週期 | 不取代 `care_bookings` 的正式預約責任 |
| `care_quote_estimates` | 版本化的報價快照 | 不是帳單，不是付款紀錄 |
| `care_quote_items` | 報價的結構化明細 | 不放整張表單的 JSON |

與既有 `care_bookings` 的關係：`care_bookings` 是「已成立的正式預約」，
本輪完全不修改它。`care_intakes` 是「尚未成立預約的初步需求」，是本流程的 root。
`care_cases.converted_booking_id` 為未來串接預留，本輪不寫入。

### 這些表不是醫療紀錄

`care_intakes` 明確**不蒐集**：完整病史、診斷結論、處方內容、藥物劑量、
治療建議、身分證／健保卡號、病歷影像、健保資料、支付 token。

`limited_support_note` 刻意不命名為 `medical_history`：它的用途限於
「當天流程協助的補充說明」，資料庫層以 `check (char_length(...) <= 200)` 強制限長。

### care_intakes

主要欄位與約束：

- `service_scenario` — `routine_visit` / `visit_with_tests` /
  `multi_department_or_full_day` / `post_procedure_discharge` / `unsure`
- `mobility_support_level` — `independent` / `assistive_device` / `wheelchair` /
  `manual_review_required`
- `transport_support_requested` boolean
- `hospital_name`、`county`、`scheduled_service_date`、`time_preference`
- `contact_name`、`contact_phone`、`contact_line_id`、`contact_preference`（`phone` / `line`）
- `relationship_to_beneficiary`
- `limited_support_note`（≤ 200 字）、`review_note`（≤ 500 字）
- `status` — `submitted` / `in_review` / `needs_more_information` / `declined` /
  `converted_to_case`
- `decline_reason_code` — `status = 'declined'` 時為必填（check constraint）
- `source`、`submitter_ip_hash`（只存雜湊，不存原始 IP）
- `reviewed_by_admin_id`、`reviewed_at`、`created_at`、`updated_at`

索引：`status`、`created_at desc`、`scheduled_service_date`、
`(submitter_ip_hash, created_at desc)`（防濫用查詢用）。

### care_cases

- `case_no` unique、`intake_id` **unique** FK（一筆初評最多轉出一個案件）
- `status` — `needs_assessment` / `awaiting_quote_confirmation` / `awaiting_payment` /
  `ready_to_match` / `cancelled`
- `cancel_reason_code` — `status = 'cancelled'` 時為必填
- `payment_marked_by`、`payment_marked_at` — **人工**確認收款的紀錄，不是金流證明

### care_quote_estimates

- `(care_case_id, version)` unique — 報價是版本化快照
- 方案 immutable snapshot：`service_code`、`service_name_snapshot`、`base_fee`
- `travel_estimate_amount` + `travel_estimate_basis`（1–300 字，必填）
- `overtime_rule_snapshot`（1–300 字，必填）—— 不可只寫「另計」
- `currency` check 限定 `TWD`
- `total_estimate` — 由伺服器重算後寫入
- `valid_until`、`sent_at`、`confirmed_at`、`confirmed_by_label`、
  `confirmed_by_admin_id`、`expired_at`、`cancelled_at`、`cancel_reason_code`
- 唯一部分索引 `uniq_care_quote_confirmed_per_case`：一個案件同時只能有一份 `confirmed` 報價

### 資料庫端狀態機

狀態轉換不只靠 Service 與 UI，資料庫也有 trigger：

| Trigger | 函式 | 作用 |
|---|---|---|
| `trg_care_intakes_status` | `care_guard_intake_status` | 擋下非法初評轉換 |
| `trg_care_cases_status` | `care_guard_case_status` | 擋下非法案件轉換 |
| `trg_care_quotes_guard` | `care_guard_quote_write` | 擋下非法報價轉換，且 `confirmed` / `expired` / `cancelled` 的金額與快照不可修改 |
| `trg_care_quote_items_guard` | `care_guard_quote_items` | 報價非 `draft` 時明細不可新增／修改／刪除 |

另有 `care_touch_updated_at` 維護三張主表的 `updated_at`。

### RLS

四張表都 `enable` 且 `force row level security`，並對 `anon` / `authenticated`
`revoke all`，**不建立任何 policy** —— 即預設全部拒絕。

⚠️ 重要且必須誠實記載：本專案後台一律使用 service_role client，
**service_role 會繞過 RLS**。因此 RLS 在此是縱深防禦（擋 anon key 與
authenticated 身分），不是後台路徑的授權強制點。實際強制點見 `SECURITY.md`。

## 資料移轉風險

本 migration **只新增**資料表、函式與 trigger，不修改也不刪除任何既有欄位或資料，
因此對現有商城、訂單、會員、陪診預約與結算功能沒有回溯風險。

唯一需要留意的是：`care_intakes.converted_booking_id` 對 `care_bookings(id)`
建立 FK，因此執行本檔案前必須先執行 `migrations/companion_care_schema.sql`。

## 陪診履約（Sprint D）

Migration：`migrations/care_fulfilment_schema.sql`

### 服務主體

**`care_bookings` 就是服務 root。** 本專案沒有 ServiceOrder / Assignment / ServiceTask
三層模型（Sprint D 的規格書假設有，實際沒有）。Sprint D 的所有資料表一律 FK 到
`care_bookings`，刻意不另建平行的服務關係。

### 與既有 care_booking_events 的分工

| 資料表 | 責任 |
|---|---|
| `care_booking_events` | 既有的陪診員工單時間軸，自由文字＋照片，仍由既有 `/companion` 工單頁使用。本輪不修改 |
| `care_service_events` | Sprint D 的**受控**事件：型別白名單、append-only、伺服器寫入時間、家屬可見性分層、更正留痕 |

兩者 FK 到同一個 booking，不是兩套服務關係。後續 Sprint 應把工單頁遷移到受控事件後淘汰舊表。

### 資料表責任

| 資料表 | 責任 | 不是什麼 |
|---|---|---|
| `care_service_events` | 結構化客觀節點 | 不是聊天記錄、不是病歷 |
| `care_service_records` | 陪診員的內部客觀紀錄草稿與審核 | 不是病歷，不對家屬公開 |
| `care_family_summaries` | 已審核、可發布／撤回的版本化小結 | 不是原始紀錄的直接曝光 |
| `care_incidents` | 非診療的營運異常與升級 | 不是醫療風險分級，不是急救系統 |
| `care_service_authorizations` | 單筆服務的家屬授權 | 不是服務條款、不是付款、不是長期家庭授權 |
| `care_settlement_lines` / `care_settlement_batches` | 兼職結算基礎與審核軌跡 | 不是付款、不是薪資、不存銀行資料 |

### 關鍵約束

- `care_service_events`：`occurred_at` 由資料庫 `default now()` 寫入；trigger 擋下 DELETE 與內容改寫，只允許標記作廢
- `care_service_records`：`uniq_care_rec_active_per_booking` 保證一筆服務只有一份進行中的紀錄；`reviewed` 的內容不可改寫
- `care_family_summaries`：`uniq_care_sum_published_per_booking` 保證同時只有一份已發布；已發布內容不可改寫
- `care_incidents`：trigger **直接擋下** `notification_status = 'sent_or_confirmed'`，因為沒有任何通知 provider
- `care_service_authorizations`：trigger 擋下 `view_service_photo`（本輪停用）
- `care_settlement_lines`：`unique (booking_id, line_type)` 防止重試／並發重複計算；trigger 擋下 `fulltime`

### 與既有結算的關係

本檔案**不修改** `care_bookings` 上既有的結算欄位，也不動 `/admin/settlement`。
那套仍是目前實際在用的系統。lines/batches 是附加的可稽核基礎，兩套是否整併是後續的營運決定。
兩套都不會自動付款。

### RLS

七張表全部 `enable` + `force` RLS，對 `anon` / `authenticated` `revoke all`，不建立任何 policy。
與 Sprint B 同樣是縱深防禦——後台與陪診員端走 service_role 會繞過 RLS。詳見 `SECURITY.md`。

### 資料移轉風險

只新增，不修改也不刪除既有欄位或資料。依賴 `care_bookings` 與 `companions` 已存在
（`companion_care_schema.sql`），以及 `care_touch_updated_at()`（`care_operations_schema.sql`），
因此必須在那兩份之後執行。

---

## 陪診人力與媒合（Sprint C）

Migration：`migrations/care_staffing_schema.sql`（冪等，可重複執行）。

> 執行順序說明：Sprint D 的 migration 先寫出來，但 Sprint C 是它的前置。
> 兩份互不衝突、也不互相依賴外鍵，先執行哪一份都可以，但**兩份都要執行**。

### 責任邊界

這一輪處理的是「誰能做這筆服務、什麼時候有空、要不要接」。
**不處理**薪資、銀行帳戶、付款、發票、金流，也不處理自動或 AI 派工——
所有指派都由後台人員按下按鈕，系統只負責擋掉不該成立的組合。

### 與既有資料表的關係

沿用既有的 `companions`（陪診員帳號）與 `care_bookings`（正式服務工單），
不另建 StaffProfile 或 Assignment 表：

| 規格書名詞 | 這個 codebase 的實體 |
| --- | --- |
| StaffProfile | `companions` |
| Assignment | `care_bookings.companion_id` 有值 |
| ServiceOrder | `care_bookings` |

### 新增的橋接欄位

Sprint B 的 `care_cases` 原本沒有任何欄位連到 `care_bookings`，
所以「案件談成了要開始排人」這一步在資料上是斷的。本輪補上：

```sql
alter table care_cases add column if not exists booking_id bigint references care_bookings(id);
create unique index uniq_care_case_booking on care_cases(booking_id) where booking_id is not null;
```

由 `materializeCareCaseBooking()` 建立，且是冪等的——重複呼叫回傳同一筆 booking，
不會產生兩張工單。

### 資料表責任

| 表 | 負責什麼 | 誰能寫 |
| --- | --- | --- |
| `staff_employment_terms` | 全職／兼職、生效期間、暫停或結束 | 只有後台 |
| `staff_service_regions` | 這個人服務哪些縣市 | 只有後台 |
| `staff_capabilities` | 能力代碼字典（4 筆種子資料） | 只有 migration |
| `staff_capability_verifications` | 誰驗證了哪項能力、何時到期 | 只有後台 |
| `staff_availability_rules` | 兼職每週固定願意接案的時段 | 陪診員本人 |
| `staff_time_off_requests` | 請假／暫停接案的申請與審核 | 本人送出、後台審核 |
| `care_dispatch_proposals` | 給兼職的服務邀請 | 後台建立、本人回覆 |

陪診員**不能**改自己的僱用型態，也不能自行驗證能力——那兩張表在
API 層完全沒有本人可呼叫的寫入路徑。

### 關鍵約束

```sql
-- 一個人同時只能有一筆未結束的僱用條件
create unique index uniq_set_open_per_companion
  on staff_employment_terms(companion_id) where status <> 'ended';

-- 一筆服務只能有一筆被接受的邀請
create unique index uniq_cdp_accepted_per_booking
  on care_dispatch_proposals(booking_id) where status = 'accepted';

-- 同一人對同一筆服務不會收到兩張待回覆邀請
create unique index uniq_cdp_open_per_pair
  on care_dispatch_proposals(booking_id, companion_id) where status = 'proposed';
```

### 併發保護：`care_accept_dispatch_proposal()`

兩個兼職同時按下「接受」時，**只有一個會成功**。這不是靠前端把按鈕變灰，
而是資料庫函式在同一個交易裡：

1. `select ... for update` 鎖住邀請列
2. 檢查狀態、期限、僱用資格
3. `select companion_id ... for update` 鎖住 `care_bookings` 該列
4. 若已有人被指派 → 把這張邀請改成 `cancelled`，回傳 `already_assigned`
5. 否則寫入 `care_bookings.companion_id`、把邀請改成 `accepted`，
   並把同一筆服務的其他待回覆邀請改成 `cancelled`

回傳 `(ok, reason, out_booking_id)`，reason 是穩定的代碼，由 Service 層翻成中文。

### 狀態機（資料庫層 trigger）

- `staff_time_off_requests`：`submitted → approved / rejected / cancelled`，終態不可再改
- `care_dispatch_proposals`：`proposed → accepted / declined / expired / cancelled`，終態不可再改

### Backfill

從既有欄位帶入，不是猜測：

- `companions.employment_type`：舊值只有 `fulltime` / `parttime`，對應到 `full_time` / `part_time`
- `companions.service_areas`（jsonb 陣列）→ `staff_service_regions`

若日後出現無法對應的值，`normalizeLegacyEmploymentType()` 回傳 `null` 而不是猜一個，
該筆會需要人工補。

### RLS

同 Sprint B/D：7 張表全部 `enable` + `force` row level security，
並 `revoke all from anon, authenticated`。伺服器端走 service_role，
所以 RLS 是縱深防禦，**不是**授權的實際強制點——真正的強制點在
Route Handler 與 Service 層。

---

## 陪診營運閉環（Sprint E）

Migration：`migrations/care_operations_closure_schema.sql`（冪等）。
前置：Sprint B／C／D 三份都要先跑過。

### 責任邊界

這一輪處理的是「事情有沒有人接手、有沒有做完、家屬知不知道」。
**不處理**外部訊息發送、背景排程、真實付款、醫療內容。

### 資料表責任

| 表 | 負責什麼 | 誰能寫 |
| --- | --- | --- |
| `care_notifications` | 站內通知收件匣 | 只有伺服器；收件人只能改狀態 |
| `care_notification_preferences` | 站內通知的開關 | 只有本人 |
| `care_notification_outbox` | 未來外部通道的資料結構 | 只有伺服器；本輪一律 `not_configured` |
| `care_feedback_requests` | 回饋邀請 | 後台建立 |
| `care_feedback` | 家屬填的回饋 | 只有本人送出一次 |
| `care_concerns` | 意見／申訴追蹤 | 家屬、陪診員、營運皆可建立；只有營運可處理 |
| `care_quality_reviews` | 內部品質覆核 | 只有督導 |
| `care_quality_follow_ups` | 改善事項 | 督導建立；陪診員只能回報自己的完成 |
| `care_policy_versions` | 條款／隱私版本 | 只有 `care_policy.manage` |
| `care_policy_acceptances` | 接受紀錄 | 只有伺服器；建立後不可改也不可刪 |
| `care_data_lifecycle_reviews` | 資料保留待辦 | 只有 `care_data_lifecycle.manage` |

### 通知內容在資料庫層就限長

```sql
constraint care_notif_title_len_chk check (char_length(title) <= 60),
constraint care_notif_body_len_chk check (body is null or char_length(body) <= 200),
constraint care_notif_link_chk check (link_path is null or link_path like '/%')
```

就算日後有人繞過 Service 直接寫入，也塞不進一整段服務紀錄，
也不能把使用者導到站外網址。

### `care_guard_outbox`：擋下假的「已送出」

check constraint 已經限制了狀態值，trigger 再擋一次：

```sql
if new.status in ('sent','delivered','sent_or_confirmed','success') then
  raise exception '沒有已核准的外部通知 provider，不可標記為已送出';
end if;
```

刻意重複，因為 constraint 可以被 `alter table` 放寬，trigger 比較不會被順手改掉。

### 其他資料庫層保護

- `care_guard_notification`：內容與收件人建立後不可修改；`read_at` 由資料庫寫
- `care_block_delete`：`care_notifications` 與 `care_policy_acceptances` 不可刪除
- `care_guard_feedback`：分數與意見送出後不可修改
- `care_guard_concern`：狀態機（open → acknowledged → resolved → closed），結案不可重開
- `care_guard_policy_version`：已發布正文不可改寫；正文空白不可發布
- `care_guard_policy_acceptance`：接受紀錄不可修改（`raise exception` on UPDATE）

### 關鍵唯一性

```sql
-- 一位家屬對一筆服務只有一張回饋邀請
constraint care_fbreq_uniq unique (booking_id, recipient_user_id)
-- 一張邀請只收一份回饋
constraint care_fb_request_uniq unique (request_id)
-- 一筆服務只有一份品質覆核
constraint care_qr_booking_uniq unique (booking_id)
-- 同一種文件同時只有一個已發布版本
create unique index uniq_care_policy_published
  on care_policy_versions(policy_kind) where status = 'published';
```

### 政策種子

只建 4 筆 `draft`，`body_text` 為 **null**。系統不代寫任何條款文字，
上線檢核會因此標示為待處理，直到營運與法務填入正文並發布。

### RLS

11 張表全部 `enable` + `force` + `revoke all from anon, authenticated`。
與前幾輪相同，RLS 是縱深防禦，強制點在 Route Handler 與 Service。
