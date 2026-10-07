export const LOCAL_LABEL_ASSISTANT = 'http://127.0.0.1:8756'
export const PAIRING_STORAGE_KEY = 'health.myship-label-pairing.v1'

export type LabelResult = {
  orderNo: string
  status: 'pending' | 'pdf_ready' | 'failed' | 'uploading' | 'uncertain' | 'uploaded'
  sha256: string
  tracking: string
  carrier: string
  progress: number | null
  verification: 'rows' | 'manual'
  warnings: string[]
}

export function buildLabelHandoff(input: {
  key: string; requestId: string; orderNos: string[]; source: string; upload: boolean
}) {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(input.key)) throw new Error('請先完成本機助手配對')
  const orders = [...new Set(input.orderNos)]
  if (!orders.length || orders.length > 500 || orders.some(no => !/^CM\d{13}$/.test(no))) {
    throw new Error('請選擇 1 至 500 筆有正確 CM 編號的訂單')
  }
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId)) throw new Error('送單識別不正確')
  return `${LOCAL_LABEL_ASSISTANT}/#handoff=${encodeURIComponent(JSON.stringify({
    key: input.key, request_id: input.requestId, orders, source: input.source, upload: input.upload,
  }))}`
}

export function validateLabelResults(value: unknown, expected: readonly string[]): LabelResult[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error('助手結果格式不正確')
  const allowed = new Set(expected)
  const seen = new Set<string>()
  const statuses = new Set(['pending', 'pdf_ready', 'failed', 'uploading', 'uncertain', 'uploaded'])
  return value.map(row => {
    if (!row || typeof row !== 'object' || typeof row.orderNo !== 'string' || !allowed.has(row.orderNo) || seen.has(row.orderNo)) {
      throw new Error('助手結果含本批以外或重複的訂單')
    }
    seen.add(row.orderNo)
    if (!statuses.has(row.status)) throw new Error('助手狀態不正確')
    const sha256 = typeof row.sha256 === 'string' ? row.sha256 : ''
    const tracking = typeof row.tracking === 'string' ? row.tracking.slice(0, 100) : ''
    const carrier = typeof row.carrier === 'string' ? row.carrier.slice(0, 100) : ''
    if (sha256 && !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('PDF 核對資料不正確')
    if (row.status === 'uploaded' && (!sha256 || (row.verification !== 'manual' &&
      (row.verification !== 'rows' || row.progress !== 100 || !tracking || !carrier)))) {
      throw new Error('成功結果缺少逐筆核對證據')
    }
    return { orderNo: row.orderNo, status: row.status, sha256, tracking, carrier,
      progress: row.progress === 100 ? 100 : null,
      verification: row.verification === 'manual' ? 'manual' : 'rows',
      warnings: Array.isArray(row.warnings) ? row.warnings.filter((w: unknown) => typeof w === 'string').slice(0, 5).map((w: string) => w.slice(0, 250)) : [] }
  })
}
