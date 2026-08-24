// 陪診服務共用定義（前台、後台、陪診員端共用）

export const TW_COUNTIES = [
  '基隆市', '台北市', '新北市', '桃園市', '新竹市', '新竹縣', '苗栗縣',
  '台中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣',
  '台南市', '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '台東縣',
  '澎湖縣', '金門縣', '連江縣',
]

export const TIME_SLOTS = [
  { value: 'morning', label: '上午（08:00–12:00）' },
  { value: 'afternoon', label: '下午（13:00–17:00）' },
  { value: 'allday', label: '全日（08:00–17:00）' },
]

export const MOBILITY_OPTIONS = [
  { value: 'walk', label: '可自行行走' },
  { value: 'assist', label: '需攙扶／使用助行器' },
  { value: 'wheelchair', label: '需輪椅' },
]

export const ADDON_OPTIONS = [
  { value: 'pickup', label: '到府接送陪同（往返）', note: '交通費另計，依實際里程' },
  { value: 'queue', label: '提前到院代排隊掛號', note: '' },
  { value: 'report', label: '就診重點書面整理（PDF）', note: '' },
  { value: 'female', label: '指定女性陪診員', note: '' },
]

// 預約流程狀態
export const BOOKING_STATUSES = ['待確認', '待匯款', '已付款', '已派工', '服務中', '已完成', '已取消']

export function statusColor(status: string): string {
  switch (status) {
    case '待確認': return 'bg-amber-100 text-amber-800'
    case '待匯款': return 'bg-orange-100 text-orange-800'
    case '已付款': return 'bg-blue-100 text-blue-800'
    case '已派工': return 'bg-indigo-100 text-indigo-800'
    case '服務中': return 'bg-purple-100 text-purple-800'
    case '已完成': return 'bg-green-100 text-green-800'
    case '已取消': return 'bg-gray-200 text-gray-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

export function labelOf(list: { value: string; label: string }[], value?: string | null): string {
  if (!value) return ''
  return list.find(o => o.value === value)?.label || value
}
