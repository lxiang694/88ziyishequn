# PRODUCT SPEC

> 本文件於 Sprint B 建立，只涵蓋陪診服務。商城（健康優選）的規格
> 未曾以文件形式存在，本輪不追溯補寫未經驗證的內容。

## 產品定位

陪診服務是「**就醫流程協調與家庭資訊交接**」，不是醫療機構，也不是醫療病歷系統。

> 家人不在現場，重要就醫流程也有人可靠陪同。
>
> 協助報到、院內動線、候診、流程銜接與重點記錄；服務前確認需求與費用，
> 服務中依約回報家屬。陪診員不提供醫療判斷，也不代替病人或家屬做醫療決定。

### 明確不做的事

- 不提供醫療診斷與醫療建議，不判讀報告
- 不調整、不代管藥物，不執行醫療處置
- 不代簽手術、麻醉、檢查同意書
- 不代替病人或家屬做醫療決定
- 系統不是病歷系統，不蒐集病史、診斷、處方與劑量

## 兩個工作區

總後台 `/admin` 首頁是**工作區選擇**，不把零售與陪診資料混在一起：

| 工作區 | 入口 | 說明 |
|---|---|---|
| 零售營運 | `/admin/dashboard` | 訂單、商品、健康知識、報表、社群活動 |
| 陪診營運 | `/admin/care` | 需求初評、案件流程、報價管理 |

兩者共用登入、RBAC、資料庫與部署，但**不共用功能選單，也不混合客戶資料**。
陪診工作區只對具備陪診業務權限的帳號顯示。

## Sprint A（已完成）

`/care` 獨立品牌前台，七條路由，與商城完全分離的外殼、導覽與頁尾。
詳見 `lib/careBrand.ts` 與 `scripts/check-care-brand.mjs`。

## Sprint B（本輪）

流程：`初步需求 → 人工初評 → 報價草稿 → 家屬確認報價 → 等待付款／準備媒合`

### 初評 care_intake

| 狀態 | 意義 |
|---|---|
| `submitted` | 客戶剛送出，待初評 |
| `in_review` | 已開始審查 |
| `needs_more_information` | 已請家屬補充資料 |
| `declined` | 婉拒（終態，必須有原因 code） |
| `converted_to_case` | 已轉為案件（終態） |

允許的轉換：

```
submitted              → in_review | declined
in_review              → needs_more_information | declined | converted_to_case
needs_more_information → in_review | declined
declined               → （終態）
converted_to_case      → （終態）
```

**不可**從 `submitted` 直接轉為案件 —— 必須經過人工審查。

### 案件 care_case

| 狀態 | 意義 |
|---|---|
| `needs_assessment` | 待評估／待報價 |
| `awaiting_quote_confirmation` | 報價已發送，等待家屬確認 |
| `awaiting_payment` | 報價已確認，等待付款 |
| `ready_to_match` | 已人工確認收款，準備媒合 |
| `cancelled` | 已取消（終態，必須有原因 code） |

```
needs_assessment            → awaiting_quote_confirmation | cancelled
awaiting_quote_confirmation → awaiting_payment | needs_assessment | cancelled
awaiting_payment            → ready_to_match | cancelled
ready_to_match              → cancelled
cancelled                   → （終態）
```

`awaiting_quote_confirmation → needs_assessment` 用於報價作廢後退回重報。

**必須先確認報價**才能進入 `awaiting_payment`；
**必須先等待付款**才能進入 `ready_to_match`。

### 報價 care_quote_estimate

報價是**版本化快照**，不是前端傳入的一個總金額。

| 狀態 | 意義 |
|---|---|
| `draft` | 草稿，可修改 |
| `sent` | 已發送給家屬 |
| `confirmed` | 家屬已確認（凍結） |
| `expired` | 已過期（凍結，終態） |
| `cancelled` | 已作廢（凍結，終態） |

```
draft     → sent | cancelled
sent      → confirmed | expired | cancelled
confirmed → cancelled
expired   → （終態）
cancelled → （終態）
```

