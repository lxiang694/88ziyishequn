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

### 財務與督導的隔離是雙向的

督導類讀取（服務控制台、單筆詳情、內部紀錄、家屬小結、異常）接受
`care_record.review`／`care_summary.review`／`care_incident.manage`／`care_operations.view`
其中任一，**刻意排除 `care_settlement.manage`** —— 財務該看到的是金額，
不該因為同樣在 Admin portal 就讀得到陪診員的內部客觀紀錄或未發布的家屬小結。

反過來也一樣：**結算端點只接受 `care_settlement.manage`**，
督導與一般營運讀不到任何金額。

程式碼裡的單一來源是 `lib/care/fulfilment/domain.ts` 的
`SUPERVISORY_READ_PERMISSIONS`（督導側）與 `FINANCE_ONLY_PERMISSION`（財務側）。
`ALL_FULFILMENT_PERMISSIONS` 是完整目錄，**不可**當成讀取守門用。

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

---

## Sprint C 新增的人力與媒合權限

定義於 `lib/care/staffing/domain.ts` 的 `STAFFING_PERMISSION_KEYS`。

| 權限 | 可做什麼 | 可看到什麼 |
|---|---|---|
| `care_staff.manage` | 建立／暫停／恢復／結束僱用條件，增刪服務區域 | 陪診員名冊、僱用狀態、服務區域 |
| `care_schedule.manage` | 檢視全體班表與可服務時段，代為停用不合理的時段規則 | 誰在哪天有空、當天已排了什麼 |
| `care_dispatch.manage` | 把案件開成正式工單、指派全職、對兼職發出邀請、取消或逾期邀請 | 候選人清單與每個人不符合的原因 |
| `care_staff_credential.manage` | 驗證／到期／停權能力項目 | 能力驗證紀錄與有效期限 |
| `care_staff_time_off.review` | 核准或駁回請假／暫停接案 | 請假申請與衝突的服務 |

讀取類清單（名冊、班表、請假、派工、邀請）接受**任一**上述權限；
寫入動作各自要求對應的那一個。

### 陪診員本人的兩項能力

不是後台權限，而是 companion realm 的固定能力，登入即有，
無法透過後台角色調整：

| 能力 | 對應端點 |
|---|---|
| `care_staff_availability.manage_own` | `/api/companion/availability-rules` |
| `care_dispatch.proposal.respond_own` | `/api/companion/proposals/[id]`（accept／decline） |

### 陪診員**不能**做的事（刻意）

- 變更自己的僱用型態（全職／兼職）
- 自行驗證或延長自己的能力項目
- 讀取或修改其他陪診員的任何資料
- 在**接受邀請前**看到就診人姓名、聯絡電話、醫院名稱、地址、備註或金額
- 直接把自己指派到某筆服務（只能回覆後台發出的邀請）

前三項在 API 層根本沒有本人可呼叫的寫入路徑；
第四項由 `toProposalSummary()` 白名單保證；
第五項由「建立邀請不寫 `companion_id`」保證。

### role mapping

Migration 不自動賦予任何角色。建議的職責分離：
`care_staff_credential.manage`（驗證能力）與 `care_dispatch.manage`（派工）
不要給同一個人——否則派工者可以自己補一張能力驗證來繞過媒合檢查。

---

## Sprint E 新增的營運閉環權限

定義於 `lib/care/operations/domain.ts` 的 `CLOSURE_PERMISSION_KEYS`。

| 權限 | 可做什麼 | 可看到什麼 |
|---|---|---|
| `care_notification.manage` | 檢視站內通知 metadata、抑制 outbox | 通知的類型與狀態，**不含內文** |
| `care_feedback.manage` | 建立回饋邀請、處理與結案回饋 | 家屬回饋的分數與意見 |
| `care_concern.manage` | 受理、指派、處理、結案意見案件 | 案件全文與內部備註 |
| `care_quality.review` | 建立、開始、完成品質覆核 | 覆核 checklist 與內部備註 |
| `care_quality.manage` | 建立、覆核改善事項 | 改善事項與負責人 |
| `care_insights.view` | 檢視去識別化營運指標 | 統計數字；樣本不足時看不到分數 |
| `care_release_readiness.view` | 檢視上線檢核 | 檢核結果；**沒有寫入路徑** |
| `care_policy.manage` | 建立與發布條款／隱私版本 | 政策正文 |
| `care_data_lifecycle.manage` | 資料保留待辦 | 待辦清單；**不能刪除任何資料** |

### 家屬與陪診員本人的能力

登入即有，無法由後台角色調整：

| 能力 | 對應端點 |
|---|---|
| `care_notification.read_own` | `/api/care/notifications`、`/api/companion/notifications` |
| `care_feedback.submit_own_authorized_order` | `/api/care/feedback/[id]`（submit） |

### 營運類讀取排除財務與個資權限

`OPERATIONS_READ_PERMISSIONS` 明確列出六個權限
（`care_operations.view` 與通知、品質×2、回饋、意見），
**刻意排除** `care_settlement.manage` 與 `care_data_lifecycle.manage`。

理由與 Sprint D 修過的那個洞相同：財務該看到的是金額，不是家屬意見與品質備註；
個資處理人員該看到的是保留期限，不是服務內容。`ALL_CLOSURE_PERMISSIONS`
是完整目錄，**不可**當讀取守門用。

### 各角色的實際範圍

| 角色 | 可讀 | 不可讀 |
|---|---|---|
| 客服／協調員（`care_operations.view` + concern） | 營運佇列、意見案件 | 結算金額、品質內部備註、政策正文、資料保留待辦 |
| 督導（quality×2 + feedback） | 品質覆核、家屬回饋、改善事項 | 結算金額、資料保留待辦 |
| 財務（`care_settlement.manage`） | 結算明細與批次 | 內部服務紀錄、未發布小結、家屬回饋、意見案件、品質備註 |
| 個資窗口（`care_data_lifecycle.manage`） | 保留待辦清單 | 服務內容、回饋、品質、結算 |
| 陪診員 | 自己的通知、自己的改善事項摘要 | 家屬回饋原文、他人品質資料、Admin 指標、outbox、完整意見案件 |
| 家屬 | 有效授權下的通知、已發布小結、自己的回饋與案件狀態 | 內部紀錄、內部異常、未發布小結、品質覆核、其他訂單 |

### 三件事互相獨立

接受政策、單筆服務授權、外部通知 opt-in 是三個不同的概念，
存在三張不同的表，**任一件都不會自動產生另一件**。
`policyAcceptanceImpliesNothing()` 與對應的測試存在的目的，
就是讓有人想用其中一個推導另一個時，CI 會失敗。
