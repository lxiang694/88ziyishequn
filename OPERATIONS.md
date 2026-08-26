# OPERATIONS

> 陪診營運的上線與日常操作說明（Sprint B）。

## 上線前必做

### 1. 執行 migration

在 Supabase SQL Editor 依序執行（皆可重複執行）：

```
migrations/companion_care_schema.sql        （若尚未執行）
migrations/care_operations_schema.sql       （Sprint B 新增）
```

`care_operations_schema.sql` 依賴 `care_bookings` 存在（FK），因此順序不可顛倒。

驗證：

```sql
select table_name from information_schema.tables
where table_name in ('care_intakes','care_cases','care_quote_estimates','care_quote_items');
```

應回傳 4 列。

### 2. 設定環境變數（建議）

```
CARE_INTAKE_IP_SALT=<自行產生的隨機字串>
```

未設定時會退回使用 `JWT_SECRET`，功能正常，但建議明確分開。

### 3. 開通權限

Migration **不會**自動賦予任何角色陪診權限。超級管理員（`'all'`）本來就能用。

要開給其他角色，到後台「帳號管理」勾選，或執行（可撤回）：

```sql
-- 範例：給 customer_service 初評與案件權限，但不給報價
update admin_roles
set permissions_json = (
  select jsonb_agg(distinct p) from jsonb_array_elements_text(
    permissions_json || '["care_operations.view","care_intake.manage","care_case.manage"]'::jsonb
  ) as t(p)
)
where role_key = 'customer_service';
```

撤回：

```sql
update admin_roles
set permissions_json = (
  select coalesce(jsonb_agg(p), '[]'::jsonb)
  from jsonb_array_elements_text(permissions_json) as t(p)
  where p not like 'care\_%'
)
where role_key = 'customer_service';
```

建議的最低授權原則：報價權限（`care_quote.manage`）與收款確認
（`care_case.manage`）不要給同一個人，形成基本的雙人覆核。

## 日常流程

```
客戶於 /care/assessment 送出
  → 後台「需求初評」出現（待初評）
  → 開始審查
  → 需要更多資訊？→ 要求補充資料
  → 不適合承接？→ 婉拒（必須選原因 code）
  → 可服務 → 轉為案件
  → 建立報價草稿 → 發送給家屬
  → 家屬確認 → 案件進入「等待付款確認」
  → 銀行端確認入帳後，人工按「已確認收款」
  → 案件進入「準備媒合」
```

### 重要提醒

**「已確認收款」不是金流證明。** 系統沒有串接任何付款或對帳，
按下按鈕前必須先在銀行端確認實際入帳。操作者會被記錄。

**報價一旦確認或過期就凍結。** 金額與快照不可修改（Service 與資料庫雙重防護）。
需要調整請作廢後建立新版本；報價作廢後案件會自動退回「待評估／待報價」。

**婉拒與取消都必須選原因 code。** 自由文字只能作為補充，且有長度上限。

## 監控與檢查

```
npm test              # 76 個單元／Service 測試
npm run check:care-ops # 陪診營運靜態安全檢查
npm run check:care     # 陪診品牌前台檢查
npm run check:zh       # 簡體字／中國用語檢查
```

前三項都接在 `npm run build` 之前，任一失敗都會擋下部署。

## 待產品／法務／營運決定的項目

以下在程式中是 placeholder 或需人工填入，**不要當成已完成**：

| 項目 | 現況 |
|---|---|
| 正式價格規則 | 報價的基本費取自 `care_services`；交通與超時規則每次由報價人員填寫，尚無統一規則 |
| 取消與退款政策 | `/care/safety#cancel` 為預留區塊，明寫「規則待正式公告」 |
| 資料保留期限 | 未定義。初評與案件目前無自動清理機制 |
| LINE 服務帳號 | 目前沿用商城客服帳號；設 `NEXT_PUBLIC_CARE_LINE_URL` 可切換 |
| 服務區域 | 初評收 `county` 自由選擇，尚未定義可服務縣市白名單 |
| 風險服務承接標準 | 婉拒原因有 `requires_medical_staff` / `beyond_service_scope`，但判斷標準未文件化 |
| 正式品牌名稱與營運主體 | `lib/careBrand.ts` 的 `name` 為暫定值，`legalEntity` 為空 |
| 家屬線上入口 | `/care/account` 只有入口頁，未實作驗證後查詢 |

## Sprint D 上線步驟

### 1. 執行 migration

依序（前兩份若已跑過可略）：

```
migrations/companion_care_schema.sql
migrations/care_operations_schema.sql
migrations/care_fulfilment_schema.sql   ← Sprint D
```

`care_fulfilment_schema.sql` 依賴 `care_bookings`、`companions` 與
`care_touch_updated_at()`，順序不可顛倒。

驗證：

