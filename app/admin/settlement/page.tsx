'use client'
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'

interface Summary {
  total_bookings: number; completed: number; cancelled: number
  in_progress: number; pending: number
  revenue: number; cost: number; profit: number; margin: number
  avg_order: number; unsettled_total: number
}
interface PlanRow { name: string; count: number; revenue: number }
interface CountyRow { county: string; count: number }
interface CompanionRow {
  id: number; name: string; phone: string; jobs: number; revenue: number; fee: number
  unsettled_jobs: number; unsettled_fee: number
}
interface UnsettledRow {
  id: number; booking_no: string; service_date: string; service_name: string
  patient_name: string; hospital: string; county: string
  price: number; extra_fee: number; addon_fee: number
  companion_fee: number; addon_companion_fee: number
  companion_id: number; companion_name: string
}

const RANGES = [
  { key: 'today', label: '今日' },
  { key: '7days', label: '近 7 天' },
  { key: '30days', label: '近 30 天' },
  { key: 'month', label: '本月' },
  { key: 'all', label: '全部期間' },
]

export default function CareSettlementPage() {
  const [tab, setTab] = useState<'report' | 'payout'>('report')
  const [dateRange, setDateRange] = useState('30days')
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [byPlan, setByPlan] = useState<PlanRow[]>([])
  const [byCounty, setByCounty] = useState<CountyRow[]>([])
  const [byCompanion, setByCompanion] = useState<CompanionRow[]>([])
  const [unsettled, setUnsettled] = useState<UnsettledRow[]>([])
  const [picked, setPicked] = useState<number[]>([])
  const [filterCompanion, setFilterCompanion] = useState<number | ''>('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    fetch('/api/admin/care/settlement?dateRange=' + dateRange)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSummary(d.data.summary)
          setByPlan(d.data.by_plan)
          setByCounty(d.data.by_county)
          setByCompanion(d.data.by_companion)
          setUnsettled(d.data.unsettled)
          setTableMissing(!!d.table_missing)
          setPicked([])
        } else { setError(d.error || '載入失敗'); toast.error(d.error || '載入失敗') }
        setLoading(false)
      })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [dateRange])
  useEffect(() => { load() }, [load])

  const shown = filterCompanion ? unsettled.filter(u => u.companion_id === filterCompanion) : unsettled
  // 待結算清單不受期間篩選，篩選選項也要從清單本身產生，
  // 否則服務日期落在期間外的陪診員會選不到
  const payoutCompanions = [...unsettled.reduce((m, u) => {
    const cur = m.get(u.companion_id) || { id: u.companion_id, name: u.companion_name || `#${u.companion_id}`, fee: 0 }
    cur.fee += u.companion_fee + u.addon_companion_fee
    m.set(u.companion_id, cur)
    return m
  }, new Map<number, { id: number; name: string; fee: number }>()).values()]
  const pickedRows = unsettled.filter(u => picked.includes(u.id))
  const pickedTotal = pickedRows.reduce((s, r) => s + r.companion_fee + r.addon_companion_fee, 0)

  const toggle = (id: number) =>
    setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))
  const toggleAll = () =>
    setPicked(p => (p.length === shown.length ? [] : shown.map(r => r.id)))

  const settle = async () => {
    if (picked.length === 0) return toast.error('請先勾選要結算的項目')
    if (!confirm(`確定將 ${picked.length} 筆標記為已結算？\n應付金額合計 ${formatPrice(pickedTotal)}`)) return
    const res = await fetch('/api/admin/care/settlement', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'settle', ids: picked }),
    })
    const d = await res.json()
    if (d.success) { toast.success(`已結算 ${d.count} 筆`); load() } else toast.error(d.error || '結算失敗')
  }

  const updateFee = async (id: number, field: 'companion_fee' | 'extra_fee', value: string) => {
    const res = await fetch('/api/admin/care/settlement', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: Number(value) || 0 }),
    })
    const d = await res.json()
    if (d.success) { toast.success('已更新'); load() } else toast.error(d.error || '更新失敗')
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">💰 陪診結算與報表</h1>
          <p className="text-gray-600 text-sm mt-0.5">依「服務日期」統計；營收與成本僅計算「已完成」的預約</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setDateRange(r.key)}
              className={`px-3 py-2 min-h-[48px] rounded-xl text-[15px] font-semibold transition-colors ${dateRange === r.key ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">
          ⚠️ 尚未建立結算欄位，請在 Supabase SQL Editor 執行
          <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded">migrations/companion_settlement.sql</code>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-5">
        {([['report', '📊 服務報表'], ['payout', '💵 收入結算']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`min-h-[48px] rounded-xl font-bold text-base border-2 transition-colors ${tab === k ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-700 border-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-600">載入中…</div>
      ) : error ? (
        <div className="card p-8 text-center">
          <p className="text-red-600 font-bold text-lg mb-2">⚠️ {error}</p>
          <p className="text-gray-700 text-[15px] leading-relaxed">
            若訊息提到欄位或資料表不存在，請先到 Supabase SQL Editor 依序執行：
            <br />
            <code className="px-1.5 py-0.5 bg-gray-100 rounded">companion_care_schema.sql</code>
            {' → '}
            <code className="px-1.5 py-0.5 bg-gray-100 rounded">companion_settlement.sql</code>
            {' → '}
            <code className="px-1.5 py-0.5 bg-gray-100 rounded">companion_pickup_addons.sql</code>
          </p>
          <button onClick={load} className="btn-secondary mt-4">重新載入</button>
        </div>
      ) : !summary ? (
        <div className="card p-10 text-center text-gray-600">沒有資料</div>
      ) : tab === 'report' ? (
        <>
          {summary.total_bookings === 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 mb-4">
              <p className="font-bold text-amber-900 text-base mb-1">此期間沒有任何陪診預約</p>
              <p className="text-amber-900 text-[15px] leading-relaxed">
                報表是以<strong>服務日期</strong>統計的（不是預約建立日期）。
                如果測試單的服務日期排在未來，請改選「<strong>全部期間</strong>」就會出現。
              </p>
            </div>
          )}
          {summary.total_bookings > 0 && summary.completed === 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 mb-4">
              <p className="font-bold text-amber-900 text-base mb-1">
                此期間有 {summary.total_bookings} 筆預約，但沒有「已完成」的
              </p>
              <p className="text-amber-900 text-[15px] leading-relaxed">
                營收、成本與結算<strong>只計算狀態為「已完成」</strong>的預約。
                請到「🩺 陪診預約」把該筆狀態改為<strong>已完成</strong>，或由陪診員在工單按「服務完成」。
              </p>
            </div>
          )}

          {/* 財務總覽 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl p-5 text-white">
              <p className="text-green-50 text-sm font-semibold">營業收入</p>
              <p className="text-3xl font-bold mt-1">{formatPrice(summary.revenue)}</p>
              <p className="text-green-50 text-[13px] mt-1">已完成 {summary.completed} 場</p>
            </div>
            <div className="card p-5">
              <p className="text-gray-600 text-sm font-semibold">陪診員報酬（成本）</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{formatPrice(summary.cost)}</p>
              <p className="text-gray-600 text-[13px] mt-1">未結算（全部期間）{formatPrice(summary.unsettled_total)}</p>
            </div>
            <div className="card p-5">
              <p className="text-gray-600 text-sm font-semibold">毛利</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{formatPrice(summary.profit)}</p>
              <p className="text-gray-600 text-[13px] mt-1">毛利率 {summary.margin}%</p>
            </div>
          </div>

          {/* 營運指標 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
            {[
              { l: '總預約', v: summary.total_bookings },
              { l: '處理中', v: summary.pending },
              { l: '已派工/服務中', v: summary.in_progress },
              { l: '已完成', v: summary.completed },
              { l: '已取消', v: summary.cancelled },
            ].map(x => (
              <div key={x.l} className="card p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{x.v}</p>
                <p className="text-gray-600 text-[13px] mt-0.5">{x.l}</p>
              </div>
            ))}
          </div>

          <div className="card p-4 mb-4 text-center">
            <span className="text-gray-600 text-sm">平均客單價：</span>
            <span className="text-xl font-bold text-gray-900">{formatPrice(summary.avg_order)}</span>
          </div>

          {/* 方案分佈 */}
          <div className="card p-5 mb-4">
            <h2 className="font-bold text-gray-800 mb-3 text-base">方案分佈（已完成）</h2>
            {byPlan.length === 0 ? (
              <p className="text-gray-600 text-sm py-3 text-center">此期間沒有已完成的預約</p>
            ) : (
              <div className="space-y-2">
                {byPlan.map(p => {
                  const max = byPlan[0].count || 1
                  return (
                    <div key={p.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold text-gray-800">{p.name}</span>
                        <span className="text-gray-700">{p.count} 場・{formatPrice(p.revenue)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${(p.count / max) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 陪診員績效 */}
          <div className="card p-5 mb-4">
            <h2 className="font-bold text-gray-800 mb-3 text-base">陪診員績效</h2>
            {byCompanion.length === 0 ? (
              <p className="text-gray-600 text-sm py-3 text-center">此期間沒有派工紀錄</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold text-gray-700">陪診員</th>
                      <th className="text-center px-3 py-2 font-bold text-gray-700">場次</th>
                      <th className="text-right px-3 py-2 font-bold text-gray-700">帶來營收</th>
                      <th className="text-right px-3 py-2 font-bold text-gray-700">應付報酬</th>
                      <th className="text-right px-3 py-2 font-bold text-gray-700">本期未結算</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCompanion.map((c, i) => (
                      <tr key={c.id} className={i % 2 ? 'bg-gray-50/60' : ''}>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold text-gray-800">{c.name}</span>
                          <span className="block text-gray-600 text-[13px]">{c.phone}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-gray-900">{c.jobs}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{formatPrice(c.revenue)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{formatPrice(c.fee)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {c.unsettled_fee > 0
                            ? <span className="font-bold text-orange-700">{formatPrice(c.unsettled_fee)}</span>
                            : <span className="text-gray-500">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 縣市分佈 */}
          <div className="card p-5">
            <h2 className="font-bold text-gray-800 mb-3 text-base">服務縣市分佈</h2>
            {byCounty.length === 0 ? (
              <p className="text-gray-600 text-sm py-3 text-center">尚無資料</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {byCounty.map(c => (
                  <span key={c.county} className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-lg text-[15px] font-semibold">
                    {c.county} <span className="text-green-700">{c.count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* 收入結算 */}
          <div className="card p-5 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-gray-600 text-sm font-semibold">待結算總額</p>
                <p className="text-3xl font-bold text-orange-700 mt-1">{formatPrice(summary.unsettled_total)}</p>
                <p className="text-gray-600 text-[13px] mt-1">
                  {unsettled.length} 筆已完成但尚未結算・<strong>不受上方期間篩選影響</strong>
                </p>
              </div>
              <select className="form-input max-w-xs" value={filterCompanion}
                onChange={e => { setFilterCompanion(e.target.value ? Number(e.target.value) : ''); setPicked([]) }}>
                <option value="">全部陪診員</option>
                {payoutCompanions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}（未結算 {formatPrice(c.fee)}）</option>
                ))}
              </select>
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="card p-10 text-center text-gray-600">
              <p className="text-lg font-semibold text-gray-800 mb-2">沒有待結算的項目</p>
              <p className="text-[15px] leading-relaxed">
                要出現在這裡，需同時符合三個條件：<br />
                ① 狀態為「<strong>已完成</strong>」　② 已<strong>指派陪診員</strong>　③ 尚未標記結算
              </p>
              <p className="text-[13px] mt-2">
                此清單已涵蓋<strong>所有期間</strong>，與上方的日期篩選無關。
                若陪診員端顯示「待結算」但這裡沒有，多半是該筆狀態還不是「已完成」，
                或尚未指派陪診員。
              </p>
            </div>
          ) : (
            <>
              {/* 批次操作列 */}
              <div className="card p-4 mb-3 flex flex-wrap items-center justify-between gap-3 sticky top-16 z-10">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 rounded accent-green-700"
                    checked={picked.length === shown.length && shown.length > 0}
                    onChange={toggleAll} />
                  <span className="font-semibold text-gray-800 text-[15px]">
                    全選（{shown.length} 筆）
                  </span>
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  {picked.length > 0 && (
                    <span className="text-gray-800 font-semibold text-[15px]">
                      已選 {picked.length} 筆・{formatPrice(pickedTotal)}
                    </span>
                  )}
                  <button onClick={settle} disabled={picked.length === 0}
                    className="btn-primary disabled:opacity-40">
                    標記為已結算
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {shown.map(u => (
                  <div key={u.id} className={`card p-4 ${picked.includes(u.id) ? 'ring-2 ring-green-500' : ''}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" className="w-5 h-5 rounded accent-green-700 mt-1 flex-shrink-0"
                        checked={picked.includes(u.id)} onChange={() => toggle(u.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-gray-800 text-[13px]">{u.booking_no}</span>
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[13px] font-semibold">
                            {u.companion_name}
                          </span>
                        </div>
                        <p className="font-semibold text-gray-900 text-[15px]">
                          {u.service_date}・{u.service_name}
                        </p>
                        <p className="text-gray-600 text-sm mt-0.5">
                          {u.county} {u.hospital}｜就診人：{u.patient_name}
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100">
                          <div>
                            <p className="text-gray-600 text-[13px]">方案收入</p>
                            <p className="font-bold text-gray-900">{formatPrice(u.price)}</p>
                          </div>
                          <div>
                            <label className="text-gray-600 text-[13px] block">額外收費</label>
                            <input type="number" defaultValue={u.extra_fee}
                              onBlur={e => { if (Number(e.target.value) !== u.extra_fee) updateFee(u.id, 'extra_fee', e.target.value) }}
                              className="w-full border-2 border-gray-200 rounded-lg px-2 py-1 text-base focus:border-green-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-gray-600 text-[13px] block">陪診員報酬</label>
                            <input type="number" defaultValue={u.companion_fee}
                              onBlur={e => { if (Number(e.target.value) !== u.companion_fee) updateFee(u.id, 'companion_fee', e.target.value) }}
                              className="w-full border-2 border-gray-200 rounded-lg px-2 py-1 text-base font-bold focus:border-green-500 focus:outline-none" />
                          </div>
                          <div>
                            <p className="text-gray-600 text-[13px]">本筆毛利</p>
                            <p className="font-bold text-green-700">
                              {formatPrice(u.price + u.addon_fee + u.extra_fee - u.companion_fee - u.addon_companion_fee)}
                            </p>
                            {(u.addon_fee > 0 || u.addon_companion_fee > 0) && (
                              <p className="text-gray-600 text-[13px] mt-0.5">
                                含加購 收 {formatPrice(u.addon_fee)} / 付 {formatPrice(u.addon_companion_fee)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
