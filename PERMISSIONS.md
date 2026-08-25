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
