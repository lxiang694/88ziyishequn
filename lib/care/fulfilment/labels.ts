/** Sprint D 顯示文字（前後台共用），與 domain 的 code 一一對應。 */

export const EVENT_LABELS: Record<string, string> = {
  staff_arrived: '陪診員已抵達',
  beneficiary_met: '已與就診人會合',
  registration_or_checkin_completed: '已完成報到',
  waiting_or_process_in_progress: '院內流程進行中',
  process_transition: '進入下一個流程',
  return_arrangement_confirmed: '返程安排已確認',
  service_handover_ready: '待交接／待小結',
  requires_supervisor_attention: '需督導處理',
}

export const RECORD_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  submitted: '待核對',
  returned_for_revision: '已退回補正',
  reviewed: '已核可',
  superseded: '已被新版取代',
}

export const SUMMARY_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  in_review: '待審核',
  published: '已發布',
  withdrawn: '已撤回',
  superseded: '已被新版取代',
}

export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  family_contact_needed: '需聯繫家屬',
  schedule_or_handover_issue: '時程或交接問題',
  facility_process_follow_up: '院方流程需跟進',
  supervisor_attention_needed: '需督導協助',
}

export const INCIDENT_STATUS_LABELS: Record<string, string> = {
  open: '待處理',
  acknowledged: '已受理',
  resolved: '已處理',
  closed: '已結案',
}

export const SEVERITY_LABELS: Record<string, string> = {
  low: '一般', medium: '優先', high: '緊急處理',
}

export const NOTIFICATION_LABELS: Record<string, string> = {
  not_required: '不需通知',
  pending: '待準備',
  prepared: '已備妥，待人工聯繫',
  sent_or_confirmed: '已確認送達',
  failed: '通知失敗',
}

export const LINE_STATUS_LABELS: Record<string, string> = {
  pending_review: '待審核',
  approved: '已核准',
  rejected: '已駁回',
  batched: '已入批次',
  published_to_staff: '已發布給陪診員',
}

export const BATCH_STATUS_LABELS: Record<string, string> = {
  draft: '草稿', approved: '已核准', published: '已發布', closed: '已關閉',
}

export const LINE_TYPE_LABELS: Record<string, string> = {
  service_compensation: '服務報酬',
  transport_reimbursement: '交通代墊',
  manual_adjustment: '人工調整',
}

export const RETURN_REASON_LABELS: Record<string, string> = {
  incomplete_process_steps: '流程項目未填完整',
  unclear_objective_summary: '客觀說明不夠清楚',
  missing_family_follow_up: '缺少需家屬處理的事項',
  contains_disallowed_content: '含有不應記錄的內容',
}

export const FOLLOW_UP_REASON_LABELS: Record<string, string> = {
  family_confirmation_needed: '需家屬確認',
  next_appointment_to_arrange: '需安排下次回診',
  transport_arrangement_pending: '交通安排待確認',
  documents_to_collect: '有文件待領取',
}

export const RESOLUTION_LABELS: Record<string, string> = {
  handled_on_site: '現場已處理',
  family_contacted: '已聯繫家屬',
  schedule_adjusted: '已調整時程',
  escalated_to_operations: '已轉營運處理',
  no_action_needed: '不需處理',
}

export const WITHDRAW_REASON_LABELS: Record<string, string> = {
  content_correction_needed: '內容需更正',
  published_in_error: '誤發布',
  authorization_revoked: '授權已撤回',
  family_requested: '家屬要求',
}

export const INVALIDATE_REASON_LABELS: Record<string, string> = {
  entered_by_mistake: '誤填',
  wrong_booking: '記錯服務',
  duplicate_entry: '重複記錄',
  corrected_by_later_event: '已由後續事件更正',
}

export const SCOPE_LABELS: Record<string, string> = {
  receive_service_notification: '接收服務進度',
  view_service_summary: '閱讀服務小結',
  view_service_photo: '檢視服務照片（未啟用）',
}

export const ADJUSTMENT_REASON_LABELS: Record<string, string> = {
  overtime_agreed: '已同意的超時',
  extra_transport_agreed: '已同意的額外交通',
  correction_of_previous_line: '更正前一筆明細',
  service_shortened: '服務時間縮短',
  other_approved_by_supervisor: '其他（督導已核准）',
}

export function labelOf(map: Record<string, string>, code: string | null | undefined): string {
  if (!code) return '—'
  return map[code] || code
}

export function chipClass(code: string): string {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    submitted: 'bg-amber-100 text-amber-800',
    in_review: 'bg-amber-100 text-amber-800',
    returned_for_revision: 'bg-orange-100 text-orange-800',
    reviewed: 'bg-green-100 text-green-800',
    published: 'bg-green-100 text-green-800',
    withdrawn: 'bg-gray-200 text-gray-700',
    superseded: 'bg-gray-200 text-gray-700',
    open: 'bg-red-100 text-red-800',
    acknowledged: 'bg-amber-100 text-amber-800',
    resolved: 'bg-blue-100 text-blue-800',
    closed: 'bg-gray-200 text-gray-700',
    pending_review: 'bg-amber-100 text-amber-800',
    approved: 'bg-blue-100 text-blue-800',
    rejected: 'bg-gray-200 text-gray-700',
    batched: 'bg-indigo-100 text-indigo-800',
    published_to_staff: 'bg-green-100 text-green-800',
    high: 'bg-red-100 text-red-800',
    medium: 'bg-amber-100 text-amber-800',
    low: 'bg-gray-100 text-gray-700',
  }
  return map[code] || 'bg-gray-100 text-gray-700'
}
