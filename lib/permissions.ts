// 後台可指派的權限清單（'all' = 超級管理員，擁有全部權限，單獨處理）
export const PERMISSION_CATALOG: { key: string; label: string; hint?: string }[] = [
  { key: 'orders.view', label: '查看訂單、銷售報表、復購分析', hint: '含客戶手機等資料' },
  { key: 'orders.status', label: '更新訂單狀態' },
  { key: 'orders.status.ship', label: '出貨作業（備貨 / 出貨 / 到店）' },
  { key: 'orders.edit', label: '編輯訂單' },
  { key: 'products.all', label: '商品管理、健康知識文章' },
  { key: 'categories.all', label: '健康分類管理' },
  { key: 'events.view', label: '社群活動報名管理' },
]

export const ALL_PERMISSION = 'all'

// 稽核動作標籤
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  page_view: '瀏覽頁面',
  export_customers: '下載客戶 / 復購名單',
  export_event_registrations: '下載活動報名名單',
  export_orders: '下載訂單資料',
  export_members: '下載會員資料',
}

// 屬於「資料下載」的動作（需提示超級管理員）
export function isDownloadAction(action: string): boolean {
  return action.startsWith('export_')
}
