/** Sprint E 顯示文字（前後台共用），與 domain 的 code 一一對應。 */

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  service_event_published: '服務進度',
  family_summary_published: '服務小結已發布',
  family_action_needed: '需要您確認',
  incident_contact_requested: '客服想聯絡您',
  feedback_requested: '邀請填寫回饋',
  quality_follow_up_requested: '流程改善事項',
  staff_schedule_updated: '班表異動',
  staff_time_off_reviewed: '請假審核結果',
  settlement_published: '結算已發布',
}

export const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  unread: '未讀',
  read: '已讀',
  archived: '已封存',
}

export const NOTIFICATION_CATEGORY_LABELS: Record<string, string> = {
  service_progress: '服務進度',
  summary_published: '服務小結',
  action_needed: '需要確認的事項',
  feedback_request: '回饋邀請',
  quality_follow_up: '流程改善',
  schedule: '班表與請假',
  settlement: '結算',
}

export const OUTBOX_STATUS_LABELS: Record<string, string> = {
  not_configured: '未設定外部通道',
  queued_for_approved_provider: '待送（已核准通道）',
  suppressed: '已抑制',
  cancelled: '已取消',
}

export const OUTBOX_SUPPRESSION_LABELS: Record<string, string> = {
  no_provider_configured: '尚無已核准的外部通知服務',
  recipient_not_opted_in: '收件人未同意外部通知',
  authorization_revoked: '授權已撤回',
  operations_decision: '營運決定不發送',
}

export const FEEDBACK_REQUEST_STATUS_LABELS: Record<string, string> = {
  eligible: '可填寫',
  presented: '已顯示給家屬',
  completed: '已填寫',
  expired: '已逾期',
  suppressed: '已停用',
}

export const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  submitted: '待查看',
  under_review: '處理中',
  closed: '已結案',
}

export const FEEDBACK_SCORE_LABELS: Record<string, string> = {
  score_reassurance: '整體安心感',
  score_communication: '溝通清楚度',
  score_process_support: '流程協助',
}

export const CONCERN_SOURCE_LABELS: Record<string, string> = {
  family_feedback: '來自回饋',
  family_submitted: '家屬提出',
  staff_submitted: '陪診員提出',
  operations_created: '營運建立',
}

export const CONCERN_CATEGORY_LABELS: Record<string, string> = {
  communication: '溝通',
  schedule: '時間安排',
  handover: '交接',
  service_experience: '服務體驗',
  privacy_request: '個資相關請求',
  other_non_medical: '其他（非醫療）',
}

export const CONCERN_STATUS_LABELS: Record<string, string> = {
  open: '待受理',
  acknowledged: '已受理',
  in_follow_up: '追蹤中',
  resolved: '已處理',
  closed: '已結案',
}

export const CONCERN_RESOLUTION_LABELS: Record<string, string> = {
  explained_to_family: '已向家屬說明',
  process_adjusted: '已調整流程',
  staff_coaching: '已與陪診員溝通',
  scheduling_fixed: '已修正時間安排',
  no_action_needed: '無須處理',
  referred_to_operations_sop: '已轉入營運 SOP 處理',
}

export const QUALITY_REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: '待覆核',
  in_review: '覆核中',
  completed: '已完成',
  follow_up_required: '需改善追蹤',
}

export const QUALITY_CHECKLIST_LABELS: Record<string, string> = {
  chk_events_complete: '服務事件完整',
  chk_record_on_time: '紀錄準時送審',
  chk_summary_clear: '小結清楚易懂',
  chk_authorization_correct: '授權設定正確',
  chk_communication_done: '溝通流程完成',
}

export const FOLLOW_UP_ACTION_LABELS: Record<string, string> = {
  record_timeliness: '服務紀錄準時送審',
  event_completeness: '流程節點回報完整',
  family_communication: '與家屬的溝通',
  handover_process: '交接流程',
  authorization_handling: '授權處理',
  other_process: '其他流程事項',
}

export const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  open: '待處理',
  in_progress: '處理中',
  completed: '已完成',
  verified: '已覆核',
  cancelled: '已取消',
}

export const POLICY_KIND_LABELS: Record<string, string> = {
  terms_of_service: '服務條款',
  privacy_notice: '隱私告知',
  cancellation_rules: '取消／改期規則',
  family_handover_notice: '家屬資訊交接與通知說明',
}

export const POLICY_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已發布',
  retired: '已停用',
}

export const LIFECYCLE_KIND_LABELS: Record<string, string> = {
  service_record: '內部服務紀錄',
  family_summary: '家屬小結',
  service_event: '服務事件',
  incident: '異常事件',
  feedback: '家屬回饋',
  concern: '意見案件',
  notification: '站內通知',
  settlement_line: '結算明細',
}

export const LIFECYCLE_STATUS_LABELS: Record<string, string> = {
  pending: '待處理',
  reviewed: '已檢視',
  retain: '維持保留',
  pending_legal_confirmation: '待法務確認',
}

export const LIFECYCLE_REASON_LABELS: Record<string, string> = {
  retention_period_review: '保留期限檢視',
  user_request: '使用者請求',
  operational_cleanup: '營運整理',
  legal_hold: '法律保留',
}

export const READINESS_STATE_LABELS: Record<string, string> = {
  ready: '已就緒',
  blocked: '待處理',
  not_applicable: '不適用',
}

export const OPERATIONS_QUEUE_LABELS: Record<string, string> = {
  pending_intakes: '待初評',
  pending_dispatch: '待派工',
  in_service: '服務中',
  pending_record_review: '待紀錄核對',
  pending_summary_publish: '待小結發布',
  open_incidents: '未結案異常',
  open_concerns: '未結案意見',
  open_quality_follow_ups: '待改善事項',
  pending_settlement_lines: '待結算明細',
}

export function labelOf(map: Record<string, string>, code: string | null | undefined): string {
  if (!code) return '—'
  return map[code] || code
}