```sql
select count(*) from information_schema.tables
where table_name in ('care_service_events','care_service_records',
  'care_family_summaries','care_incidents','care_service_authorizations',
  'care_settlement_lines','care_settlement_batches');
```

應回傳 7。

### 2. 開通權限

Migration 不自動賦予任何角色。超級管理員本來就能用。

建議分工（**不要給同一個人**）：

| 角色 | 權限 |
|---|---|
| 督導 | `care_record.review`、`care_summary.review`、`care_incident.manage` |
| 財務 | `care_settlement.manage` |
| 客服 | `care_operations.view` |

### 3. 日常流程

```
派工後，陪診員在 /companion → 工單 → 「服務紀錄與流程回報」
  → 服務當天逐一按流程節點（時間自動記錄）
  → 服務結束填服務紀錄 → 送出核對
督導在 /admin/care/records
  → 核可，或退回補正（必須選原因）
督導在 /admin/care/services/[id]
  → 逐筆決定哪些事件開放給家屬
  → 建立家屬小結草稿 → 送審 → 發布
  → 對特定家屬會員開通授權（付款人不會自動有）
財務在 /admin/care/settlements
  → 產生明細 → 審核 → 建批次 → 核准 → 發布
```

### 4. 重要提醒

**異常事件不是急救系統。** 現場緊急狀況請依院方流程與服務 SOP 立即處理。

**系統不會自動通知家屬。** 通知狀態最多到「已備妥，待人工聯繫」，
實際聯繫一律由人工以電話或 LINE 進行。

**發布批次不代表已付款。** 系統沒有任何金流，實際轉帳在系統外。

**家屬看不到任何東西，直到小結發布且授權開通。** 這是刻意的預設拒絕。

### Sprint D 待營運／法務／照護專業確認

| 項目 | 現況 |
|---|---|
| 事件與小結文案 | 已有預設，需照護專業複核用字是否會被誤解為醫療判斷 |
| incident SOP | 系統只有 code，實際處理標準與升級路徑未文件化 |
| 通知策略 | 無 connector。要接 LINE／SMS 需先決定內容範圍、授權與撤銷機制 |
| 資料保留與刪除 | 未定義。事件為 append-only，刪除政策需另行決定 |
| authorization／consent 文案 | 目前只有技術授權列，沒有給家屬看的同意書文字 |
| 服務責任與保險 | 網站未聲稱任何保險，取得後才可加上 |
| 結算規則與報酬模型 | 明細金額取自既有 `care_bookings` 欄位；統一費率規則未定 |
| 兩套結算是否整併 | 既有 `/admin/settlement` 仍是操作系統，lines/batches 為附加基礎 |

---

## Sprint C 上線步驟

### 1. 執行 migration

**Sprint C 的正確位置在 Sprint D 之前**（Sprint D 先被交付，是順序錯誤）。
兩份沒有外鍵互相依賴，先跑哪一份都能成功，但兩份都要跑。

在 Supabase → SQL Editor 貼上並執行：

```
migrations/companion_care_schema.sql       （若已跑過可略）
migrations/care_operations_schema.sql      （若已跑過可略）
migrations/care_staffing_schema.sql        ← Sprint C
migrations/care_fulfilment_schema.sql      ← Sprint D
```

`care_staffing_schema.sql` 依賴 `companions`、`care_bookings`、`care_cases`
與 `care_touch_updated_at()`。整份冪等，重複執行不會出錯。

驗證：

```sql
select count(*) from information_schema.tables
where table_name in ('staff_employment_terms','staff_service_regions',
  'staff_capabilities','staff_capability_verifications',
  'staff_availability_rules','staff_time_off_requests','care_dispatch_proposals');
-- 應回傳 7

select count(*) from staff_capabilities;
-- 應回傳 4（能力字典種子資料）

select count(*) from staff_employment_terms;
-- 應等於既有 companions 的筆數（backfill 從 companions.employment_type 帶入）

select proname from pg_proc where proname = 'care_accept_dispatch_proposal';
-- 應回傳 1 筆
```

**執行後請務必檢查 backfill 結果**：

```sql
select c.id, c.name, c.employment_type, t.employment_type, t.status
from companions c left join staff_employment_terms t
  on t.companion_id = c.id and t.status <> 'ended'
where t.id is null;
```

有回傳資料，代表那些人沒有僱用條件，媒合時會一律不合格。
請在「陪診人力」逐一補上。

### 2. 開通權限

Migration 不自動賦予任何角色。超級管理員（`all`）本來就能用。

到「系統管理 → 帳號管理」勾選：

| 角色 | 權限 |
|---|---|
| 人資／管理 | `care_staff.manage`、`care_staff_credential.manage` |
| 排班客服 | `care_schedule.manage`、`care_staff_time_off.review` |
| 派工客服 | `care_dispatch.manage` |

