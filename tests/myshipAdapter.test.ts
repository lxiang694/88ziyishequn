import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'

// A synthetic DOM fixture tests the adapter's controls. It does not drive a real browser.
async function harness(pageUrl = 'https://myship.7-11.com.tw/orderimport/import') {
  let listener: any, clicks = 0, downloads = 0, resultHref: string | null = 'https://myship.7-11.com.tw/result-fixture.xlsx', resultId: string | null = null
  const requests: { url: string; options: any }[] = []
  const input: any = { disabled: false, accept: '.xlsm,.xlsx', files: [], dispatchEvent() {} }
  const node = (text: string, extra = {}) => ({ textContent: text, disabled: false, getClientRects: () => [{}], getAttribute: () => null, ...extra })
  const result = node('下載匯入結果', { getAttribute: (name: string) => name === 'href' ? resultHref : name === 'id' ? resultId : null })
  let results: any[] = []
  let buttons = [node('匯入', { click: () => { clicks++; results = [result] } })]
  const context = {
    location: new URL(pageUrl),
    document: { body: { innerText: '上傳並匯入檔案 每次最多500筆 請選擇檔案' }, querySelectorAll: (selector: string) => selector === 'input[type=file]' ? [input] : [...buttons, ...results] },
    getComputedStyle: () => ({ visibility: 'visible' }), File, Event, URL, Uint8Array, atob, btoa,
    setTimeout: (fn: () => void) => setTimeout(fn, 0),
    DataTransfer: class { files: File[] = []; items = { add: (file: File) => this.files.push(file) } },
    fetch: async (url: string, options: any) => { downloads++; requests.push({ url, options }); return new Response(new Uint8Array([80, 75, 3, 4])) },
    chrome: { runtime: { id: 'fixture-extension', onMessage: { addListener(fn: any) { listener = fn } } } },
  }
  runInNewContext(await readFile(new URL('../extensions/myship-assistant/myship.js', import.meta.url), 'utf8'), context)
  return {
    call: (command: string) => new Promise<any>(resolve => listener({ kind: 'myship-call', command, batch_id: '00000000-0000-4000-8000-000000000001', file: btoa('PKfixture') }, { id: 'fixture-extension' }, resolve)),
    input, clicks: () => clicks, downloads: () => downloads,
    duplicateButtons: () => { buttons = [...buttons, buttons[0]] }, foreignResult: () => { results = [result]; resultHref = 'https://evil.example/file.xlsx' },
    resultButton: (id = 'downloadResult', href: string | null = null) => { results = [result]; resultId = id; resultHref = href }, requests,
  }
}
test('實際標籤的模擬頁面：傳檔、單次點擊與結果讀取；同頁不能重傳', async () => {
  const h = await harness()
  assert.equal((await h.call('preflight')).ok, true)
  assert.equal((await h.call('upload')).ok, true)
  assert.equal(h.clicks(), 1); assert.equal(h.input.files.length, 1)
  assert.match(h.input.files[0].name, /^myship-.*\.xlsm$/)
  assert.equal((await h.call('result')).ok, true); assert.equal(h.downloads(), 1)
  assert.equal((await h.call('upload')).ok, false); assert.equal(h.clicks(), 1)
})

test('官方結果按鈕使用結果頁編號讀取 GET 下載，不再次上傳或點擊', async () => {
  for (const href of [null, '#', 'javascript:void(0)']) {
    const h = await harness('https://myship.7-11.com.tw/orderimport/result/2601010000000001')
    h.resultButton('downloadResult', href)
    const reply = await h.call('result')
    assert.equal(reply.ok, true); assert.equal(reply.data.file, btoa(String.fromCharCode(80, 75, 3, 4)))
    assert.equal(h.requests[0].url, 'https://myship.7-11.com.tw/CPF2202/DL?id=2601010000000001')
    assert.equal(h.requests[0].options.credentials, 'same-origin')
    assert.equal(h.requests[0].options.redirect, 'error')
    assert.equal(h.clicks(), 0); assert.equal(h.input.files.length, 0)
  }
})

test('無連結按鈕只適配已確認的結果路徑和按鈕識別', async () => {
  for (const path of ['/orderimport/import', '/orderimport/result/123', '/orderimport/result/2601010000000001/extra', '/seller/order/DealWith']) {
    const h = await harness('https://myship.7-11.com.tw' + path); h.resultButton()
    assert.equal((await h.call('result')).data.unsupported, true); assert.equal(h.downloads(), 0)
  }
  const h = await harness('https://myship.7-11.com.tw/orderimport/result/2601010000000001'); h.resultButton('unknown')
  assert.equal((await h.call('result')).data.unsupported, true); assert.equal(h.downloads(), 0)
  h.resultButton('downloadResult', 'https://evil.example/file.xlsx')
  assert.equal((await h.call('result')).ok, false); assert.equal(h.downloads(), 0)
})
test('不覆蓋已選檔案、不點模糊按鈕、不讀外站結果', async () => {
  const existing = await harness(); existing.input.files = [new File(['old'], 'old.xlsm')]
  assert.equal((await existing.call('preflight')).ok, false)
  const ambiguous = await harness(); ambiguous.duplicateButtons()
  assert.equal((await ambiguous.call('upload')).ok, false); assert.equal(ambiguous.clicks(), 0)
  const foreign = await harness(); foreign.foreignResult()
  assert.equal((await foreign.call('result')).ok, false); assert.equal(foreign.downloads(), 0)
})

test('匯入頁支援實際網址與既有路徑，其他網域及非訂單頁不能操作', async () => {
  const legacy = await harness('https://myship.7-11.com.tw/seller/order/DealWith')
  assert.equal((await legacy.call('preflight')).ok, true)
  for (const url of ['https://evil.example/orderimport/import', 'https://myship.7-11.com.tw.evil.example/orderimport/import', 'https://myship.7-11.com.tw/orderimport-other/import', 'https://myship.7-11.com.tw/Member/Login']) {
    const h = await harness(url)
    assert.equal((await h.call('preflight')).ok, false)
    assert.equal((await h.call('upload')).ok, false)
    assert.equal(h.clicks(), 0); assert.equal(h.downloads(), 0)
  }
})
