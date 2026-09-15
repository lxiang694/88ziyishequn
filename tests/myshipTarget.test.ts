import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import { HEALTH_ORIGINS, isHealth } from '../extensions/myship-assistant/runner.mjs'

const root = new URL('../extensions/myship-assistant/', import.meta.url)
const importUrl = 'https://myship.7-11.com.tw/orderimport/import'
const matches = (pattern: string, url: string) => url.startsWith(pattern.replace(/\*$/, ''))

// The browser fixture filters tabs like Chrome. No live tabs, uploads or orders are accessed.
async function harness(tabs: { id: number; url: string }[] = [{ id: 7, url: importUrl }], answers: Record<number, any> = {}) {
  let io: any
  const calls: any[] = []
  const runtime: any = { id: 'fixture-extension', onMessage: { addListener() {} } }
  const context = createContext({
    URL, crypto, setTimeout, HEALTH_ORIGINS, isHealth,
    createRunner: (adapter: any) => { io = adapter; return {} },
    chrome: { runtime, storage: { local: {} }, tabs: {
      query: (query: any, cb: any) => queueMicrotask(() => {
        const patterns = Array.isArray(query.url) ? query.url : [query.url]
        cb(tabs.filter(tab => patterns.some((pattern: string) => matches(pattern, tab.url))))
      }),
      get: (id: number, cb: any) => queueMicrotask(() => cb(tabs.find(tab => tab.id === id))),
      sendMessage: (id: number, message: any, cb: any) => queueMicrotask(() => {
        calls.push({ id, command: message.command })
        const answer = answers[id] ?? { ok: true, data: { ready: true, file: 'fixture' } }
        if (answer.runtimeError) runtime.lastError = { message: answer.runtimeError }
        cb(answer.runtimeError ? undefined : answer); delete runtime.lastError
      }),
    } },
  })
  runInContext(await readFile(new URL('compat.js', root), 'utf8'), context)
  runInContext((await readFile(new URL('worker.mjs', root), 'utf8')).replace(/^import .*$/gm, ''), context)
  return { find: () => io.findTarget(), target: (id: number, command = 'result') => io.target({ target_tab: id }, command), calls }
}

test('能找到使用者提供的 /orderimport/import，檢查過程只讀取頁面狀態', async () => {
  const h = await harness(), tab = await h.find()
  assert.equal(tab.url, importUrl); assert.equal(tab.id, 7)
  assert.deepEqual(h.calls, [{ id: 7, command: 'preflight' }])
})

test('匯入及同一路徑下的結果頁可讀回，仍拒絕外站及非訂單頁', async () => {
  const tabs = [
    { id: 7, url: importUrl }, { id: 8, url: 'https://myship.7-11.com.tw/orderimport/result?id=fixture' },
    { id: 9, url: 'https://myship.7-11.com.tw/seller/order/DealWith' },
    { id: 10, url: 'https://evil.example/orderimport/import' }, { id: 11, url: 'https://myship.7-11.com.tw/Member/Login' },
  ]
  const h = await harness(tabs)
  for (const id of [7, 8, 9]) assert.equal((await h.target(id)).file, 'fixture')
  for (const id of [10, 11]) await assert.rejects(h.target(id))
  assert.equal(h.calls.length, 3)
})

test('頁面已選檔或上傳欄位不明確時保留具體原因，不再誤報沒有開啟分頁', async () => {
  for (const reason of ['此頁已有檔案或匯入紀錄，請另開乾淨的訂單匯入頁', '無法唯一識別Excel上傳欄位，已停止操作']) {
    const h = await harness(undefined, { 7: { ok: false, error: reason } })
    await assert.rejects(h.find(), error => (error as Error).message.includes(reason))
    assert.equal(h.calls.every(call => call.command === 'preflight'), true)
  }
})

test('賣貨便腳本尚未載入時提示重新整理該分頁', async () => {
  const h = await harness(undefined, { 7: { runtimeError: 'Could not establish connection. Receiving end does not exist.' } })
  await assert.rejects(h.find(), /賣貨便.*重新整理|重新整理.*賣貨便/)
})

test('找不到分頁時提供正確入口，多個可用分頁仍拒絕任選一個', async () => {
  await assert.rejects((await harness([])).find(), /orderimport\/import/)
  await assert.rejects((await harness([{ id: 7, url: importUrl }, { id: 8, url: importUrl }])).find(), /多個/)
})

test('安裝設定會在真正匯入頁載入腳本，權限保持指定三個網站', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'))
  const entry = manifest.content_scripts.find((script: any) => script.js.includes('myship.js'))
  assert.equal(entry.matches.some((pattern: string) => matches(pattern, importUrl)), true)
  assert.deepEqual(manifest.permissions, ['storage'])
  assert.deepEqual(manifest.host_permissions, ['https://www.88ziyishequn.com/*', 'https://healthec.vercel.app/*', 'https://myship.7-11.com.tw/*'])
})

test('原分頁消失後僅可重新尋找唯一結果頁讀取，絕不重定向上傳', async () => {
  const h = await harness([{ id: 88, url: 'https://myship.7-11.com.tw/orderimport/result/2601010000000001' }])
  assert.equal((await h.target(123)).file, 'fixture')
  assert.deepEqual(h.calls, [{ id: 88, command: 'result' }])
  await assert.rejects(h.target(123, 'upload'))
  assert.equal(h.calls.length, 1)
})

test('舊分頁消失且結果頁缺少或不唯一時顯示可操作提示', async () => {
  await assert.rejects((await harness([])).target(123), /分頁已關閉/)
  await assert.rejects((await harness([{ id: 1, url: importUrl }])).target(123), /分頁已關閉/)
  await assert.rejects((await harness([1, 2].map(id => ({ id, url: `https://myship.7-11.com.tw/orderimport/result/260101000000000${id}` })))).target(123), /多個/)
})
