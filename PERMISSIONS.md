# PERMISSIONS

> 本文件於 Sprint B 建立，記錄**目前程式碼實際的**權限模型。

## 現況：實際的權限模型

專案沒有 `Role → Portal Permission → Business Permission → Data Scope → Consent`
的分層模型。實際存在的是**單層的權限字串清單**：

- 後台管理員身分：自訂 JWT cookie `admin_token`（不是 Supabase Auth）
- 角色定義在 `admin_roles`，權限存在 `permissions_json`（字串陣列）
- `'all'` 代表超級管理員，涵蓋所有權限
- 可指派的權限清單定義在 `lib/permissions.ts` 的 `PERMISSION_CATALOG`
- 檢查函式：`lib/adminMiddleware.ts` 的 `requireAdmin` / `requireSuperAdmin` /
  `requirePermission`

另有兩套獨立的身分系統，與後台完全分離：

| realm | 認證方式 | 用途 |
|---|---|---|
| admin | JWT cookie `admin_token` | 後台 |
| member | Supabase Auth Bearer | 商城會員 |
| companion | JWT cookie `companion_token` | 陪診員端 |

## Sprint B 新增的業務權限

定義於 `lib/care/domain.ts` 的 `CARE_PERMISSION_KEYS`，並登錄到
`lib/permissions.ts` 的 `PERMISSION_CATALOG`（後台「帳號管理」可勾選）。

| 權限 | 語意 | 可看到什麼 |
|---|---|---|
| `care_operations.view` | 檢視總覽與清單 | 統計數字、清單（**不含**補充需求自由文字） |
| `care_intake.manage` | 初評審查 | 初評詳情，含補充需求與聯絡方式 |
| `care_quote.manage` | 報價草稿、發送、確認、作廢 | 報價與金額 |
| `care_case.manage` | 案件狀態與人工收款確認 | 案件詳情 |

判斷邏輯的唯一來源是純函式 `hasCarePermission(granted, required)`：

- `granted` 含 `'all'` → 通過
- `granted` 含 `required` 之一 → 通過
- 其他一律拒絕，包含 `granted` 為空／null／undefined，以及 `required` 為空陣列

**能進入 `/admin` 不等於能看陪診個案。** 角色名稱、cookie、URL query、
前端 state 與 user metadata 都不是權限來源。

## 目前實際的 role mapping

| 角色 | 陪診權限 | 說明 |
|---|---|---|
| `super_admin`（`'all'`） | 全部四項 | 由 `'all'` 涵蓋，**未**額外寫入資料 |
| 其他所有既有角色 | **無** | migration 不自動賦予任何角色 |

Sprint B 的 migration **刻意不寫入任何 role mapping**。要開通給特定角色，
必須由超級管理員在後台「帳號管理」逐一勾選，或執行 `OPERATIONS.md` 中列出的
seed 語句（可撤回）。

依規格的設計決定：

1. 不自動把 `operations` / `customer_service` / `finance` / `service_supervisor`
   賦予任何陪診權限。
2. 財務角色不會因為是財務就取得 `care_intake.manage`；讀取完整初評備註
   需要明確授予該權限。
3. 陪診員（companion realm）與家屬本輪**不取得**任何 Care Admin 讀寫權。
4. 匿名、僅有零售權限的管理員、其他 realm 的使用者一律預設拒絕。

單元測試 `tests/care/authorization.test.ts` 涵蓋以上每一條。

## 與既有 `care.view` 的關係

既有的 `care.view` 是「陪診預約」頁（`/admin/care/bookings`）的權限，
責任與 Sprint B 的四個權限**不同**，兩者不可互相沿用。
`hasCarePermission(['care.view'], ALL_CARE_PERMISSIONS)` 會回傳 `false`，
並有測試鎖住這個行為。

## 資料範圍（Data Scope）

本輪**尚未**實作 per-case 的資料範圍限制：具備 care 權限的管理員可以看到
所有陪診個案。這是已知限制，記錄於 `SECURITY.md`，留待後續 Sprint。

本輪保證的是：匿名、無 care 權限的管理員、僅有零售權限的使用者、
陪診員與家屬，預設一律拒絕。

## Sprint D 新增的履約權限

定義於 `lib/care/fulfilment/domain.ts` 的 `FULFILMENT_PERMISSION_KEYS`。

| 權限 | 可做什麼 | 可看到什麼 |
|---|---|---|
| `care_record.review` | 核可／退回內部服務紀錄 | 陪診員的客觀紀錄全文 |
| `care_summary.review` | 建立、修改、送審、發布、撤回家屬小結；調整事件家屬可見性；開通／撤回家屬授權 | 小結內容 |
| `care_incident.manage` | 受理、處理、結案異常；推進通知狀態 | 異常內容 |
| `care_settlement.manage` | 結算明細與批次的全部操作 | **唯一**能看到報酬金額的權限 |

讀取類清單（服務控制台、紀錄、小結、異常）接受任一履約權限或 `care_operations.view`；
**結算端點只接受 `care_settlement.manage`**，不接受任一 care 權限。

### 三個 realm 的資料範圍

| 角色 | 可讀 | 不可讀 |
|---|---|---|
| 陪診員（companion realm） | 只有指派給自己的服務：自己的事件、自己的紀錄草稿、自己建立的異常、自己**已發布**的結算明細、小結的**狀態**（不含內容） | 他人的任何資料、家屬支付金額、未審核金額、批次、小結內容 |
| 督導（`care_record.review` / `care_summary.review`） | 內部紀錄、小結、事件、異常、授權 | 結算金額 |
| 財務（`care_settlement.manage`） | 結算明細與批次 | 內部紀錄全文、未授權的小結 |
| 家屬（Supabase Auth 會員） | 單筆服務**已發布**的小結與**已開放**的事件 | 內部紀錄、未發布小結、異常詳情、陪診員身分、金額、其他訂單 |
| 未登入／無授權 | 無 | 全部（後端回 404，不透露服務是否存在） |

### 家屬授權 ≠ 身分

`care_bookings.user_id`（下單會員）**不會**自動取得閱覽權。
必須在 `/admin/care/services/[id]` 對特定會員逐一開通 `care_service_authorizations`。
付款人、預約人、聯絡人同理。有測試鎖住這個行為。

### role mapping

Migration 不自動賦予任何角色。`super_admin`（`'all'`）涵蓋全部。
其他角色需由超級管理員在「帳號管理」逐一勾選。

**建議的職責分離**：`care_quote.manage`（開價）、`care_case.manage`（確認收款）、
`care_settlement.manage`（發放報酬）三者不要給同一個人。
