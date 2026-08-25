/**
 * 陪診營運的顯示文字（前後台共用）。
 * 與 domain.ts 的 code 一一對應，避免在頁面各寫一份中文。
 */

export const INTAKE_STATUS_LABELS: Record<string, string> = {
  submitted: '待初評',
  in_review: '審查中',
  needs_more_information: '需補資料',
  declined: '已婉拒',
  converted_to_case: '已轉為案件',
}

export const CASE_STATUS_LABELS: Record<string, string> = {
  needs_assessment: '待評估／待報價',
  awaiting_quote_confirmation: '等待家屬確認報價',
  awaiting_payment: '等待付款確認',
  ready_to_match: '準備媒合',
  cancelled: '已取消',
}

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  sent: '已發送',
  confirmed: '已確認',
  expired: '已過期',
  cancelled: '已作廢',
}

export const SCENARIO_LABELS: Record<string, string> = {
  routine_visit: '一般門診／拿慢箋',
  visit_with_tests: '門診加檢查',
  multi_department_or_full_day: '多科別或全日',
  post_procedure_discharge: '術後／麻醉離院',
  unsure: '不確定',
}

export const MOBILITY_LABELS: Record<string, string> = {
  independent: '可自行行走',
  assistive_device: '使用助行器',
  wheelchair: '需輪椅',
  manual_review_required: '需人工確認',
}

export const TIME_PREFERENCE_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  all_day: '全日',
  unspecified: '未指定',
}

export const CONTACT_PREFERENCE_LABELS: Record<string, string> = {
  phone: '電話',
  line: 'LINE',
}

export const DECLINE_REASON_LABELS: Record<string, string> = {
  out_of_service_area: '不在服務範圍',
  date_unavailable: '該日期無法安排',
  beyond_service_scope: '超出服務範圍',
  requires_medical_staff: '需要醫療人員，非陪診可承接',
  unable_to_contact: '無法聯繫',
  duplicate_request: '重複申請',
  other: '其他（請於說明補充）',
}

export const CASE_CANCEL_REASON_LABELS: Record<string, string> = {
  family_cancelled: '家屬取消',
  no_longer_needed: '已不需要',
  quote_rejected: '報價未被接受',
  unable_to_staff: '無法安排人力',
  beyond_service_scope: '超出服務範圍',
  other: '其他',
}

export function labelFor(map: Record<string, string>, code: string | null | undefined): string {
  if (!code) return '—'
  return map[code] || code
}

export function statusChipClass(kind: 'intake' | 'case' | 'quote', code: string): string {
  const neutral = 'bg-gray-100 text-gray-700'
  const map: Record<string, string> = {
    submitted: 'bg-amber-100 text-amber-800',
    in_review: 'bg-blue-100 text-blue-800',
    needs_more_information: 'bg-orange-100 text-orange-800',
    declined: neutral,
    converted_to_case: 'bg-green-100 text-green-800',
    needs_assessment: 'bg-amber-100 text-amber-800',
    awaiting_quote_confirmation: 'bg-blue-100 text-blue-800',
    awaiting_payment: 'bg-orange-100 text-orange-800',
    ready_to_match: 'bg-green-100 text-green-800',
    cancelled: neutral,
    draft: neutral,
    sent: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-100 text-green-800',
    expired: 'bg-gray-200 text-gray-700',
  }
  return map[code] || neutral
}
