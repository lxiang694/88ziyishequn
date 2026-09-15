import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import { HEALTH_ORIGINS, isHealth, isMarket, createRunner } from '../extensions/myship-assistant/runner.mjs'
import { parseAssistantStatus } from '@/lib/myship/assistantProtocol'

const root = new URL('../extensions/myship-assistant/', import.meta.url)
const channel = 'health-myship-assistant-v1'
const currentUrl = 'https://www.88ziyishequn.com/admin/myship'
const ownSender = { id: 'fixture-extension', frameId: 0, tab: { id: 3 }, url: currentUrl, origin: new URL(currentUrl).origin }
const compat = () => readFile(new URL('compat.js', root), 'utf8')

// Callback-only fixtures also model older Chromium extension APIs. No browser or order is accessed.
const fixtureMarket = 'GM2601252733206'

async function workerHarness(server?: { pilot: boolean; job: any; batch: any }) {
  // 驗收狀態按賣場存，key 是 `pilotPassed:<賣場代碼>`
  const stored: any = server ? { job: server.job, [`pilotPassed:${fixtureMarket}`]: false } : {}
  let listener: any, reads = 0, starts = 0, tabUrl = currentUrl, tabError = ''
  const runtime: any = { id: ownSender.id, getManifest: () => ({ version: '0.2.1' }), onMessage: { addListener(fn: any) { listener = fn } } }
  const context = createContext({
    URL, crypto, setTimeout, HEALTH_ORIGINS, isHealth, isMarket,
    createRunner: server ? createRunner : () => ({ start: async (input: any) => { starts++; return input }, recover: async (input: any) => input }),
    chrome: { runtime, storage: { local: {
      get: (key: string, cb: any) => { reads++; queueMicrotask(() => cb?.({ [key]: stored[key] })) },
      set: (data: any, cb: any) => { Object.assign(stored, data); queueMicrotask(() => cb?.()) },
    } }, tabs: { sendMessage: (_id: number, message: any, cb: any) => queueMicrotask(() => cb({ ok: true, data: message.command === 'eligibility' ? { pilot: server?.pilot } : server?.batch })), get: (_id: number, cb: any) => queueMicrotask(() => {
      if (tabError) runtime.lastError = { message: tabError }
      cb?.({ id: 3, url: tabUrl }); delete runtime.lastError
    }) } },
  })
  runInContext(await compat(), context)
  runInContext((await readFile(new URL('worker.mjs', root), 'utf8')).replace(/^import .*$/gm, ''), context)
  return {
    call: (sender = ownSender, message: any = {}) => new Promise<any>(resolve => {
      const async = listener({ channel, type: 'status', source_url: currentUrl, ...message }, sender, resolve)
      if (async !== true) resolve(undefined)
    }),
    move: (url: string) => { tabUrl = url }, failTab: () => { tabError = 'No tab with id: 3.' },
    reads: () => reads, starts: () => starts,
  }
}

test('連線採用目前分頁網址：從儀表板切到工作台，舊文件網址仍能回覆', async () => {
  const h = await workerHarness()
  const answer = await h.call({ ...ownSender, url: 'https://www.88ziyishequn.com/admin/dashboard' })
  assert.equal(answer?.ok, true)
  assert.equal(answer.data.version, '0.2.1'); assert.equal(answer.data.pilot, false)
  assert.equal(h.starts(), 0)
})

test('只提供 callback 的瀏覽器介面仍能取得助手狀態', async () => {
  const h = await workerHarness(), answer = await h.call(ownSender, { marketplace_id: fixtureMarket })
  // 兩次讀取：job 與該賣場的驗收狀態
  assert.equal(answer?.ok, true); assert.equal(answer.data.job, null); assert.equal(h.reads(), 2)
})

test('沒有指定賣場時一律回報未驗收，不會沿用其他賣場的驗收狀態', async () => {
  // 舊版工作台不會帶 marketplace_id。那種情況寧可讓使用者再跑一次
  // 單筆試轉，也不要讓新賣場直接放行批次。
  const h = await workerHarness()
  const answer = await h.call()
  assert.equal(answer?.ok, true); assert.equal(answer.data.pilot, false)
  // 只讀 job，不去猜某個賣場的驗收狀態
  assert.equal(h.reads(), 1)
})

