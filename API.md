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
| `/api/admin/care/service-control` | GET | 任一履約權限 |
| `/api/admin/care/services/[id]` | GET | 任一履約權限 |
| `/api/admin/care/services/[id]` | POST | `care_summary.review`：`set_event_visibility` / `grant_authorization` / `revoke_authorization` |
| `/api/admin/care/records` | GET | 任一履約權限 |
| `/api/admin/care/records/[id]` | GET / POST | POST 需 `care_record.review`：`review` / `return_for_revision` |
| `/api/admin/care/summaries` | GET / POST | POST 需 `care_summary.review`：建立草稿 |
| `/api/admin/care/summaries/[id]` | GET / POST | POST 需 `care_summary.review`：`update_draft` / `submit_for_review` / `publish` / `withdraw` |
| `/api/admin/care/incidents` | GET | 任一履約權限 |
| `/api/admin/care/incidents/[id]` | POST | `care_incident.manage`：`acknowledge` / `resolve` / `close` / `prepare_notification` |
| `/api/admin/care/settlements` | GET / POST | **`care_settlement.manage`**：`generate_line` / `create_manual_line` / `review_line` / `create_batch` / `approve_batch` / `publish_batch` / `close_batch` |

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
