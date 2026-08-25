/** Sprint C 顯示文字 */
export const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: '全職', part_time: '兼職',
}
export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  active: '生效中', paused: '暫停接案', ended: '已結束',
}
export const CAPABILITY_LABELS: Record<string, string> = {
  general_outpatient_flow: '一般門診流程協助',
  wheelchair_route_support: '輪椅動線協助',
  dementia_communication: '失智溝通應對',
  post_procedure_discharge_protocol: '術後離院流程',
}
export const VERIFICATION_LABELS: Record<string, string> = {
  verified: '已驗證', expired: '已過期', suspended: '已暫停',
}
export const TIME_OFF_TYPE_LABELS: Record<string, string> = {
  leave: '請假', unavailable: '暫停接案',
}
export const TIME_OFF_STATUS_LABELS: Record<string, string> = {
  submitted: '待審核', approved: '已核准', rejected: '已拒絕', cancelled: '已取消',
}
export const TIME_OFF_REASON_LABELS: Record<string, string> = {
  personal: '個人事務', family: '家庭因素', sick: '身體不適',
  training: '教育訓練', other_unavailable: '其他無法接案',
}
export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  proposed: '待回覆', accepted: '已接受', declined: '已婉拒',
  expired: '已逾時', cancelled: '已撤回',
}
export const DECLINE_LABELS: Record<string, string> = {
  schedule_conflict: '時間衝突', too_far: '距離太遠',
  not_confident_with_case: '這類情況我不熟悉', personal_reason: '個人因素', other: '其他',
}
export const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

export function labelOf(map: Record<string, string>, code: string | null | undefined): string {
  if (!code) return '—'
  return map[code] || code
}
export function chipClass(code: string): string {
  const m: Record<string, string> = {
    active: 'bg-green-100 text-green-800', paused: 'bg-amber-100 text-amber-800',
    ended: 'bg-gray-200 text-gray-700', verified: 'bg-green-100 text-green-800',
    expired: 'bg-gray-200 text-gray-700', suspended: 'bg-red-100 text-red-800',
    submitted: 'bg-amber-100 text-amber-800', approved: 'bg-green-100 text-green-800',
    rejected: 'bg-gray-200 text-gray-700', cancelled: 'bg-gray-200 text-gray-700',
    proposed: 'bg-blue-100 text-blue-800', accepted: 'bg-green-100 text-green-800',
    declined: 'bg-gray-200 text-gray-700',
  }
  return m[code] || 'bg-gray-100 text-gray-700'
}
