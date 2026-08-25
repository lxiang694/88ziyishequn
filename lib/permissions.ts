// 後台可指派的權限清單（'all' = 超級管理員，擁有全部權限，單獨處理）
export const PERMISSION_CATALOG: { key: string; label: string; hint?: string }[] = [
  { key: 'orders.view', label: '查看訂單、銷售報表、復購分析', hint: '含客戶手機等資料' },
  { key: 'orders.status', label: '更新訂單狀態' },
  { key: 'orders.status.ship', label: '出貨作業（備貨 / 出貨 / 到店）' },
  { key: 'orders.edit', label: '編輯訂單' },
  { key: 'products.all', label: '商品管理、健康知識文章' },
  { key: 'categories.all', label: '健康分類管理' },
  { key: 'events.view', label: '社群活動報名管理' },
  // ── 陪診營運（Sprint B）──────────────────────────────────
  // 這四個與既有的 care.view（陪診預約頁）責任不同，不可互相沿用。
  { key: 'care_operations.view', label: '陪診營運：檢視總覽與清單', hint: '不含補充需求等自由文字' },
  { key: 'care_intake.manage', label: '陪診營運：初評審查', hint: '可看到補充需求與聯絡方式' },
  { key: 'care_quote.manage', label: '陪診營運：報價草稿與確認' },
  { key: 'care_case.manage', label: '陪診營運：案件狀態與人工收款確認' },
]

export const ALL_PERMISSION = 'all'

// 稽核動作標籤
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  page_view: '瀏覽頁面',
  export_customers: '下載客戶 / 復購名單',
  export_event_registrations: '下載活動報名名單',
  export_orders: '下載訂單資料',
  export_members: '下載會員資料',
  // 陪診營運（Sprint B）
  'care_intake.review_start': '陪診初評：開始審查',
  'care_intake.request_more_info': '陪診初評：要求補充資料',
  'care_intake.decline': '陪診初評：婉拒',
  'care_intake.convert_to_case': '陪診初評：轉為案件',
  'care_case.cancel': '陪診案件：取消',
  'care_case.mark_payment_received': '陪診案件：人工確認收款',
  'care_quote.draft_create': '陪診報價：建立草稿',
  'care_quote.update_draft': '陪診報價：修改草稿',
  'care_quote.send': '陪診報價：發送',
  'care_quote.confirm': '陪診報價：確認',
  'care_quote.expire': '陪診報價：設為過期',
  'care_quote.cancel': '陪診報價：作廢',
}

// 屬於「資料下載」的動作（需提示超級管理員）
export function isDownloadAction(action: string): boolean {
  return action.startsWith('export_')
}
