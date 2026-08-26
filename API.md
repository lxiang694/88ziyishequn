# API

> 本文件於 Sprint B 建立，只記錄陪診營運相關端點。
> 專案沒有 `app/api/v1/` 版本化目錄；實際路徑是 `app/api/admin/*` 與 `app/api/care/*`。

## 分層

```
UI → API Route Handler → Service → Repository → PostgreSQL
```

- Route Handler：身分與權限（`requireCarePermission`）、輸入白名單驗證、錯誤轉換、稽核
- Service（`lib/care/service.ts`）：固定 use case 與狀態守衛
- Repository（`lib/care/repository.ts`）：唯一直接碰資料庫的一層
- React component 不得 import repository，也不得使用 `supabaseAdmin`
  （由 `scripts/check-care-ops.mjs` 靜態檢查）

## 錯誤格式

| 狀態 | 情境 | 回應 |
|---|---|---|
| 400 | 輸入驗證失敗（`CareInputError`） | `{ success:false, error, field? }` |
| 401 | 未登入後台 | `{ success:false, error }` |
| 403 | 沒有陪診業務權限 | `{ success:false, error }` |
| 404 | 找不到資源 | `{ success:false, error }` |
| 409 | 違反業務規則／狀態機（`CareRuleError`） | `{ success:false, error }` |
| 503 | 資料表尚未建立 | `{ success:false, error, table_missing:true }` |
| 500 | 其他 | `{ success:false, error:'操作失敗，請稍後再試' }` |

500 一律回固定訊息，不外洩堆疊或資料庫錯誤內容。

## 公開端點

### `POST /api/care/intake`

匿名可呼叫。建立一筆初評需求。

- 只接受 `parsePublicIntake()` 的白名單欄位；`status` / `source` /
  `submitter_ip_hash` 由伺服器決定，client 夾帶會被丟棄
- 以 IP 雜湊做每小時 5 次上限；**只存雜湊，不存原始 IP**
- 成功回應固定為 `{ "success": true }` —— **不回傳任何 internal id**
- **沒有 GET**：公開端不得查詢任何初評

Request body：

```json
{
  "service_scenario": "visit_with_tests",
  "mobility_support_level": "wheelchair",
  "transport_support_requested": true,
  "hospital_name": "台大醫院",
  "county": "台北市",
  "scheduled_service_date": "2026-09-10",
  "time_preference": "unspecified",
  "contact_name": "王小明",
  "contact_phone": "0912345678",
  "contact_line_id": "ming123",
  "contact_preference": "line",
  "relationship_to_beneficiary": "子女",
  "limited_support_note": "長輩重聽，需大聲說話"
}
```

`limited_support_note` 上限 200 字，且**不是病史欄位**；伺服器與資料庫都限長。

### `GET /api/care/services`

既有端點，唯讀回傳啟用中的方案。前台「方案與費用」頁改走 Service
（`getPublicCareServices()`），不直接查資料庫。

## 後台端點

全部要求登入 + 陪診業務權限。讀取類接受任一 care 權限；
寫入類要求對應的 `manage` 權限。

**沒有泛用 PATCH／PUT。** 所有變更都是 `POST` + 白名單 `action`，以 `switch` 分派。

| 端點 | 方法 | 權限 | 說明 |
|---|---|---|---|
| `/api/admin/care/overview` | GET | 任一 care | 各狀態計數 |
| `/api/admin/care/intakes` | GET | 任一 care | 初評清單（**不含**電話與補充需求） |
| `/api/admin/care/intakes/[id]` | GET | 任一 care | 初評詳情（含補充需求） |
| `/api/admin/care/intakes/[id]` | POST | `care_intake.manage` | `start_review` / `request_more_information` / `decline` / `convert_to_case` |
| `/api/admin/care/cases` | GET | 任一 care | 案件清單 |
| `/api/admin/care/cases/[id]` | GET | 任一 care | 案件 + 初評 + 報價列表 |
| `/api/admin/care/cases/[id]` | POST | `care_case.manage` | `cancel` / `mark_payment_received` |
| `/api/admin/care/quotes` | GET | 任一 care | 報價清單 |
| `/api/admin/care/quotes` | POST | `care_quote.manage` | 建立草稿 |
| `/api/admin/care/quotes/[id]` | GET | 任一 care | 報價 + 明細 |
| `/api/admin/care/quotes/[id]` | POST | `care_quote.manage` | `update_draft` / `send` / `confirm` / `expire` / `cancel` |

