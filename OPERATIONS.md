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
