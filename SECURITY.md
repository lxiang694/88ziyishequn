# SECURITY

> 本文件於 Sprint B 建立。這裡記錄**實際的**安全狀態，包含已知限制。

## 三個獨立的身分 realm

| realm | 認證 | 說明 |
|---|---|---|
| admin | 自訂 JWT cookie `admin_token` | 後台，**非** Supabase Auth |
| member | Supabase Auth Bearer | 商城會員 |
| companion | 自訂 JWT cookie `companion_token` | 陪診員端 |

三者互不相通。

## 已知限制（重要）

### 1. 後台一律使用 service_role，RLS 不是後台的強制點

後台管理員不是 Supabase Auth 使用者，因此**不存在 request-scoped
authenticated Supabase client**；所有後台查詢都走 service_role，
而 service_role 會繞過 RLS。

這代表：

- 陪診四張表的 RLS 是**縱深防禦**，擋的是 anon key（前台會用到）
  與 authenticated 身分，讓他們一筆都讀不到
- 後台路徑的授權**實際強制點**是：
  1. `requireCarePermission()`（Route Handler）
  2. Service 層的狀態守衛
  3. 資料庫 trigger（狀態機與報價凍結）

要讓 RLS 成為後台的強制點，必須把管理員身分遷移到 Supabase Auth，
那是跨系統的重構，不在 Sprint B 範圍。

### 2. 尚未實作 per-case 資料範圍

具備 care 權限的管理員可以看到所有陪診個案。
本輪保證的是「沒有 care 權限者一律拒絕」，尚未做到「只能看自己負責的個案」。

## 陪診營運的安全設計

### 公開初評端點

- 只有 `POST`，**沒有 GET** —— 匿名無法查詢任何初評
- 白名單驗證：`status`、`source`、`submitter_ip_hash` 由伺服器決定
- 成功回應固定 `{ success: true }`，**不含 internal id**，無法列舉
- 每小時 5 次上限，以 IP 的 SHA-256 雜湊（加 server salt）計數
- **不存原始 IP**

salt 取自 `CARE_INTAKE_IP_SALT`，未設定時退回 `JWT_SECRET`。
建議在正式環境明確設定 `CARE_INTAKE_IP_SALT`。

### 預約查詢刻意不做

`/care/account` 不提供「輸入編號即可查詢」的表單。那等同可被列舉的公開查詢，
猜到編號就能看到他人的就醫資訊。正式查詢必須綁定身分驗證。

### 稽核不記錄敏感內容

`buildAuditDetail()` 白名單只允許 `resource`、`resource_id`、`from_status`、
`to_status`、`reason_code`、`quote_version`，且每個值限長 60 字。

明確**不會**寫入稽核：完整病史、自由文字備註、電話、姓名、完整表單、
價格明細 payload、支付或身分 token。

`scripts/check-care-ops.mjs` 會靜態檢查白名單內容與呼叫端是否夾帶敏感欄位。

### 前端不得夾帶關鍵欄位

報價的總價、基本費、方案名稱快照、status、actor 一律由伺服器決定。
`parseQuoteDraft()` 只取白名單欄位，靜態檢查也會驗證 `QuoteDraftInput`
不含這些欄位。

### 不是醫療紀錄

`care_intakes` 不蒐集完整病史、診斷結論、處方內容、藥物劑量、治療建議、
身分證／健保卡號、病歷影像、健保資料或支付 token。

`limited_support_note` 上限 200 字，用途限於當天流程協助的補充說明，
前端提示與資料庫 check constraint 都有限制。

## 既有的敏感資料處理

陪診員的證件與服務照片存放於**私有** bucket（`companion-docs`、`care-records`），
一律以 5 分鐘簽名網址讀取，不產生公開連結。身分證字號與金融帳號僅超級管理員可見。
（此為 Sprint B 之前既有的機制，本輪未修改。）

## Sprint D 履約的安全設計

### 醫療內容守門

所有自由文字（事件說明、服務紀錄、小結、異常描述）都經過
`assertNoMedicalContent()`：命中診斷、處方、劑量、判讀、停藥／換藥等詞就擋下並提示。

這**不是萬無一失的過濾器，也不假裝是**。它擋的是最常見的誤填，讓填寫者當場看到提示；
真正的防線是 UI 說明、欄位設計（刻意不叫 `note` 或 `diagnosis`）與督導審核。

### 資料分層：內部紀錄 ≠ 家屬小結

原始服務紀錄（`care_service_records`）**永遠不會**自動變成家屬看得到的內容。
家屬只讀得到 `care_family_summaries` 中狀態為 `published` 的那一份，
且必須另有單筆授權。這是兩個獨立資源，中間隔著督導的人工審核。

### 家屬授權：預設全部拒絕