### 金額由伺服器決定

建立／修改報價時，client **不能**傳入：

`total_estimate`、`base_fee`、`service_name_snapshot`、`status`、
`created_by_admin_id`、`confirmed_by_admin_id`

- `base_fee` 與 `service_name_snapshot` 由伺服器從 `care_services` 取當下值快照
- `total_estimate` 由 `computeQuoteTotal()` 重算
- actor 一律取自 `admin_token`，不取自 request body

client 可控的只有 `QuoteDraftInput`：`service_code`、`travel_estimate_amount`、
`travel_estimate_basis`、`overtime_rule_snapshot`、`valid_until`、`items[]`。

### `mark_payment_received` 不是金流

本輪**沒有串接任何付款、匯款核銷或對帳**。這個 action 只代表
「具 `care_case.manage` 權限的人在後台人工確認收到款項」，並記錄操作者。
UI 上有明確警語。

## 稽核

寫入類操作會呼叫 `auditCare()`，寫入既有的 `admin_audit_logs`。

`detail` 走 `buildAuditDetail()` 的白名單，**只允許**：
`resource`、`resource_id`、`from_status`、`to_status`、`reason_code`、`quote_version`。

白名單欄位仍限長 60 字。任何電話、姓名、備註自由文字、完整表單、
金額明細與 token 都不會進入稽核紀錄。

## 陪診履約端點（Sprint D）

三個 realm 各有各的守門：`requireFulfilmentPermission`（後台）、
`requireStaff`（陪診員 cookie）、`requireFamilyUser`（Supabase Auth Bearer）。
一樣沒有泛用 PATCH／PUT，全部是 `POST` + 白名單 `action`。

### 陪診員端

| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/companion/service/[bookingId]` | GET | 自己的服務履約工作區 |
| `/api/companion/service/[bookingId]` | POST | `append_event` / `invalidate_event` / `save_record_draft` / `submit_record` / `create_incident` |
| `/api/companion/settlement` | GET | **自己的已發布**結算明細 |

歸屬檢查在 Service 層（`loadOwnBooking`），不靠前端隱藏按鈕。
`append_event` 的輸入**不含** `occurred_at` / `visibility` / `companion_id` / `booking_id` ——
時間由資料庫寫、可見性由督導決定、身分取自 cookie。

### 家屬端

| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/family/service/[bookingId]` | GET | 已授權才回內容 |

**沒有 POST。** 沒有有效授權一律回 **404**（不是 403）——避免用 id 探測服務是否存在。
回應只含已發布小結、已開放事件與最小的預約欄位；不含 `companion_id`、金額或內部紀錄。

### 後台

| 端點 | 方法 | 權限 |
|---|---|---|
| `/api/admin/care/service-control` | GET | 督導類讀取權限（不含結算） |
| `/api/admin/care/services/[id]` | GET | 督導類讀取權限（不含結算） |
| `/api/admin/care/services/[id]` | POST | `care_summary.review`：`set_event_visibility` / `grant_authorization` / `revoke_authorization` |
| `/api/admin/care/records` | GET | 督導類讀取權限（不含結算） |
| `/api/admin/care/records/[id]` | GET / POST | POST 需 `care_record.review`：`review` / `return_for_revision` |
| `/api/admin/care/summaries` | GET / POST | POST 需 `care_summary.review`：建立草稿 |
| `/api/admin/care/summaries/[id]` | GET / POST | POST 需 `care_summary.review`：`update_draft` / `submit_for_review` / `publish` / `withdraw` |
| `/api/admin/care/incidents` | GET | 督導類讀取權限（不含結算） |
| `/api/admin/care/incidents/[id]` | POST | `care_incident.manage`：`acknowledge` / `resolve` / `close` / `prepare_notification` |
| `/api/admin/care/settlements` | GET / POST | **`care_settlement.manage`**：`generate_line` / `create_manual_line` / `review_line` / `create_batch` / `approve_batch` / `publish_batch` / `close_batch` |

### 督導類讀取權限 = 不含結算

`care_record.review`／`care_summary.review`／`care_incident.manage`／`care_operations.view`
其中任一即可，但 `care_settlement.manage` **不算**。財務帳號呼叫上面標示
「督導類讀取權限」的端點會拿到 403，讀不到內部服務紀錄與未發布小結。

### 通知：沒有 mark_sent

