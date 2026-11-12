import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRunner } from '../extensions/myship-assistant/runner.mjs'

/**
 * 卡住的情況：助手記下「開始一批」後，網站建立批次失敗 → 網站上沒有這一批，
 * 助手卻停在「需要核對」。批次狀態查詢現在對不存在的批次回 0 筆（missing），
 * 「讀回上一批結果」要能把它結束，之後新訂單才能轉。
 */
test('網站上不存在的批次：讀回結果後結束，之後可以開始新的一批', async () => {
  const url = 'https://www.88ziyishequn.com/admin/myship'
  let job: any = { phase: 'attention', batch_id: '11111111-2222-3333-4444-555555555555', count: 2, source_url: url, marketplace_id: 'GM2601252733206', message: '部分訂單已匯出或資料已變更' }
  const calls: string[] = []
  const io: any = {
    load: async () => job,
    save: async (j: any) => { job = j },
    source: async (_j: any, cmd: string) => {
      calls.push(cmd)
      if (cmd === 'status') return { total: 0, confirmed: 0, pending: 0, released: 0, missing: true }
      throw new Error('不該呼叫 ' + cmd)
    },
    hasPilot: async () => true, pilotPassed: async () => { throw new Error('不存在的批次不能算驗收通過') },
    waitResult: async () => { throw new Error('不該等候結果') },
  }
  const runner = createRunner(io)
  const done = await runner.recover({ source_url: url })
  assert.equal(done.phase, 'complete')
  assert.deepEqual(calls, ['status'])   // 沒有上傳、沒有等結果
  // 結束後不會再被「上一批尚未結束」擋住
  assert.ok(!['attention', 'preparing', 'reserved'].includes(job.phase))
})