**建議不要把 `care_staff_credential.manage` 與 `care_dispatch.manage`
給同一個人**——否則派工者可以自己補一張能力驗證來繞過媒合檢查。

### 3. 日常流程

```
案件談成（Sprint B：/admin/care/cases 狀態 confirmed）
  → /admin/care/dispatch 按「開立正式工單」（materialize_case）
  → 系統列出候選人，每個人附上不合格原因

  全職 → 按「直接指派」，立即成立，陪診員在 /companion 就看得到
  兼職 → 按「發出邀請」，可同時發給多人，設定回覆期限（1～168 小時）
          → 兼職在 /companion → 「📨 服務邀請」看到去敏感化摘要
          → 接受 → 正式成立，其他人的邀請自動轉「已取消」
          → 婉拒 → 要選原因，後台可以再發給別人

請假／暫停接案
  陪診員在 /companion → 「🗓 請假」或「🚫 暫停接案」送出
  → /admin/care/time-off 審核
  → 若期間內已有指派的服務，系統會擋下核准並列出那些服務
```

### 4. 重要提醒

- **邀請不是指派**。發出邀請後那筆服務仍是未指派狀態，
  不要因為「已經發出去了」就當作排好了。回覆期限到了要記得追。
- **同時發給多人是刻意設計**。誰先接受誰拿到，資料庫保證只有一個成功，
  不必擔心兩個人同時按下去會撞在一起。
- **能力驗證會過期**。過期等同沒有，那個人就不會出現在候選人裡。
  到期前請在「陪診人力 → 能力驗證」重新驗證。
- **兼職的「可服務時段」不是班表**。那只代表願意接受邀請，
  不代表那天一定會有服務，也不代表已經排了人。
- **兼職接受前看不到就診人與醫院**。若客服在電話裡先講了細節，
  等於繞過了這個設計，請避免。

### Sprint C 待營運／法務確認

- 兼職婉拒的原因代碼要不要影響後續派工優先順序（目前完全不影響）
- 邀請預設回覆期限（目前 24 小時，每次可自行調整 1～168）
- 能力驗證的實際認定標準與有效期限（目前由後台人員自行填寫）
- 請假是否需要區分事假／病假／特休等假別（目前只有 5 個原因代碼，不與薪資連動）
- 全職的公司班表目前沿用既有 14 天可服務時段表，是否要改為正式輪班表

---

## Sprint E 上線步驟

### 1. 執行 migration

```
migrations/care_operations_closure_schema.sql   ← Sprint E
```

前置：Sprint B／C／D 三份都要先跑過。整份冪等。

驗證：

```sql
select count(*) from information_schema.tables
where table_schema = 'public' and table_name in (
  'care_notifications','care_notification_preferences','care_notification_outbox',
  'care_feedback_requests','care_feedback','care_concerns',
  'care_quality_reviews','care_quality_follow_ups',
  'care_policy_versions','care_policy_acceptances','care_data_lifecycle_reviews');
-- 應回傳 11

select policy_kind, status, (body_text is null) as 正文為空
from care_policy_versions order by policy_kind;
-- 應回傳 4 筆 draft，正文全部為空（系統不代寫條款）
```

### 2. 開通權限

| 角色 | 權限 |
|---|---|
| 客服／協調員 | `care_operations.view`、`care_concern.manage` |
| 督導 | `care_quality.review`、`care_quality.manage`、`care_feedback.manage` |
| 通知管理 | `care_notification.manage` |
| 營運主管 | `care_insights.view`、`care_release_readiness.view` |
| 法務／個資窗口 | `care_policy.manage`、`care_data_lifecycle.manage` |

**建議不要合併給同一人**：`care_policy.manage`（條款）與
`care_data_lifecycle.manage`（個資處理）是外部監督性質的職責，
與日常營運分開比較能發揮作用。

### 3. 日常流程

見 `RUNBOOK.md`。

### 4. 重要提醒

- **系統不會發送任何外部訊息**。家屬與陪診員要登入才看得到通知。
  急件請用既有客服管道人工聯絡，並在系統內留下紀錄。
- **上線檢核不能打勾**。`/admin/care/release-readiness` 的每一項
  都從真實狀態算出來。「人工待決」區永遠是待處理，那是提醒不是錯誤。
- **條款正文是空的**。系統只做版本管理，正文要由法務提供後貼入並發布，
  否則上線檢核會一直卡在那裡。
- **資料保留待辦不會刪除任何東西**。它只是清單。
- **回饋不公開**。不會變成網站評價，也沒有人員排行。

### Sprint E 待營運／法務／財務確認

完整清單見 `RUNBOOK.md` 第 7 節。最關鍵的三項：

1. 四份政策文件的正文（法務）
2. 外部通知通道與 opt-in 文案（法務 + 產品 + 營運）
3. 資料保留期限與個資事故上報時限（法務）
