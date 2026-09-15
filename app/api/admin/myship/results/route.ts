import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json } from '@/lib/myship/server'
import { MAX_RESULT_BYTES, parseResultWorkbook, matchResultRows } from '@/lib/myship/results'
import { writeAuditLog } from '@/lib/audit'
import { confirmError } from '@/lib/myship/confirmError'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  try {
    const batch = req.nextUrl.searchParams.get('batch_id') || ''
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(batch)) return failure('批次編號格式錯誤')
    // A raw, bounded workbook avoids unbounded multipart buffering and base64 expansion.
    if (Number(req.headers.get('content-length')) > MAX_RESULT_BYTES) return failure('結果檔超過2 MB', 413)
    const reader = req.body?.getReader()
    if (!reader) return failure('請提供匯入結果檔案')
    const chunks: Uint8Array[] = []; let length = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if ((length += value.length) > MAX_RESULT_BYTES) { await reader.cancel(); return failure('結果檔超過2 MB', 413) }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const file = Buffer.concat(chunks)
    const rows = parseResultWorkbook(file)
    const { data: transfers, error } = await supabaseAdmin.from('myship_transfers').select('id,order_id,import_row,status,external_order_no').eq('batch_id', batch)
    if (error) return failure('讀取原批次失敗', 500)
    if (!transfers?.length) return failure('找不到原批次', 404)
    const matched = matchResultRows(rows, transfers)
    // Preview is read-only; the assistant uses apply only after it has obtained the result.
    if (req.nextUrl.searchParams.get('apply') !== 'true') return json({ count: matched.confirmed.length, unresolved: matched.unresolved })
    const unresolved = [...matched.unresolved]
    let confirmed = 0
    for (let start = 0; start < matched.confirmed.length; start += 10) {
      const outcomes = await Promise.all(matched.confirmed.slice(start, start + 10).map(async row => {
        const { error } = await supabaseAdmin.rpc('myship_confirm_transfer', { p_transfer_id: row.transfer_id, p_external_order_no: row.external_order_no, p_admin_id: auth.admin.id })
        return { row, error }
      }))
      for (const { row, error } of outcomes) {
        if (error) unresolved.push({ order_no: row.order_no, reason: confirmError(error) })
        else confirmed++
      }
    }
    await writeAuditLog(req, auth.admin, 'myship.results', `batch=${batch};sha256=${createHash('sha256').update(file).digest('hex')};confirmed=${confirmed};unresolved=${unresolved.length}`)
    return json({ confirmed, unresolved, complete: unresolved.length === 0 })
  } catch (e) { return failure(e instanceof Error ? e.message : '無法讀取結果檔案', 400) }
}