- 必須是已登入的 Supabase Auth 會員
- 必須有一列對應 `(booking_id, user_id, scope)` 且 `revoked_at is null` 的授權
- **下單會員、付款人、預約人、聯絡人都不會自動取得授權**
- 無授權回 404，不透露服務是否存在
- `view_service_photo` 本輪停用：domain 與資料庫 trigger 都擋

### 事件 append-only

`care_service_events` 的資料庫 trigger 擋下 DELETE 與內容改寫，只允許標記作廢。
更正會留下 `invalidated_at` / `invalidate_reason_code`，原始內容仍在，稽核軌跡不會被抹除。

### 通知：不假裝已送出

沒有任何外部通知 provider。`NOTIFICATION_PROVIDER_CONFIGURED = false`，
Service 與資料庫 trigger 都會拒絕 `sent_or_confirmed`。
未來接上 connector 時，必須由該 connector 的受控函式寫入，並帶最小內容與可撤銷授權。

### 金額隔離

只有 `care_settlement.manage` 讀得到金額。督導、客服、HR 即使都在 Admin portal 也讀不到。
陪診員只讀得到**自己的**、**已發布**的明細——未審核金額、他人金額、家屬支付金額、
批次資料、銀行與稅務資料一律不在任何回應中。

### 本輪未實作（不是已完成）

- 檔案上傳：本輪完全沒做。若日後要做，必須私有 Storage + 短效 signed URL + 明確同意
- 外部通知：沒有 connector，只有 in-app 狀態
- 實際付款、銀行資料、薪資、勞健保、稅務、發票、退款：全部在系統外
- per-case 資料範圍：具履約權限的管理員可看到所有個案

---

## Sprint C 人力與媒合的安全設計

### 兼職接受前的資料最小化

這是本輪最主要的隱私控制。`toProposalSummary()`（`lib/care/staffing/domain.ts`）
是**唯一**的白名單來源，回傳固定七個欄位：

```
proposal_id, service_date, time_slot, county,
service_name, mobility, required_capabilities, expires_at
```

接受前**不會**回傳：就診人姓名、年齡、性別、聯絡人、電話、LINE、
醫院名稱、科別、樓層、到府地址、特殊需求備註、報價、報酬。

地點只給到縣市（`county`），不給醫院——因為在小地方，「某天早上某醫院」
加上就診人年齡就足以指認一個人。

`scripts/check-care-ops.mjs` 第 14 節會掃這個函式，
夾帶敏感欄位就讓 CI 失敗。

### 併發保護在資料庫，不在前端

兩個兼職同時接受同一筆服務時，**只有一個會成功**。
保護點是 `care_accept_dispatch_proposal()` 這個 plpgsql 函式：
在同一個交易裡對邀請列與 `care_bookings` 該列都做 `select ... for update`，
再加上 `uniq_cdp_accepted_per_booking` 唯一索引兜底。

前端把按鈕變灰**不是**保護，只是體驗。輸家會收到
「這筆服務剛剛已經由其他陪診員接下了」，這是正常結果不是錯誤。

### 陪診員身分只來自 token

`requireOwnStaff()` 從 `companion_token` cookie 解出身分。
四個陪診員端點**完全不讀**請求內容裡的 `companion_id`——
就算送上來也會被忽略。Service 層再比對一次資源歸屬
（例如 `p.companion_id !== actor.id` 直接拒絕）。

### 勞務關係欄位不開放本人寫入

僱用型態與能力驗證在 API 層沒有本人可呼叫的寫入路徑。
`parseEmploymentTerm()` 刻意不含 `status` 與任何身分欄位——
那些由 Service 決定，不由 client 送。

這不只是「前端沒做那個按鈕」，是端點根本不存在。

### 稽核不記錄自由文字

請假理由、婉拒補充說明、能力驗證備註**不寫進稽核**。
稽核只記錄操作者、對象 id、狀態轉換與原因**代碼**。
理由自由文字可能含健康狀況或家庭狀況。

### 這不是醫療資格認證

`staff_capabilities` 的四個代碼是內部作業能力記錄，
不是醫療專業資格。系統不判斷任何人是否具備醫療專業，
也不因為某人「有輪椅動線協助能力」就宣稱其能提供醫療照護。

### 本輪未實作（不是已完成）

- **未做細緻的 per-case 資料範圍**：有 `care_dispatch.manage` 的人看得到
  全部候選人與全部待派工服務，沒有依區域或團隊切分
- **未做邀請的推播或簡訊通知**：兼職要自己進 `/companion` 才會看到邀請。
  沒有正式通知管道就不假裝有，這與 Sprint D 的通知立場一致
- **未做請假與薪資、特休額度的連動**：`staff_time_off_requests`
  純粹是排班可用性，不是人事假單
- **後台仍一律使用 service_role**：與既有 realm 相同，RLS 是縱深防禦，
  授權的實際強制點在 Route Handler 與 Service 層
