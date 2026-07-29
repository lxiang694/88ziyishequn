// 下單漏斗前台埋點：在關鍵節點呼叫，失敗不影響頁面。
export type FunnelEvent = 'add_to_cart' | 'submit_click' | 'submit_fail' | 'order_success'

export function trackFunnel(event: FunnelEvent, meta?: Record<string, unknown>) {
  try {
    fetch('/api/track/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        meta: meta || null,
        path: typeof location !== 'undefined' ? location.pathname : '',
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // 埋點不應影響使用者體驗
  }
}
