export const MARKET = 'GM2601252733206'
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
    if (result.complete) await io.pilotPassed()
    const final = { ...job, phase: result.complete ? 'complete' : 'attention', confirmed: result.confirmed,
      message: result.complete ? `已核對 ${result.confirmed} 筆，健康優選已更新出貨` : `已核對 ${result.confirmed} 筆，${result.unresolved.length} 筆需要處理；請查看批次紀錄`,
      unresolved: result.unresolved }
    await io.save(final)
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
        if (!await io.hasPilot()) {
          const eligibility = await io.source(input, 'eligibility')
          if (eligibility.pilot === true) await io.pilotPassed()
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
      if (!isHealth(input.source_url) || input.marketplace_id !== MARKET || !validSelection(input.order_ids)) throw new Error('請在健康優選選取指定賣場的待處理訂單')
      const previous = await io.load()
      if (previous && !['complete', 'paused'].includes(previous.phase)) throw new Error('上一批尚未結束，請先讀回結果，或保留此批後繼續其他訂單')
      if (!await io.hasPilot() && input.order_ids.length !== 1) throw new Error('首次請選1筆訂單驗收，成功後即可批次處理')
      const context = await io.source(input, 'context')
      for (const id of input.order_ids) {
        const order = context.orders.find(o => o.order_id === id)
        if (!order || order.reserved || order.errors.length || order.marketplace_id !== MARKET) throw new Error('訂單狀態或商品配對已變更，請重新整理')
      }
      const target = await io.findTarget()
      let job = { source_tab: input.source_tab, source_url: input.source_url, target_tab: target.id, target_url: target.url,
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
        if (state.confirmed === job.count && state.confirmed > 0 && state.released === 0) await io.pilotPassed()
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
