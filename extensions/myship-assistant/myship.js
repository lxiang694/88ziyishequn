(() => {
  const MAX_BYTES = 2_000_000
  const normalized = value => (value || '').replace(/\s/g, '')
  const visible = node => !!(node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
  const label = node => normalized(node.textContent || node.value || node.getAttribute('aria-label'))
  const isSellerPage = () => location.origin === 'https://myship.7-11.com.tw' && (location.pathname.startsWith('/orderimport/') || location.pathname.startsWith('/seller/order/'))
  const resultControls = () => [...document.querySelectorAll('a,button,input[type=button],input[type=submit]')].filter(node => visible(node) && label(node) === '下載匯入結果')
  let attempted = false

  function preflight() {
    if (!isSellerPage()) throw new Error('目前不是賣貨便訂單工具頁面')
    const page = normalized(document.body.innerText)
    if (!page.includes('上傳並匯入檔案') || !page.includes('500') || !page.includes('請選擇檔案')) throw new Error('請開啟「訂單工具 → 訂單匯入」頁面')
    const inputs = [...document.querySelectorAll('input[type=file]')].filter(node => !node.disabled && (!node.accept || /xls/i.test(node.accept)))
    if (inputs.length !== 1) throw new Error('無法唯一識別Excel上傳欄位，已停止操作')
    if (inputs[0].files.length || resultControls().length || attempted) throw new Error('此頁已有檔案或匯入紀錄，請另開乾淨的訂單匯入頁')
    return inputs[0]
  }
  async function upload(message) {
    const input = preflight()
    if (typeof message.file !== 'string' || message.file.length > 2_666_668 || !/^[a-f0-9-]{36}$/i.test(message.batch_id || '')) throw new Error('助手檔案格式不符')
    const bytes = Uint8Array.from(atob(message.file), c => c.charCodeAt(0))
    if (!bytes.length || bytes.length > MAX_BYTES || bytes[0] !== 80 || bytes[1] !== 75) throw new Error('匯入檔超過限制或不是Excel檔案')
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], `myship-${message.batch_id}.xlsm`, { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' }))
    attempted = true
    input.files = transfer.files
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    // Wait for the site's file selection handler. Never activate a second submission.
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 300))
      if (resultControls().length) return { submitted: true }
      const controls = [...document.querySelectorAll('button,input[type=button],input[type=submit],a')].filter(node => visible(node) && label(node) === '匯入' && !node.disabled && node.getAttribute('aria-disabled') !== 'true')
      if (controls.length > 1) throw new Error('頁面有多個匯入按鈕，已停止；請核對原批次')
      if (controls.length === 1) { controls[0].click(); return { submitted: true } }
    }
    throw new Error('檔案已送入欄位，但未找到可用的「匯入」按鈕；請核對此頁，助手不會重傳')
  }
  async function readResult() {
    if (!isSellerPage()) throw new Error('請開啟本批賣貨便匯入結果')
    const controls = resultControls()
    if (!controls.length) return { reason: '賣貨便尚未顯示「下載匯入結果」' }
    if (controls.length !== 1) return { unsupported: true, reason: '此頁有多個結果，請先開啟本批結果明細' }
    let raw = controls[0].getAttribute('href')
    // The official result page binds #downloadResult to a GET download, not an href.
    // Its handler and route were verified from the supplied page source; never evaluate page scripts.
    const resultId = /^\/orderimport\/result\/(\d{16})\/?$/.exec(location.pathname)?.[1]
    if ((!raw || raw === '#' || /^javascript:/i.test(raw)) && controls[0].getAttribute('id') === 'downloadResult' && resultId) {
      raw = `/CPF2202/DL?id=${resultId}`
    }
    if (!raw || raw === '#' || /^javascript:/i.test(raw)) return { unsupported: true, reason: '此頁使用的結果下載方式仍需適配；可先在健康優選批次紀錄讀取結果檔' }
    const url = new URL(raw, location.href)
    if (url.origin !== location.origin || url.username || url.password || !['https:', 'blob:'].includes(url.protocol)) throw new Error('結果下載位置不符，已停止讀取')
    const response = await fetch(url.href, { credentials: 'same-origin', cache: 'no-store', redirect: 'error' })
    if (!response.ok || !response.body) throw new Error('賣貨便結果暫時無法下載，請稍後讀回')
    const reader = response.body.getReader(), chunks = []; let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if ((size += value.length) > MAX_BYTES) { await reader.cancel(); throw new Error('結果檔超過2 MB限制') }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    if (bytes[0] !== 80 || bytes[1] !== 75) throw new Error('下載內容不是Excel結果，請確認賣貨便登入仍有效')
    let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192))
    return { file: btoa(text) }
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.kind !== 'myship-call') return
    const action = message.command === 'preflight' ? async () => { preflight(); return { ready: true } }
      : message.command === 'upload' ? () => upload(message)
      : message.command === 'result' ? readResult : null
    if (!action) return
    action().then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message || '賣貨便頁面操作中斷' }))
    return true
  })
})()