`/api/admin/care/incidents/[id]` **刻意沒有** `mark_sent` action。
系統沒有串接任何 LINE／SMS／Email connector，最多只能推進到 `prepared`，
由人工實際聯繫。domain、Service 與資料庫 trigger 三處都擋下 `sent_or_confirmed`。

### 冪等

- `generate_line`：已存在就回既有那筆（`created: false`），不重複建立也不報錯；
  資料庫的 `unique (booking_id, line_type)` 是最終保證
- `prepare_notification`：已是 `prepared` 就直接回，重複點擊不會變成錯誤

### 稽核

沿用 Sprint B 的 `buildAuditDetail()` 白名單（`resource` / `resource_id` /
`from_status` / `to_status` / `reason_code` / `quote_version`），每個值限長 60 字。
服務紀錄全文、家屬備註、電話、地址、`user_id`、金額 payload 都不會進稽核。

---

## 陪診人力與媒合端點（Sprint C）

同樣沒有通用 PATCH。所有寫入都是 `POST { action, ... }`，
`action` 走 `switch` 白名單，未知 action 一律 400。

### 後台

| 端點 | Method | action | 需要權限 |
|---|---|---|---|
| `/api/admin/care/staff` | GET | — | 任一人力權限 |
| `/api/admin/care/staff/[id]` | GET | — | 任一人力權限 |
| `/api/admin/care/staff/[id]` | POST | `create_employment_term` / `end_employment_term` / `pause_employment_term` / `resume_employment_term` | `care_staff.manage` |
| | | `add_region` / `remove_region` | `care_staff.manage` |
| | | `verify_capability` / `expire_capability` / `suspend_capability` | `care_staff_credential.manage` |
| `/api/admin/care/schedule` | GET | — | 任一人力權限 |
| `/api/admin/care/time-off` | GET | — | 任一人力權限 |
| `/api/admin/care/time-off` | POST | `review` | `care_staff_time_off.review` |
| `/api/admin/care/dispatch` | GET | — | 任一人力權限 |
| `/api/admin/care/dispatch` | POST | `materialize_case` / `assign_full_time` / `create_proposal` | `care_dispatch.manage` |
| `/api/admin/care/dispatch/proposals` | GET | — | 任一人力權限 |
| `/api/admin/care/dispatch/proposals/[id]` | POST | `cancel` / `expire` | `care_dispatch.manage` |

### 陪診員端

身分一律取自 `companion_token` cookie，**不接受**請求內容裡的 `companion_id`。

| 端點 | Method | action |
|---|---|---|
| `/api/companion/availability-rules` | GET / POST | `create` / `update` / `disable` |
| `/api/companion/time-off` | GET / POST | `submit` / `cancel` |
| `/api/companion/proposals` | GET | —（回傳去敏感化摘要） |
| `/api/companion/proposals/[id]` | POST | `accept` / `decline` |

### 邀請 ≠ 指派

`create_proposal` **不會**寫入 `care_bookings.companion_id`，只建立一筆
`status = 'proposed'` 的邀請。只有陪診員按下 accept、且資料庫函式
`care_accept_dispatch_proposal()` 回傳 `ok = true` 時，才會產生正式指派。

### `GET /api/companion/proposals` 的回傳欄位

這是白名單，來自 `toProposalSummary()`：

```json
{
  "proposal_id": 12,
  "service_date": "2026-09-03",
  "time_slot": "morning",
  "county": "台北市",
  "service_name": "一般門診陪診",
  "mobility": "wheelchair",
  "required_capabilities": ["general_outpatient_flow", "wheelchair_route_support"],
  "expires_at": "2026-08-27T02:00:00.000Z"
}
```

**沒有**就診人姓名、聯絡人、電話、醫院名稱、科別、樓層、到府地址、
特殊需求備註、報價或報酬。這些要接受之後，從 `/api/companion/assignments`
的正式工單才拿得到。

### accept 的失敗代碼

資料庫函式回傳穩定代碼，Service 層翻成中文訊息：

| reason | 使用者看到 |
|---|---|
| `proposal_not_found` | 找不到這筆邀請 |
| `not_your_proposal` | 這不是給您的邀請 |
| `proposal_not_open` | 這筆邀請已經回覆過了 |
| `proposal_expired` | 這筆邀請已經逾時 |
| `employment_inactive` | 您目前沒有有效的接案資格，請聯絡客服 |
| `already_assigned` | 這筆服務剛剛已經由其他陪診員接下了 |