`confirmed` / `expired` / `cancelled` 的金額與快照**不可修改**，
由 Service 與資料庫 trigger 雙重防護。一個案件同時只能有一份 `confirmed` 報價。

報價必含：方案 immutable snapshot、基本服務費、加購明細快照、
交通預估金額與**計價說明**、**超時規則快照**（不可只寫「另計」）、
幣別、合計、有效期限、確認人與確認時間。

## 刻意延後到 Sprint C/D

以下**不在** Sprint B 範圍，程式中也沒有半成品：

- 陪診員媒合與自動派工
- 全職／兼職、班表、可服務時段、陪診員邀請
- 服務中回報、原始服務紀錄、家屬服務小結、現場照片、事故管理
- 薪資、兼職報酬、結算、退款、發票、任何金流串接
- 家屬線上入口的驗證後查詢
- per-case 的資料範圍限制

`ready_to_match` 之後的媒合與派工需由客服在既有的「陪診預約」與
「陪診員管理」中另行處理。

## Sprint D（服務履約與家屬資訊交接）

流程：`派工 → 服務中記錄節點 → 服務紀錄送審 → 督導核對 → 家屬小結發布 → 結算`

### 服務事件 care_service_event

八種受控類型：`staff_arrived`、`beneficiary_met`、
`registration_or_checkin_completed`、`waiting_or_process_in_progress`、
`process_transition`、`return_arrangement_confirmed`、`service_handover_ready`、
`requires_supervisor_attention`。

事件是 **append-only**，時間由伺服器寫入，預設 `internal`。
只有督導能逐筆開放給家屬，且 `service_handover_ready` 與
`requires_supervisor_attention` **永遠不對家屬顯示**。

### 內部服務紀錄 care_service_record

```
draft                 → submitted | superseded
submitted             → reviewed | returned_for_revision
returned_for_revision → submitted | superseded
reviewed              → superseded
```

陪診員只能在 `draft` / `returned_for_revision` 編輯。送審後不可改寫；
`reviewed` 內容凍結，要改只能建立新版本。原始紀錄**不對家屬、付款人、客服或財務開放**。

### 家屬小結 care_family_summary

```
draft     → in_review | superseded
in_review → published | draft | superseded
published → withdrawn | superseded
withdrawn → superseded
```

只有 `care_summary.review` 能建立、修改、發布、撤回。**陪診員不能自行發布。**
已發布內容不可悄悄修改；發布新版本時舊版自動 `superseded`，家屬永遠只看到一份。
內容只寫客觀流程與需家屬處理的事項——需向院方確認的事寫成
「請家屬向醫療人員確認…」，不替家屬下決策。

### 異常事件 care_incident

```
open         → acknowledged | resolved
acknowledged → resolved
resolved     → closed
```

四種類型皆為營運性質。`severity` 只是處理優先級，**不是醫療嚴重度**。
UI 明確標示：現場緊急狀況請依院方流程與服務 SOP 立即處理，這裡只做事後記錄與升級。

通知狀態 `not_required → pending → prepared`。**永遠不會到 `sent_or_confirmed`**，
因為沒有任何通知管道。

### 結算 care_settlement_line / batch

```
line:  pending_review → approved | rejected
       approved       → batched | published_to_staff | pending_review
       batched        → published_to_staff
batch: draft → approved → published → closed
```

只有兼職產生報酬明細，**全職只有服務統計**（Service 與資料庫 trigger 都擋）。
`unique (booking_id, line_type)` 防止重複計算。陪診員只看得到 `published_to_staff` 的自己的明細。

`closed` 只代表平台內部批次關閉，**不代表銀行已匯款**。

### 刻意延後

醫療診斷與病歷、代簽同意、緊急救援調度、照片／附件上傳、
實際外部通知、實際付款與銀行資料、薪資／勞健保／稅務／發票／退款、
自動派工、AI 摘要與圖片辨識、per-case 資料範圍。
