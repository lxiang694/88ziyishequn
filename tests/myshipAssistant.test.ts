import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRunner, isHealth } from '../extensions/myship-assistant/runner.mjs'

const input = { source_tab: 1, source_url: 'https://www.88ziyishequn.com/admin/myship', marketplace_id: 'GM2601252733206', order_ids: [1] }
function setup() {
  let stored: any = null
  // 驗收狀態按賣場記錄，與助手實際的 storage key 一致
  const pilots = new Set<string>()
  const calls: string[] = []
  const io = {
    load: async () => structuredClone(stored), save: async (job: any) => { stored = structuredClone(job); calls.push(`save:${job.phase}`) },
    hasPilot: async (market: string) => pilots.has(market),
    pilotPassed: async (market: string) => { pilots.add(market) },
    uuid: () => '00000000-0000-4000-8000-000000000001', now: () => '2026-09-10',
    findTarget: async () => ({ id: 2, url: 'https://myship.7-11.com.tw/seller/order/DealWith' }),
    source: async (_job: any, command: string) => {
      calls.push(command)
      if (command === 'context') return { orders: [{ order_id: 1, reserved: false, errors: [], marketplace_id: _job.marketplace_id }] }
      if (command === 'file') return 'file'
      if (command === 'apply') return { confirmed: 1, unresolved: [], complete: true }
      if (command === 'status') return { pending: 1, confirmed: 0, released: 0 }
      return {}
    },
    target: async (_job: any, command: string) => { calls.push(command); assert.equal(stored.phase, 'upload_attempted'); return {} },
    waitResult: async () => { calls.push('read-result'); return 'result' },
    resetTarget: async () => { calls.push('reset-target') },
  }
  return { io, calls, state: () => stored, pilot: (market = input.marketplace_id) => pilots.has(market) }
}
test('上傳前先保存狀態，成功結果後才回寫並允許批次處理', async () => {
  const env = setup(), runner = createRunner(env.io)
  await runner.start(input)
  assert.ok(env.calls.indexOf('create') < env.calls.indexOf('upload'))
  assert.ok(env.calls.indexOf('save:upload_attempted') < env.calls.indexOf('upload'))
  assert.ok(env.calls.indexOf('read-result') < env.calls.indexOf('apply'))
  assert.equal(env.state().phase, 'complete'); assert.equal(env.pilot(), true)
})
test('提交後頁面切換只讀結果；讀取失敗、重啟或再次按下都不能重傳', async () => {
  const env = setup()
  env.io.target = async () => { env.calls.push('upload'); throw Object.assign(new Error('navigation'), { uncertain: true }) }
  env.io.waitResult = async () => { throw new Error('download unavailable') }
  const runner = createRunner(env.io)
  await assert.rejects(runner.start(input))
  assert.equal(env.state().phase, 'attention')
  assert.equal(env.calls.includes('apply'), false)
  const restarted = createRunner(env.io)
  await assert.rejects(restarted.start(input))
  env.io.waitResult = async () => 'result'
  await restarted.recover(input)
  assert.equal(env.calls.filter(c => c === 'upload').length, 1)
  assert.equal(env.state().phase, 'complete')
  assert.equal(env.pilot(), true)
})

test('人工核對後恢復只讀批次狀態；解除保留或數量不符不能通過首次驗收', async () => {
  for (const state of [{ pending: 0, confirmed: 0, released: 1 }, { pending: 0, confirmed: 0, released: 0 }, { pending: 0, confirmed: 2, released: 0 }]) {
    const env = setup(), originalSource = env.io.source
    env.io.waitResult = async () => { throw new Error('awaiting result') }
    const runner = createRunner(env.io); await assert.rejects(runner.start(input))
    env.io.source = async (job, command) => command === 'status' ? state : originalSource(job, command)
    await runner.recover(input)
    assert.equal(env.pilot(), false); assert.equal(env.calls.filter(c => c === 'upload').length, 1)
    assert.equal(env.calls.includes('apply'), false)
  }
})
test('整批成功後把賣貨便分頁帶回匯入頁，下一批不必手動點回來', async () => {
  const env = setup()
  await createRunner(env.io).start(input)
  assert.equal(env.state().phase, 'complete')
  // 一定要在回寫之後才導頁，否則等於在狀態寫好之前就把來源頁面換掉
  assert.ok(env.calls.indexOf('apply') < env.calls.indexOf('reset-target'))
  assert.match(env.state().message, /匯入頁/)
})

