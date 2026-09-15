export type AssistantJob = { batch_id: string; phase: string; message: string }
export type AssistantStatus = { version: string; pilot: boolean; job: AssistantJob | null }

export function parseAssistantStatus(value: unknown): AssistantStatus {
  if (!value || typeof value !== 'object') throw new Error('助手狀態回覆不完整，請更新助手並重新整理頁面')
  const status = value as AssistantStatus
  if (typeof status.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(status.version) || typeof status.pilot !== 'boolean' ||
      (status.job !== null && (!status.job || typeof status.job.batch_id !== 'string' ||
        !['preparing', 'reserved', 'upload_attempted', 'checking', 'attention', 'paused', 'complete'].includes(status.job.phase) || typeof status.job.message !== 'string'))) {
    throw new Error('助手狀態回覆不完整，請更新助手並重新整理頁面')
  }
  return status
}
