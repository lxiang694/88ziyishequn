import './compat.js'
import { createRunner, isHealth, HEALTH_ORIGINS } from './runner.mjs'

const CHANNEL = 'health-myship-assistant-v1'
const MYSHIP_PAGES = ['https://myship.7-11.com.tw/orderimport/*', 'https://myship.7-11.com.tw/seller/order/*']
const isMyshipPage = value => {
  try {
    const url = new URL(value)
    return url.origin === 'https://myship.7-11.com.tw' && (url.pathname.startsWith('/orderimport/') || url.pathname.startsWith('/seller/order/'))
  } catch { return false }
}
const browserCall = globalThis.HealthMyshipCompat.call
const read = async key => (await browserCall(chrome.storage.local, 'get', key))[key]
const call = async (tab, kind, command, payload = {}) => {
  let answer
  try { answer = await browserCall(chrome.tabs, 'sendMessage', tab, { kind, command, ...payload }) }
  catch {
    const error = new Error(kind === 'myship-call' && command === 'preflight'
      ? '賣貨便分頁尚未連接助手，請在賣貨便頁面按 Ctrl＋F5 重新整理'
      : '頁面已切換或連線中斷，將只嘗試讀回結果')
    error.uncertain = true; throw error
  }
  if (!answer?.ok) throw new Error(answer?.error || '頁面連線中斷，請保持健康優選和賣貨便頁面開啟')
  return answer.data
}
const io = {
  load: () => read('job'), save: job => browserCall(chrome.storage.local, 'set', { job }),
  hasPilot: () => read('pilotPassed'), pilotPassed: () => browserCall(chrome.storage.local, 'set', { pilotPassed: true }),
  uuid: () => crypto.randomUUID(), now: () => new Date().toISOString(),
  source: async (job, command, data) => {
    const tab = await browserCall(chrome.tabs, 'get', job.source_tab)
    if (!isHealth(tab.url) || new URL(tab.url).origin !== new URL(job.source_url).origin) throw new Error('健康優選頁面已關閉或已切換網址')
    return call(job.source_tab, 'health-call', command, data)
  },
  target: async (job, command, data) => {
    let tab
    try { tab = await browserCall(chrome.tabs, 'get', job.target_tab) } catch { /* Closed tabs are recoverable only for read-only result retrieval. */ }
    if (!tab && command === 'result') {
      const candidates = (await browserCall(chrome.tabs, 'query', { url: MYSHIP_PAGES })).filter(candidate => {
        if (!isMyshipPage(candidate.url)) return false
        return /^\/orderimport\/result\/\d{16}\/?$/.test(new URL(candidate.url).pathname)
      })
      if (candidates.length !== 1) throw new Error(candidates.length ? '找到多個賣貨便結果頁，請只保留本批結果頁再讀回；也可保留此批繼續其他訂單' : '原賣貨便分頁已關閉。請開啟本批匯入結果再讀回，或按「保留此批，繼續其他訂單」')
      tab = candidates[0]
      job.target_tab = tab.id; job.target_url = tab.url
      // No upload is ever sent to a rediscovered tab. The server still matches the whole result to this batch.
    }
    if (!isMyshipPage(tab?.url)) throw new Error('請在原賣貨便分頁開啟本批的匯入結果，再讀回')
    return call(job.target_tab, 'myship-call', command, data)
  },
  findTarget: async () => {
    const tabs = await browserCall(chrome.tabs, 'query', { url: MYSHIP_PAGES })
    if (!tabs.length) throw new Error('未找到賣貨便匯入分頁，請在同一個比特瀏覽器環境開啟 https://myship.7-11.com.tw/orderimport/import')
    const found = [], rejected = []
    for (const tab of tabs) {
      try {
        const result = await call(tab.id, 'myship-call', 'preflight')
        if (result?.ready !== true) throw new Error('賣貨便頁面檢查回覆不完整，請重新整理賣貨便分頁')
        found.push(tab)
      } catch (error) { rejected.push(error.message || '賣貨便頁面檢查失敗') }
    }
    if (found.length > 1) throw new Error('找到多個匯入頁，請只保留本次使用的那一個')
    if (!found.length) throw new Error(`已找到賣貨便分頁，但尚未就緒：${[...new Set(rejected)].join('；')}`)
    return found[0]
  },
  waitResult: async job => {
    const deadline = Date.now() + 120000
    let reason = '賣貨便尚未顯示本批結果'
    while (Date.now() < deadline) {
      try {
        const result = await io.target(job, 'result')
        if (result.file) return result.file
        reason = result.reason || reason
        if (result.unsupported) throw new Error(reason)
      } catch (error) { if (!error.uncertain) throw error; reason = error.message }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    throw new Error(`${reason}。批次仍保留，請在賣貨便開啟本批結果後按「讀回上一批結果」`)
  },
}
const runner = createRunner(io)
async function handle(message, sender) {
  if (sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || sender.tab.id < 0) throw new Error('請在健康優選工作台的主分頁使用助手')
  const senderOrigin = new URL(sender.url).origin
  if (!HEALTH_ORIGINS.includes(senderOrigin) || (sender.origin && sender.origin !== senderOrigin)) throw new Error('助手僅接受健康優選工作台的連線')
  // SPA navigation can leave the message sender's original document URL unchanged.
  // Authorize the browser's current tab as well as the sender origin, never a payload URL alone.
  const tab = await browserCall(chrome.tabs, 'get', sender.tab.id)
  if (!isHealth(tab?.url) || new URL(tab.url).origin !== senderOrigin) throw new Error('請開啟健康優選「賣貨便工作台」後重新檢查連線')
  if (message.source_url && (!isHealth(message.source_url) || new URL(message.source_url).origin !== senderOrigin)) throw new Error('工作台網址已變更，請重新整理健康優選頁面')
  if (message.type === 'hello' || message.type === 'status') {
    try { await runner.sync({ source_tab: sender.tab.id, source_url: tab.url }) }
    catch { /* Preserve existing job and pilot on a transient server error; recovery remains available. */ }
    const [job, pilot] = await Promise.all([read('job'), read('pilotPassed')])
    return { version: chrome.runtime.getManifest().version, job: job || null, pilot: !!pilot }
  }
  const input = { source_tab: sender.tab.id, source_url: tab.url, order_ids: message.order_ids, marketplace_id: message.marketplace_id }
  return message.type === 'start' ? runner.start(input) : message.type === 'pause' ? runner.pause(input) : runner.recover(input)
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return
  if (message?.type === 'pulse' && sender.frameId === 0 && isMyshipPage(sender.url)) { respond({ ok: true }); return }
  if (!['hello', 'status', 'start', 'recover', 'pause'].includes(message?.type)) return
  // Accept the previous helper envelope until the user refreshes an existing page.
  if (message.channel && message.channel !== CHANNEL) return
  handle(message, sender).then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message || '助手背景程式處理失敗，請重新開啟此瀏覽器環境' }))
  return true
})