test('有未處理項目時不導頁 —— 那張結果頁正是使用者要看的東西', async () => {
  const env = setup(), source = env.io.source
  env.io.source = async (job: any, command: string) => command === 'apply'
    ? { confirmed: 0, unresolved: [{ order_no: 'test', reason: 'pending' }], complete: false } as any
    : source(job, command)
  await createRunner(env.io).start(input)
  assert.equal(env.state().phase, 'attention')
  assert.equal(env.calls.includes('reset-target'), false)
})

test('導頁失敗不影響已完成的轉單', async () => {
  // 分頁可能已被關掉或手動導去別處。訂單在上一步就已經回寫完成，
  // 不該因為這個便利功能失敗就讓整批看起來壞掉。
  const env = setup()
  env.io.resetTarget = async () => { throw new Error('No tab with id: 2.') }
  const final = await createRunner(env.io).start(input)
  assert.equal(final.phase, 'complete')
  assert.equal(env.state().phase, 'complete')
})

test('舊版助手沒有 resetTarget 也不會壞', async () => {
  const env = setup()
  delete (env.io as any).resetTarget
  const final = await createRunner(env.io).start(input)
  assert.equal(final.phase, 'complete')
})

test('新賣場不繼承其他賣場的驗收狀態，仍須先跑一筆試轉', async () => {
  // 這是新增第二個賣場時最危險的地方：舊版把驗收狀態存成單一布林值，
  // 於是新賣場會直接開放批次 —— 而它的溫層、代收金額、運費都還沒有
  // 被任何一筆真實訂單驗證過，錯了就是整批寄錯。
  const second = 'GM2604107313905'
  const env = setup(), runner = createRunner(env.io)

  await runner.start(input)
  assert.equal(env.pilot(), true, '第一個賣場驗收通過')
  assert.equal(env.pilot(second), false, '第二個賣場不應被連帶標記為已驗收')

  // 第二個賣場一次選兩筆要被擋下來
  await assert.rejects(
    createRunner(setup().io).start({ ...input, marketplace_id: second, order_ids: [1, 2] }),
    /首次請選1筆/)
})

test('批次只接受屬於所選賣場的訂單', async () => {
  const env = setup()
  env.io.source = async (_job: any, command: string) =>
    command === 'context'
      ? { orders: [{ order_id: 1, reserved: false, errors: [], marketplace_id: 'GM9999999999999' }] } as any
      : {} as any
  await assert.rejects(createRunner(env.io).start(input), /訂單狀態或商品配對已變更/)
})

test('初次限制1筆、未知賣場及錯誤來源不能建立批次', async () => {
  for (const args of [{ ...input, order_ids: [1, 2] }, { ...input, marketplace_id: 'other' }, { ...input, source_url: 'https://evil.example/admin/myship' }]) {
    const env = setup(); await assert.rejects(createRunner(env.io).start(args)); assert.equal(env.calls.includes('create'), false)
  }
  assert.equal(isHealth('https://www.88ziyishequn.com.evil.example/admin/myship'), false)
})
test('部分成功仍保留任務，舊批次已人工處理後可結束而不再上傳', async () => {
  const env = setup(), source = env.io.source
  env.io.source = async (job, command) => command === 'apply' ? { confirmed: 0, unresolved: [{ order_no: 'test', reason: 'pending' }], complete: false } as any : source(job, command)
  const runner = createRunner(env.io); await runner.start(input)
  assert.equal(env.state().phase, 'attention'); assert.equal(env.pilot(), false)
  env.io.source = async (job, command) => command === 'status' ? { pending: 0, confirmed: 1, released: 0 } as any : source(job, command)
  await runner.recover(input)
  assert.equal(env.calls.filter(c => c === 'upload').length, 1)
  assert.equal(env.state().phase, 'complete')
  assert.equal(env.pilot(), true)
})

