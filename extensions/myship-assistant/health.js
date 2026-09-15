(() => {
  const CHANNEL = 'health-myship-assistant-v1'
  const batchValid = id => /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)
  const to64 = bytes => { let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(text) }
  const from64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0))
  const isPage = () => /^\/admin\/myship\/?$/.test(location.pathname)
  const responseData = async response => {
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || `健康優選回應失敗（${response.status}）`)
    return result
  }
  async function execute(message) {
    if (!isPage()) throw new Error('請保持健康優選賣貨便工作台開啟')
    const { command, batch_id: batch } = message
    if (command === 'context') return responseData(await fetch('/api/admin/myship', { cache: 'no-store' }))
    if (command === 'eligibility') {
      // 驗收狀態按賣場查，不能不帶賣場就問「有沒有驗收過」
      if (!/^GM\d{6,20}$/.test(message.marketplace_id || '')) throw new Error('缺少有效的賣場代碼')
      return responseData(await fetch(`/api/admin/myship/eligibility?marketplace_id=${encodeURIComponent(message.marketplace_id)}`, { cache: 'no-store' }))
    }
    if (!batchValid(batch)) throw new Error('批次編號錯誤')
    if (command === 'create') return responseData(await fetch('/api/admin/myship/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch_id: batch, order_ids: message.order_ids }) }))
    if (command === 'status') return responseData(await fetch(`/api/admin/myship/batches/${batch}/status`, { cache: 'no-store' }))
    if (command === 'file') {
      const response = await fetch(`/api/admin/myship/batches/${batch}`, { cache: 'no-store' })
      if (!response.ok) return responseData(response)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length > 2_000_000) throw new Error('匯入檔超過2 MB')
      return to64(bytes)
    }
    if (command === 'apply') {
      if (typeof message.file !== 'string' || message.file.length > 2_666_668) throw new Error('結果檔過大或格式錯誤')
      return responseData(await fetch(`/api/admin/myship/results?batch_id=${batch}&apply=true`, { method: 'POST', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: from64(message.file) }))
    }
    throw new Error('不支援的助手操作')
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.kind !== 'health-call') return
    execute(message).then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }))
    return true
  })
  window.addEventListener('message', event => {
    const m = event.data
    if (!isPage() || event.source !== window || event.origin !== location.origin || m?.channel !== CHANNEL || m.direction !== 'request' || !/^[a-f0-9-]{36}$/i.test(m.id || '') || !['hello', 'status', 'start', 'recover', 'pause'].includes(m.type)) return
    const reply = result => window.postMessage({ channel: CHANNEL, direction: 'response', id: m.id, ...result }, location.origin)
    globalThis.HealthMyshipCompat.call(chrome.runtime, 'sendMessage', { channel: CHANNEL, type: m.type, source_url: location.href, order_ids: m.order_ids, marketplace_id: m.marketplace_id }).then(
      answer => {
        if (!answer || typeof answer.ok !== 'boolean') {
          reply({ ok: false, error: '助手已載入，但背景程式沒有有效回覆。請更新助手並重新開啟此比特瀏覽器環境，再重新整理健康優選頁面。' })
          return
        }
        reply(answer.ok ? { ok: true, data: answer.data } : { ok: false, error: answer.error || '助手背景程式回報失敗，請重新開啟此瀏覽器環境' })
      },
      () => reply({ ok: false, error: '助手背景連線已中斷或擴展已更新。請重新整理健康優選頁面；若仍失敗，請重新開啟此比特瀏覽器環境。' }))
  })
})()
