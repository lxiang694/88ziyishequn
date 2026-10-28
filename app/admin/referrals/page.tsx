'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface Row { code: string; name: string; phone: string; visits: number; signups: number; orders: number; buyers: number; new_customers: number; revenue: number }
interface Recent { order_no: string; kind: string; customer_name: string; total: number; created_at: string; referrer: string; is_new: boolean }
interface Data {
  ready: boolean
  period?: string
  summary?: { members_with_link: number; sharers: number; visits: number; signups: number; orders: number; new_customers: number; revenue: number }
  ranking?: Row[]
  recent?: Recent[]
}

const PERIODS = [{ key: '30', label: '近 30 天' }, { key: '90', label: '近 90 天' }, { key: '365', label: '近一年' }, { key: 'all', label: '全部' }]
const money = (n: number) => `$${Math.round(n).toLocaleString('zh-TW')}`
const md = (iso: string) => { const d = new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString(); return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` }

/**
 * 後台：好友推薦成效。
 * 手機上排行是一張張卡片，電腦上是表格；數字大、說明白，一眼看出誰在幫忙介紹。
 */
export default function ReferralsPage() {
  const [period, setPeriod] = useState('30')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await (await fetch('/api/admin/referrals?period=' + period)).json()
      if (d.success) { setData(d.data); setError('') } else setError(d.error || '讀取失敗')
    } catch { setError('讀取失敗') }
    setLoading(false)
  }, [period])
  useEffect(() => { load() }, [load])

  const s = data?.summary

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">好友推薦</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-gray-600">會員用專屬連結分享給親友：點了幾次、幾位註冊、幾位下單、幾位是第一次買</p>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold ${period === p.key ? 'bg-green-700 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>{p.label}</button>
        ))}
      </div>

      {error && <div className="card border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      {loading ? <p className="py-16 text-center text-gray-500">載入中…</p>
        : !data?.ready ? (
          <div className="card border border-amber-200 bg-amber-50 p-5 text-[15px] leading-relaxed text-amber-900">
            好友推薦尚未啟用：請到 Supabase → SQL Editor 執行 <code className="font-mono">migrations/referrals.sql</code>，執行後會員中心就會出現「邀請親友」與專屬連結。
          </div>
        ) : s && (
          <>
            {/* 總覽 */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ['👀', '連結被點', s.visits, '次', 'bg-white'],
                ['🙋', '新註冊會員', s.signups, '位', 'bg-white'],
                ['🛍️', '推薦訂單', s.orders, '張', 'bg-white'],
                ['🌱', '帶來新客', s.new_customers, '位', 'bg-green-50 border border-green-200'],
                ['💰', '推薦營收', money(s.revenue), '', 'bg-white col-span-2 lg:col-span-1'],
              ].map(([icon, label, v, unit, cls]) => (
                <div key={label as string} className={`card p-4 ${cls}`}>
                  <p className="text-[13px] font-bold text-gray-500"><span aria-hidden className="mr-1">{icon}</span>{label}</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">{v}<span className="ml-1 text-sm font-semibold text-gray-500">{unit}</span></p>
                </div>
              ))}
            </section>
            <p className="text-[13px] text-gray-600">
              目前有 <b>{s.members_with_link}</b> 位會員已有專屬連結，其中 <b>{s.sharers}</b> 位分享出去的連結有人點過。
              想讓更多人分享？到 <Link href="/admin/crm" className="font-bold text-green-700 underline">客戶經營・核心客戶</Link> 私訊邀請老客戶幫忙介紹。
            </p>

            {/* 推薦人排行 */}
            <section className="card p-0">
              <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
                <h2 className="text-lg font-bold text-gray-800">推薦人排行</h2>
                <span className="text-[12px] text-gray-500">依帶來新客排序</span>
              </div>
              {!data.ranking?.length ? (
                <p className="px-5 pb-8 pt-4 text-center text-gray-500">這段期間還沒有人透過推薦連結進來</p>
              ) : (
                <>
                  {/* 手機：卡片 */}
                  <ul className="divide-y divide-gray-100 md:hidden">
                    {data.ranking.map((r, i) => (
                      <li key={r.code} className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${i < 3 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-gray-900">{r.name}</p>
                            <p className="text-[12px] text-gray-500"><span className="tabular-nums">{r.phone}</span>・{r.code}</p>
                          </div>
                          <p className="flex-shrink-0 text-right font-bold text-green-700">{money(r.revenue)}</p>
                        </div>
                        <div className="mt-2.5 grid grid-cols-4 gap-1 text-center">
                          {[['點擊', r.visits], ['註冊', r.signups], ['下單', r.buyers], ['新客', r.new_customers]].map(([l, n]) => (
                            <div key={l as string} className={`rounded-lg py-1.5 ${l === '新客' && n ? 'bg-green-50' : 'bg-gray-50'}`}>
                              <p className={`text-lg font-bold tabular-nums ${l === '新客' && n ? 'text-green-700' : 'text-gray-800'}`}>{n}</p>
                              <p className="text-[11px] text-gray-500">{l}</p>
                            </div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {/* 電腦：表格 */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-gray-600">
                        <tr>{['#', '推薦人', '推薦碼', '點擊', '註冊', '下單親友', '帶來新客', '推薦營收'].map(h => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.ranking.map((r, i) => (
                          <tr key={r.code} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-bold text-gray-500">{i + 1}</td>
                            <td className="px-4 py-3"><b className="text-gray-900">{r.name}</b><span className="block text-[12px] text-gray-500 tabular-nums">{r.phone}</span></td>
                            <td className="px-4 py-3 font-mono text-gray-600">{r.code}</td>
                            <td className="px-4 py-3 tabular-nums">{r.visits}</td>
                            <td className="px-4 py-3 tabular-nums">{r.signups}</td>
                            <td className="px-4 py-3 tabular-nums">{r.buyers}</td>
                            <td className="px-4 py-3"><span className={`rounded-lg px-2 py-1 font-bold tabular-nums ${r.new_customers ? 'bg-green-50 text-green-700' : 'text-gray-400'}`}>{r.new_customers}</span></td>
                            <td className="px-4 py-3 font-bold text-green-700 tabular-nums">{money(r.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            {/* 最近的推薦訂單 */}
            <section className="card p-5">
              <h2 className="mb-2 text-lg font-bold text-gray-800">最近的推薦訂單</h2>
              {!data.recent?.length ? <p className="py-6 text-center text-gray-500">還沒有推薦訂單</p> : (
                <ul className="divide-y divide-gray-100">
                  {data.recent.map(o => (
                    <li key={o.order_no} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                      <span className="w-12 flex-shrink-0 text-sm text-gray-500 tabular-nums">{md(o.created_at)}</span>
                      <span className="min-w-0 flex-1 basis-40">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <b className="text-gray-900">{o.customer_name}</b>
                          {o.is_new && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[12px] font-bold text-green-800">新客</span>}
                          {o.kind === 'group_buy' && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[12px] font-bold text-sky-800">團購</span>}
                        </span>
                        <span className="block text-[12px] text-gray-500">由 {o.referrer} 推薦・{o.order_no}</span>
                      </span>
                      <span className="flex-shrink-0 font-bold text-gray-900 tabular-nums">{money(o.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
    </div>
  )
}