test('保留異常批次後可處理其他訂單，原保留訂單不能重傳', async () => {
  const env = setup(), originalSource = env.io.source
  env.io.waitResult = async () => { throw new Error('needs review') }
  const runner = createRunner(env.io); await assert.rejects(runner.start(input))
  env.io.source = async (job, command) => command === 'status' ? { total: 1, pending: 1, confirmed: 0, released: 0 } as any : command === 'context' ? { orders: [
    { order_id: 1, reserved: true, errors: [], marketplace_id: input.marketplace_id },
    { order_id: 2, reserved: false, errors: [], marketplace_id: input.marketplace_id },
  ] } as any : originalSource(job, command)
  await runner.pause(input)
  assert.equal(env.state().phase, 'paused'); assert.equal(env.pilot(), false)
  assert.equal(env.calls.filter(c => c === 'upload').length, 1)
  assert.equal(env.calls.includes('apply'), false)
  await assert.rejects(runner.start(input), /訂單狀態/)
  assert.equal(env.calls.filter(c => c === 'upload').length, 1)
  env.io.uuid = () => '00000000-0000-4000-8000-000000000002'
  env.io.waitResult = async () => 'result'
  await runner.start({ ...input, order_ids: [2] })
  assert.equal(env.calls.filter(c => c === 'upload').length, 2)
  assert.equal(env.state().phase, 'complete')
})

test('保留操作要求同源及完整伺服器批次紀錄，不能直接抹除不明任務', async () => {
  const env = setup(), runner = createRunner(env.io)
  env.io.waitResult = async () => { throw new Error('needs review') }
  await assert.rejects(runner.start(input))
  await assert.rejects(runner.pause({ ...input, source_url: 'https://healthec.vercel.app/admin/myship' }))
  await assert.rejects(runner.pause(input), /紀錄不完整/)
  assert.equal(env.state().phase, 'attention')
  assert.equal(env.calls.filter(c => c === 'upload').length, 1)
})

test('狀態同步以伺服器核對紀錄恢復批次資格，已結束的舊分頁任務自動完成', async () => {
  const env = setup(), source = env.io.source, runner = createRunner(env.io)
  env.io.waitResult = async () => { throw new Error('No tab with id: 123.') }
  await assert.rejects(runner.start(input))
  env.io.source = async (job, command) => command === 'eligibility' ? { pilot: true } as any : command === 'status' ? { total: 1, pending: 0, confirmed: 1, released: 0 } as any : source(job, command)
  await runner.sync({ ...input, source_tab: 99 })
  assert.equal(env.pilot(), true); assert.equal(env.state().phase, 'complete')
  assert.equal(env.state().source_tab, 99)
  assert.equal(env.calls.filter(c => c === 'upload').length, 1)
  assert.equal(env.calls.includes('apply'), false)
})

test('同步不憑匯出、解除保留或讀取失敗通過資格，也不隱藏未結束批次', async () => {
  const env = setup(), source = env.io.source, runner = createRunner(env.io)
  env.io.waitResult = async () => { throw new Error('needs review') }
  await assert.rejects(runner.start(input))
  env.io.source = async (job, command) => command === 'eligibility' ? { pilot: false } as any : command === 'status' ? { total: 1, pending: 1, confirmed: 0, released: 0 } as any : source(job, command)
  await runner.sync(input)
  assert.equal(env.pilot(), false); assert.equal(env.state().phase, 'attention')
  env.io.source = async () => { throw new Error('network') }
  await assert.rejects(runner.sync(input))
  assert.equal(env.pilot(), false); assert.equal(env.state().phase, 'attention')
})

test('正在處理的批次不受狀態輪詢覆寫', async () => {
  const env = setup(), runner = createRunner(env.io)
  let release: (value: string) => void = () => {}, waiting: () => void = () => {}
  const entered = new Promise<void>(resolve => { waiting = resolve })
  env.io.waitResult = async () => { waiting(); return new Promise<string>(resolve => { release = resolve }) }
  const running = runner.start(input); await entered
  await runner.sync(input)
  assert.equal(env.state().phase, 'upload_attempted'); assert.equal(env.pilot(), false)
  release('result'); await running
  assert.equal(env.state().phase, 'complete')
})
