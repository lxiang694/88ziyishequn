# RUNBOOK

日常營運的操作手冊。**這份文件不創造任何法定時效、保險條件、
院方合作關係或外部通知能力** —— 標示為「待定」的項目，是真的還沒決定，
不是忘了寫。

---

## 1. 每日營運佇列

**入口：`/admin/care/operations`**

一頁看完今天需要有人處理的事。數字都是即時查出來的，沒有資料就是 0，
不會顯示估算值或示範資料。

| 佇列 | 意思 | 處理頁面 |
|---|---|---|
| 待初評 | 有人送出需求，還沒有人看 | `/admin/care/intakes` |
| 待派工 | 工單已開，還沒有人接 | `/admin/care/dispatch` |
| 服務中 | 今天正在進行 | `/admin/care/service-control` |
| 待紀錄核對 | 陪診員送審了，督導還沒核 | `/admin/care/records` |
| 待小結發布 | 小結送審了，還沒發布給家屬 | `/admin/care/summaries` |
| 未結案異常 | 服務中發生的營運異常 | `/admin/care/incidents` |
| 未結案意見 | 家屬或陪診員提出的意見 | `/admin/care/feedback` |
| 待改善事項 | 品質覆核產生的流程調整 | `/admin/care/quality` |
| 待結算明細 | 兼職的報酬待審核 | `/admin/care/settlements` |

**建議節奏**（時效待營運確認）：

- 每個工作日早上看一次，把「待派工」與「未結案異常」清掉
- 「待小結發布」不要過夜——家屬在等
- 「待結算明細」每週固定一天處理

---

## 2. 通知 outbox：現在是什麼狀態

**入口：`/admin/care/notifications`**

### 現況

**系統不會發送任何 LINE、簡訊或 Email。**

所有外部 outbox 一律停在 `not_configured`，原因碼 `no_provider_configured`。
資料庫層（`care_guard_outbox`）直接擋下任何「已送出／已送達」狀態，
所以也不會出現假的送達紀錄。

家屬與陪診員只會在**登入後**於站內看到通知。

### 沒有 provider 時怎麼人工處理

需要讓家屬知道某件事時：

1. 系統會建立站內通知（家屬下次登入就看得到）
2. **急件請用既有的客服管道電話或 LINE 手動聯絡**，並在
   `/admin/care/concerns` 或服務詳情頁記錄「已用電話告知」
3. 不要在通知內文裡寫細節——那是給收件人看的提示，不是傳遞內容的管道

### 未來要開通外部發送，需要先完成

| 項目 | 負責 | 狀態 |
|---|---|---|
| 選定通道與服務商（LINE OA／SMS／Email） | 產品 + 營運 | 待定 |
| opt-in 文案與撤回機制 | 法務 + 產品 | 待定 |
| 通知內容的最小揭露原則覆核 | 法務 | 待定 |
| 個資影響評估 | 法務 | 待定 |
| server-side 金鑰保管與輪替 | 工程 | 待定 |
| 送達失敗的處理與重試策略 | 營運 + 工程 | 待定 |

**誰可以批准**：待定。在營運與法務共同確認前，工程不得開啟
`EXTERNAL_NOTIFICATION_ENABLED`。

---

## 3. 回饋、意見與品質改善

### 回饋

**入口：`/admin/care/feedback`**

家屬要同時滿足三個條件才會收到邀請：服務已完成、小結已發布、
有 `view_service_summary` 授權。付款人不會自動收到。

回饋**不公開**、不會變成網站評價、不做人員排行。

處理流程：`submitted → under_review → closed`。

分數偏低或意見裡提到具體問題時，在 `/admin/care/concerns` 開一個案件追蹤，
不要只是把回饋標成已讀。

### 意見／申訴

`open → acknowledged → resolved → closed`。結案後不可重開。

**遇到這些內容，不要在系統內處理，轉出去**：

- 醫療爭議、病情疑問、用藥問題 → 引導家屬直接聯繫醫療人員
- 法律主張、求償 → 轉法務（聯絡窗口：待定）
- 個資相關請求（查閱、更正、刪除）→ 轉個資窗口，並在
  `/admin/care/lifecycle` 開一筆待辦

**處理時效**：待營運確認。目前系統只提供 `due_date` 欄位，不自動催辦。

### 品質改善

**入口：`/admin/care/quality`**

五項 checklist 覆核，需要調整時建立改善事項指派給陪診員。

