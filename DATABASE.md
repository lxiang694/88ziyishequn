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