`already_assigned` 是正常結果，不是錯誤——兩人同搶時本來就會有一個看到它。

### 媒合檢查回傳**所有**不符原因

`GET /api/admin/care/dispatch` 的候選人清單，每個人附上 `failures: string[]`，
不是只回第一個。派工人員一次看到全部問題，不用修一個才發現下一個。

### 稽核

所有寫入動作寫入 `admin_audit_logs`，記錄操作者、對象 id、狀態轉換與原因代碼，
**不記錄**申請理由自由文字或邀請內容。

---

## 陪診營運閉環端點（Sprint E）

一樣沒有通用 PATCH／PUT／DELETE。所有寫入都是 `POST { action, ... }`，走白名單。

### 後台

| 端點 | 方法 | action | 需要權限 |
|---|---|---|---|
| `/api/admin/care/operations` | GET | — | 營運類讀取（不含結算／個資） |
| `/api/admin/care/notifications` | GET / POST | `suppress_outbox` | `care_notification.manage` |
| `/api/admin/care/feedback` | GET / POST | `create_request` / `start_review` / `close` | `care_feedback.manage` |
| `/api/admin/care/concerns` | GET / POST | `create` | GET：營運類讀取；POST：`care_concern.manage` |
| `/api/admin/care/concerns/[id]` | POST | `acknowledge` / `assign` / `resolve` / `close` | `care_concern.manage` |
| `/api/admin/care/quality` | GET / POST | `create_review` | GET：營運類讀取；POST：`care_quality.review` |
| `/api/admin/care/quality/[id]` | POST | `start` / `complete` / `complete_follow_up` | `care_quality.review` |
| | | `create_follow_up` / `verify_follow_up` | `care_quality.manage` |
| `/api/admin/care/insights` | GET | — | `care_insights.view` |
| `/api/admin/care/release-readiness` | GET | —（**沒有 POST**） | `care_release_readiness.view` |
| `/api/admin/care/policies` | GET / POST | `create_draft` | `care_policy.manage` |
| `/api/admin/care/policies/[id]` | POST | `publish` | `care_policy.manage` |
| `/api/admin/care/lifecycle` | GET / POST | `create` | `care_data_lifecycle.manage` |
| `/api/admin/care/lifecycle/[id]` | POST | `mark_reviewed` | `care_data_lifecycle.manage` |

### 家屬端（Supabase Auth，且每次都再驗單筆授權）

| 端點 | 方法 | action |
|---|---|---|
| `/api/care/notifications` | GET / POST | `update_preference` |
| `/api/care/notifications/[id]` | POST | `mark_read` / `archive` |
| `/api/care/feedback` | GET | — |
| `/api/care/feedback/[id]` | POST | `submit` |
| `/api/care/concerns` | GET / POST | `create` |

### 陪診員端（`companion_token`）

| 端點 | 方法 | action |
|---|---|---|
| `/api/companion/notifications` | GET / POST | `update_preference` |
| `/api/companion/notifications/[id]` | POST | `mark_read` / `archive` |
| `/api/companion/follow-ups` | GET | —（去識別化摘要） |
| `/api/companion/follow-ups/[id]` | POST | `complete` |

### 通知內容不由呼叫端決定

建立通知的輸入**只有** `notification_type` 與 `link_path`。
標題與內文由 `NOTIFICATION_TEMPLATES` 的固定模板產生；
收件人由資源關係推出；時間由資料庫寫入。

送 `title`、`body`、`recipient_user_id`、`status`、`created_at` 都會被丟棄，
不是報錯，是根本沒有進入解析結果。

`link_path` 必須是站內相對路徑，且**不可帶 query string 或 fragment**——
那些會進到伺服器 log 與 analytics。

### 沒有「送出通知」這個動作

`/api/admin/care/notifications` 的 POST 只有 `suppress_outbox` 一個 action。
沒有 provider，就沒有「送出」可以按。所有外部 outbox 一律停在 `not_configured`。

### 上線檢核只有 GET

`/api/admin/care/release-readiness` **沒有 POST**。每一項都從真實設定與資料算出來，
沒有任何手動標記為完成的路徑。

### 稽核

所有寫入寫入 `admin_audit_logs`，detail 走 `buildAuditDetail` 白名單
（`resource` / `resource_id` / `from_status` / `to_status` / `reason_code`）。
通知內文、家屬意見全文、品質備註、政策正文、電話、地址一律不會被寫進去。
