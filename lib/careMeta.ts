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

// ── 服務過程事件 ────────────────────────────────────────────
export const EVENT_TYPES = [
  { value: 'accepted',    label: '接受派工',     icon: '✅', color: 'bg-blue-100 text-blue-800' },
  { value: 'declined',    label: '婉拒派工',     icon: '🚫', color: 'bg-gray-200 text-gray-700' },
  { value: 'contacted',   label: '行前電話確認', icon: '📞', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'met',         label: '已與就診人會合', icon: '🤝', color: 'bg-purple-100 text-purple-800' },
  { value: 'progress',    label: '服務進度',     icon: '📸', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'doctor_note', label: '醫師重要提醒', icon: '🩺', color: 'bg-amber-100 text-amber-800' },
  { value: 'completed',   label: '服務完成',     icon: '🏁', color: 'bg-green-100 text-green-800' },
]

export function eventMeta(type: string) {
  return EVENT_TYPES.find(e => e.value === type) || { value: type, label: type, icon: '•', color: 'bg-gray-100 text-gray-700' }
}

export const EDUCATION_OPTIONS = [
  '國中', '高中職', '專科', '大學', '碩士以上',
]