**這是對流程，不是對人。** 改善事項不會自動產生人事處分，
也不會自動限制排班。陪診員看到的只有「要改什麼、何時前完成」。

**品質標準與審核責任人**：待定。

---

## 4. 資料誤寄、錯誤授權與帳號誤存取

發現有人看到了不該看到的資料時：

### 立即停止

1. **撤銷授權**：`/admin/care/services/[id]` → 撤回該使用者的
   `care_service_authorizations`。撤回後對方立刻讀不到，
   既有的通知連結也會被拒絕。
2. **停用帳號**（若是內部帳號）：`/admin/users` 移除權限。
   若是陪診員帳號，`/admin/care/staff` 暫停僱用條件。
3. **抑制 outbox**（若有相關通知）：`/admin/care/notifications` → 抑制。
   本輪沒有外部發送，所以不會有訊息已經寄出的情況。

### 記錄

- `/admin/audit` 查出誰在什麼時候讀取了什麼（稽核日誌不含內容，只有資源引用）
- 在 `/admin/care/concerns` 開一筆 `privacy_request` 案件
- 在 `/admin/care/lifecycle` 開一筆待辦，reason code 選 `user_request`

### 上報

**上報對象與時限：待法務確認。** 台灣個資法的通知義務、時限與對象
需要由法務確認後填入此處，工程不自行認定。

---

## 5. 上線與回滾

### Migration 執行順序

在 Supabase SQL Editor 依序執行（全部冪等，可重複執行）：

```
migrations/companion_care_schema.sql
migrations/care_operations_schema.sql        ← Sprint B
migrations/care_staffing_schema.sql          ← Sprint C
migrations/care_fulfilment_schema.sql        ← Sprint D
migrations/care_operations_closure_schema.sql ← Sprint E
```

`migrations/SPRINT_C_D_ALL.sql` 是 C + D 的合併版，方便一次貼上。

### 執行後驗證

```sql
select count(*) as sprint_e_tables from information_schema.tables
where table_schema = 'public' and table_name in (
  'care_notifications','care_notification_preferences','care_notification_outbox',
  'care_feedback_requests','care_feedback','care_concerns',
  'care_quality_reviews','care_quality_follow_ups',
  'care_policy_versions','care_policy_acceptances','care_data_lifecycle_reviews');
-- 應回傳 11

select count(*) as policy_drafts from care_policy_versions;
-- 應回傳 4（四種文件各一筆 draft，正文為空）
```

### 上線檢核

**入口：`/admin/care/release-readiness`**

每一項都從真實設定與資料算出來，**沒有手動打勾的功能**。

「人工待決」那一區永遠是待處理狀態，因為程式無從判斷這些有沒有被確認過。
上線與否是人的決定，這一頁只負責誠實呈現現況。

### 回滾

程式碼回滾：Vercel → Deployments → 選上一個 READY 的 production
deployment → Instant Rollback。

**資料庫不回滾。** 所有 migration 都是加法（新表、新欄位、新 trigger），
舊版程式碼不會因為多了這些東西而壞掉。若真的需要移除，
必須先確認沒有資料依賴，並由人工逐一 drop——不要寫自動回滾腳本。

---

## 6. 檢查與測試

```bash
npm test                          # 單元測試
node scripts/check-care-ops.mjs   # 陪診營運靜態檢查
node scripts/check-care-brand.mjs # 陪診品牌前台檢查
node scripts/check-simplified.mjs # 繁簡字檢查
```

正式建置由 Vercel 執行。`✓ Compiled successfully` 是型別與編譯的驗證訊號。

---

## 7. 人工待決項目彙總

以下沒有一項是工程可以自行決定的：

| 項目 | 需要誰確認 |
|---|---|
| 服務條款、隱私告知、取消規則、家屬交接說明的正文 | 法務 + 營運 |
| 外部通知通道、opt-in 文案、撤回機制 | 法務 + 產品 + 營運 |
| 資料保留期限、刪除與匿名化政策、備份策略 | 法務 + 工程 |
| 個資事故的上報對象與時限 | 法務 |
| 服務責任範圍與保險 | 營運 + 法務 |
| 異常升級 SOP 與緊急聯絡人 | 營運 + 照護專業 |
| 回饋與申訴的處理時效 | 營運 |
| 品質標準與審核責任人 | 營運 + 照護專業 |
| 陪診員報酬模型與結算規則 | 財務 + 營運 |
| 監控與錯誤追蹤 provider | 工程 |