test('不信任訊息內的網址：外站、子框架、其他擴展或已離開工作台都不能讀取狀態或發起轉單', async () => {
  const cases = [
    { sender: { ...ownSender, id: 'another-extension' }, tabUrl: currentUrl },
    { sender: { ...ownSender, frameId: 1 }, tabUrl: currentUrl },
    { sender: { ...ownSender, url: 'https://evil.example/admin/myship', origin: 'https://evil.example' }, tabUrl: currentUrl },
    { sender: ownSender, tabUrl: 'https://evil.example/admin/myship' },
    { sender: ownSender, tabUrl: 'https://www.88ziyishequn.com/admin/orders' },
    { sender: ownSender, tabUrl: 'https://healthec.vercel.app/admin/myship' },
  ]
  for (const c of cases) {
    const h = await workerHarness(); h.move(c.tabUrl)
    assert.notEqual((await h.call(c.sender, { type: 'start' }))?.ok, true)
    assert.equal(h.reads(), 0); assert.equal(h.starts(), 0)
  }
})

test('分頁已關閉時傳回明確錯誤，不留下無回覆的訊息', async () => {
  const h = await workerHarness(); h.failTab()
  const answer = await h.call()
  assert.equal(answer?.ok, false); assert.match(answer.error, /No tab|分頁/)
  assert.equal(h.reads(), 0)
})

async function healthHarness(answer?: any, runtimeError = '') {
  let pageListener: any, sent: any, response: any
  const runtime: any = { id: ownSender.id, onMessage: { addListener() {} }, sendMessage: (message: any, cb: any) => {
    sent = message
    queueMicrotask(() => {
      if (runtimeError) runtime.lastError = { message: runtimeError }
      cb?.(answer); delete runtime.lastError
    })
  } }
  const window = { addEventListener: (_event: string, fn: any) => { pageListener = fn }, postMessage: (m: any) => { response = m } }
  const context = createContext({ window, location: new URL(currentUrl), chrome: { runtime }, Uint8Array, atob, btoa })
  runInContext(await compat(), context)
  runInContext(await readFile(new URL('health.js', root), 'utf8'), context)
  pageListener({ source: window, origin: new URL(currentUrl).origin, data: { channel, direction: 'request', type: 'hello', id: '00000000-0000-4000-8000-000000000001' } })
  await new Promise(resolve => setImmediate(resolve))
  return { sent, response }
}

test('頁面橋接使用 callback 並攜帶目前網址；空白回覆顯示背景連線診斷', async () => {
  const good = await healthHarness({ ok: true, data: { version: '0.2.1', job: null, pilot: false } })
  assert.equal(good.sent.source_url, currentUrl); assert.equal(good.sent.channel, channel)
  assert.equal(good.response.ok, true)
  const empty = await healthHarness()
  assert.equal(empty.response.ok, false); assert.match(empty.response.error, /背景.*回覆/)
})

test('Chrome lastError 和失效的擴展回報可操作的訊息', async () => {
  const h = await healthHarness(undefined, 'Extension context invalidated.')
  assert.equal(h.response.ok, false); assert.match(h.response.error, /重新整理|重新開啟/)
})

test('空白或格式不完整的狀態不能讓後台啟用轉單按鈕', () => {
  for (const invalid of [undefined, {}, { version: '0.2.1' }, { version: '0.2.1', pilot: true }, { version: '0.2.1', pilot: false, job: {} }]) {
    assert.throws(() => parseAssistantStatus(invalid), /回覆不完整/)
  }
  const valid = { version: '0.2.1', pilot: false, job: { batch_id: 'fixture-batch', phase: 'attention', message: '等待結果' } }
  assert.deepEqual(parseAssistantStatus(valid), valid)
})

test('完整背景訊息鏈：重開瀏覽器後從目前健康優選分頁取得後台資格和舊批完成狀態', async () => {
  const h = await workerHarness({ pilot: true, job: { phase: 'attention', message: 'No tab with id: 123.', source_url: currentUrl, source_tab: 456, target_tab: 123, count: 1, batch_id: '00000000-0000-4000-8000-000000000001' }, batch: { total: 1, pending: 0, confirmed: 1, released: 0 } })
  const reply = await h.call(ownSender, { marketplace_id: fixtureMarket })
  assert.equal(reply.ok, true); assert.equal(reply.data.pilot, true)
  assert.equal(reply.data.job.phase, 'complete'); assert.equal(reply.data.job.source_tab, 3)
  assert.doesNotMatch(reply.data.job.message, /No tab/)
})
