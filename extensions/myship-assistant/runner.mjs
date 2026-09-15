// 賣場代碼只做格式檢查，不寫死某一個賣場。
//
// 原本這裡是 export const MARKET = 'GM2601252733206'，於是助手會拒絕
// 處理任何其他賣場。新增第二個賣場時，光在資料庫加一筆是不夠的 ——
// 使用者會看到「請在健康優選選取指定賣場的待處理訂單」而不知道為什麼。
//
// 哪些賣場可用由伺服器決定（myship_marketplaces.enabled），助手只負責
// 確認格式正確、而且整批訂單屬於使用者選的那一個賣場。
export const MARKET_PATTERN = /^GM\d{6,20}$/
export const isMarket = id => typeof id === 'string' && MARKET_PATTERN.test(id)

export const HEALTH_ORIGINS = ['https://www.88ziyishequn.com', 'https://healthec.vercel.app']
export function isHealth(url) {
  try { const u = new URL(url); return HEALTH_ORIGINS.includes(u.origin) && /^\/admin\/myship\/?$/.test(u.pathname) } catch { return false }
}
export function validSelection(ids) {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= 500 && ids.every(n => Number.isSafeInteger(n) && n > 0) && new Set(ids).size === ids.length
}

/** The only upload call is after a fresh server reservation. Recovery cannot call upload. */
export function createRunner(io) {
  let active = false
  const finish = async (job, file) => {
    await io.save({ ...job, phase: 'checking', message: '正在核對匯入結果與原訂單' })
    const result = await io.source(job, 'apply', { batch_id: job.batch_id, file })
    // 舊版助手存下的 job 沒有 marketplace_id；那種情況寧可讓使用者再跑
    // 一次單筆驗收，也不要把驗收狀態記到錯的賣場上。
    if (result.complete && isMarket(job.marketplace_id)) await io.pilotPassed(job.marketplace_id)
    const final = { ...job, phase: result.complete ? 'complete' : 'attention', confirmed: result.confirmed,
      message: result.complete ? `已核對 ${result.confirmed} 筆，健康優選已更新出貨，賣貨便分頁已回到匯入頁` : `已核對 ${result.confirmed} 筆，${result.unresolved.length} 筆需要處理；請查看批次紀錄`,
      unresolved: result.unresolved }
    await io.save(final)
    // 全部成功才把分頁帶回匯入頁 —— 有未處理項目時那張結果頁還要看。
    //
    // 放在 save 之後，而且自己接住例外：訂單在上一步就已經回寫完成，
    // 導頁只是便利功能。不在這裡接的話，io 實作一旦丟出例外，
    // 使用者會看到「助手處理中斷」，以為整批沒成功而重跑一次。
    if (result.complete) { try { await io.resetTarget?.(job) } catch { /* 導頁失敗不影響結果 */ } }
    return final
  }
  const locked = async (action) => {
    if (active) throw new Error('助手正在處理，請等候這批完成')
    active = true
    try { return await action() } finally { active = false }
  }
  return {
    sync: async (input) => {
      // Status polling must never overwrite a running upload/recovery or its newer job.
      if (active) return
      return locked(async () => {
        if (!isHealth(input.source_url)) throw new Error('請從健康優選工作台同步狀態')
        // 驗收狀態按賣場各自記錄：新賣場不會繼承舊賣場的「已驗收」。
        if (isMarket(input.marketplace_id) && !await io.hasPilot(input.marketplace_id)) {
          const eligibility = await io.source(input, 'eligibility', { marketplace_id: input.marketplace_id })
          if (eligibility.pilot === true) await io.pilotPassed(input.marketplace_id)
        }
        const job = await io.load()
        if (!job || !['attention', 'paused'].includes(job.phase) || new URL(job.source_url).origin !== new URL(input.source_url).origin) return
        const current = { ...job, source_tab: input.source_tab, source_url: input.source_url }
        const state = await io.source(current, 'status', { batch_id: job.batch_id })
        if (state.total === job.count && state.pending === 0 && state.confirmed + state.released === state.total) {
          await io.save({ ...current, phase: 'complete', confirmed: state.confirmed, message: `已同步後台：${state.confirmed} 筆已出貨，${state.released} 筆已解除保留，可繼續其他訂單。` })
        }
      })
    },
    start: (input) => locked(async () => {
      if (!isHealth(input.source_url) || !isMarket(input.marketplace_id) || !validSelection(input.order_ids)) throw new Error('請在健康優選選取指定賣場的待處理訂單')
      const previous = await io.load()
      if (previous && !['complete', 'paused'].includes(previous.phase)) throw new Error('上一批尚未結束，請先讀回結果，或保留此批後繼續其他訂單')
      // 每個賣場各自要先跑過一筆試轉 —— 新賣場的溫層、代收金額、運費
      // 都還沒被真實訂單驗證過，直接批次錯了就是整批寄錯。
      if (!await io.hasPilot(input.marketplace_id) && input.order_ids.length !== 1) throw new Error('這個賣場首次請選1筆訂單驗收，成功後即可批次處理')
      const context = await io.source(input, 'context')
      for (const id of input.order_ids) {
        const order = context.orders.find(o => o.order_id === id)
        // 比對使用者選定的賣場，不是某個寫死的賣場
        if (!order || order.reserved || order.errors.length || order.marketplace_id !== input.marketplace_id) throw new Error('訂單狀態或商品配對已變更，請重新整理')
      }
      const target = await io.findTarget()
      let job = { source_tab: input.source_tab, source_url: input.source_url, target_tab: target.id, target_url: target.url,
        marketplace_id: input.marketplace_id,
        batch_id: io.uuid(), phase: 'preparing', started_at: io.now(), count: input.order_ids.length, message: '正在建立轉單批次' }
      await io.save(job)
      try {
        await io.source(job, 'create', { batch_id: job.batch_id, order_ids: input.order_ids })
        job = { ...job, phase: 'reserved', message: '批次已保留，正在產生匯入檔' }; await io.save(job)
        const file = await io.source(job, 'file', { batch_id: job.batch_id })
        // Persist before *any* file-input event, which some sites automatically submit.
        job = { ...job, phase: 'upload_attempted', message: '正在傳送到賣貨便並等候結果；中斷時不會重傳' }; await io.save(job)
        try { await io.target(job, 'upload', { batch_id: job.batch_id, file }) }
        catch (error) { if (!error.uncertain) throw error /* A navigation can lose the reply; only read results next. */ }
        const resultFile = await io.waitResult(job)
        return await finish(job, resultFile)
      } catch (error) {
        await io.save({ ...job, phase: 'attention', message: error.message || '作業中斷，批次仍保留；請讀回結果或到批次紀錄核對' })
        throw error
      }
    }),
    pause: (input) => locked(async () => {
      const job = await io.load()
      if (!job || !['attention', 'paused'].includes(job.phase)) throw new Error('只能保留已停止、需要核對的批次')
      if (!isHealth(input.source_url) || new URL(input.source_url).origin !== new URL(job.source_url).origin) throw new Error('請從原本的健康優選網址操作')
      const updated = { ...job, source_tab: input.source_tab, source_url: input.source_url }
      const state = await io.source(updated, 'status', { batch_id: job.batch_id })
      if (state.total !== job.count || state.pending + state.confirmed + state.released !== state.total) throw new Error('原批次紀錄不完整，尚未解除助手阻塞，請核對批次紀錄')
      // Server reservations remain active: these orders cannot be selected for another upload.
      const paused = { ...updated, phase: 'paused', message: '此批已保留在批次紀錄，可繼續其他訂單；尚未核對的訂單不會重新匯入。' }
      await io.save(paused)
      return paused
    }),
    recover: (input) => locked(async () => {
      const stored = await io.load()
      if (!stored) throw new Error('尚無助手批次')
      if (!isHealth(input.source_url) || new URL(input.source_url).origin !== new URL(stored.source_url).origin) throw new Error('請從原本的健康優選網址讀回結果')
      const job = { ...stored, source_tab: input.source_tab, source_url: input.source_url }
      const state = await io.source(job, 'status', { batch_id: job.batch_id })
      if (!state.pending) {
        if (state.confirmed === job.count && state.confirmed > 0 && state.released === 0 && isMarket(job.marketplace_id)) await io.pilotPassed(job.marketplace_id)
        const final = { ...job, phase: 'complete', message: `這批已結束：${state.confirmed} 筆已出貨，${state.released} 筆已解除保留`, confirmed: state.confirmed }
        await io.save(final); return final
      }
      try {
        const file = await io.waitResult(job)
        return await finish(job, file)
      } catch (error) {
        await io.save({ ...job, phase: 'attention', message: error.message || '尚未取得結果，原批次繼續保留' }); throw error
      }
    }),
  }
}
