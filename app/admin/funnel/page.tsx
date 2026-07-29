'use client'
import { useState, useEffect } from 'react'

interface Stage { key: string; label: string; visitors: number; fromOrders?: boolean }
interface Fail { reason: string; label: string; count: number }

const RANGES = [
  { key: 'today', label: '今日' },
  { key: '7days', label: '近 7 天' },
  { key: '30days', label: '近 30 天' },
  { key: 'month', label: '本月' },
]

const STAGE_ICONS: Record<string, string> = {
  view_product: '👀', add_to_cart: '🛒', checkout_start: '📝', submit_click: '👆', order_success: '✅',
}

export default function FunnelPage() {
  const [dateRange, setDateRange] = useState('7days')
  const [stages, setStages] = useState<Stage[]>([])
  const [fails, setFails] = useState<Fail[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true); setError('')
    fetch('/api/admin/funnel?dateRange=' + dateRange)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setStages(d.data.stages || [])
          setFails(d.data.fails || [])
          setTableMissing(!!d.data.funnel_table_missing)
        } else setError(d.error || '查詢失敗')
        setLoading(false)
      })
      .catch(() => { setError('網路錯誤'); setLoading(false) })
  }, [dateRange])

  const top = stages[0]?.visitors || 0
  const pct = (v: number) => (top > 0 ? Math.round((v / top) * 100) : 0)
  // 相鄰步驟轉換率
  const stepConv = (i: number) => {
    if (i === 0) return null
    const prev = stages[i - 1]?.visitors || 0
    const cur = stages[i]?.visitors || 0
    if (prev === 0) return null
    return Math.round((cur / prev) * 100)
  }

  const totalConv = stages.length >= 2 && stages[0].visitors > 0
    ? ((stages[stages.length - 1].visitors / stages[0].visitors) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">🔻 下單漏斗</h1>
          <p className="text-gray-500 text-sm mt-0.5">看清楚顧客從「看商品」到「下單成功」在哪一步流失</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setDateRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${dateRange === r.key ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">
          ⚠️ 尚未建立漏斗資料表，「加入購物車 / 點擊送出 / 下單成功」暫時為 0。請在 Supabase SQL Editor 執行
          <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded">migrations/funnel_events_schema.sql</code>
          後即會開始累積資料。
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">載入中...</div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-red-500">{error}</div>
      ) : (
        <>
          {/* 總轉換率 */}
          <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl p-5 mb-4 text-white">
            <p className="text-sm font-semibold text-green-50">整體轉換率（瀏覽商品 → 下單成功）</p>
            <p className="text-4xl font-bold mt-1">{totalConv}<span className="text-2xl">%</span></p>
            <p className="text-green-50 text-xs mt-1">
              {stages[0]?.visitors || 0} 位看商品的訪客，期間共 {stages[stages.length - 1]?.visitors || 0} 筆實際訂單
            </p>
          </div>

          {/* 漏斗各階段 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
            <div className="space-y-3">
              {stages.map((s, i) => {
                const conv = stepConv(i)
                const dropped = i > 0 ? (stages[i - 1].visitors - s.visitors) : 0
                return (
                  <div key={s.key}>
                    {i > 0 && (
                      <div className="flex items-center justify-center py-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conv !== null && conv < 50 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                          ↓ 轉換 {conv === null ? '—' : conv + '%'}
                          {dropped > 0 && conv !== null && <span className="ml-1">（流失 {dropped} 人）</span>}
                        </span>
                      </div>
                    )}
                    <div className="relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500/20 to-green-400/10"
                        style={{ width: `${Math.max(pct(s.visitors), s.visitors > 0 ? 6 : 0)}%` }} />
                      <div className="relative flex items-center justify-between px-4 py-3">
                        <span className="font-bold text-gray-800 flex items-center gap-2">
                          <span>{STAGE_ICONS[s.key]}</span>{s.label}
                          {s.fromOrders && <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">實際訂單</span>}
                        </span>
                        <span className="font-bold text-gray-900 text-lg">
                          {s.visitors}<span className="text-xs font-normal text-gray-400 ml-1">{s.fromOrders ? '筆' : '人'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-gray-400 text-[11px] mt-3 leading-relaxed">
              📌「瀏覽商品 / 進入結帳」來自伺服器瀏覽紀錄、「下單成功」直接讀真實訂單表（最準）；
              「加入購物車 / 點擊送出」為瀏覽器埋點，屬盡力而為的估計，且僅統計功能上線後的資料，
              因此中間兩步可能略少於實際，剛上線初期數字會逐步補齊。
            </p>
          </div>

          {/* 送出失敗原因 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-1">送出失敗原因分佈</h2>
            <p className="text-gray-400 text-xs mb-3">顧客按了「確認下單」卻沒成功的原因（次數）</p>
            {fails.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">此期間沒有送出失敗紀錄 🎉</p>
            ) : (
              <div className="space-y-2">
                {fails.map(f => (
                  <div key={f.reason} className="flex items-center justify-between text-sm">
                    <span className={`font-semibold ${f.reason === 'api' || f.reason === 'network' ? 'text-red-600' : 'text-gray-700'}`}>
                      {f.reason === 'api' || f.reason === 'network' ? '⚠️ ' : ''}{f.label}
                    </span>
                    <span className="font-bold text-gray-800">{f.count} 次</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-gray-400 text-[11px] mt-3 leading-relaxed">
              💡「未選門市 / 姓名未填」多屬正常操作提醒；若「系統/庫存錯誤」「網路錯誤」偏高，代表可能有技術問題需要處理。
            </p>
          </div>
        </>
      )}
    </div>
  )
}
