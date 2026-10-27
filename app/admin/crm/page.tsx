'use client'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { CrmSummary, Customer, ListKey } from '@/lib/crm'

type Row = Customer & {
  status_label: string
  message: string
  contact: { contacted_at: string; admin_name: string | null; note: string | null; outcome: 'won' | 'waiting' | 'no_response' } | null
}
interface Data {
  summary: CrmSummary
  counts: Record<ListKey, number>
  effect: { contacted: number; won: number; waiting: number; no_response: number; won_revenue: number }
  contacts_ready: boolean
  group_buy_included: boolean
  list: ListKey
  total: number
  page: number
  page_size: number
  rows: Row[]
}

const LISTS: { key: ListKey; label: string; hint: string }[] = [
  { key: 'due', label: '該回購了', hint: '已超過這位客人平常的回購週期、還沒流失。最值得今天就私訊的人。' },
  { key: 'core', label: '核心客戶', hint: '累計消費前 20% 的客人，是撐起營業額的人。定期關心、新品先通知。' },
  { key: 'dormant', label: '沉睡客', hint: '2～6 個月沒買。用問候＋關心使用狀況，比直接推銷有效。' },
  { key: 'one_time', label: '只買過一次', hint: '買過一次就沒再買（超過 30 天）。問問使用感受，把第一次變成第二次。' },
  { key: 'lost', label: '流失客', hint: '超過半年沒買。用新品、團購或優惠喚回，回應率較低，挑消費高的優先。' },
  { key: 'all', label: '全部客戶', hint: '依累計消費排序。' },
]
const STATUS_STYLE: Record<string, string> = {
  活躍: 'bg-green-100 text-green-800', 穩定: 'bg-sky-100 text-sky-800', 沉睡: 'bg-amber-100 text-amber-800', 流失: 'bg-gray-200 text-gray-700',
}
const money = (n: number) => `$${Math.round(n).toLocaleString('zh-TW')}`
const date = (iso: string) => { const d = new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString(); return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` }

// LINE 好友數、社群人數由老闆自己填（網站讀不到 LINE 的數字），記在這台電腦
const LINE_KEY = 'crm_line_counts'
function useLineCounts() {
  const [counts, setCounts] = useState({ friends: 2600, community: 2000 })
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(LINE_KEY) || 'null'); if (v) setCounts(v) } catch {} }, [])
  const save = (v: typeof counts) => { setCounts(v); try { localStorage.setItem(LINE_KEY, JSON.stringify(v)) } catch {} }
  return [counts, save] as const
}

/**
 * 後台：客戶經營。
 * 一眼看出誰在撐業務、誰該回購了、誰多久沒買；名單上直接複製 LINE 訊息、
 * 按「已聯繫」，之後回來買就算挽回成功。一般訂單與團購訂單合併計算。
 */
export default function CrmPage() {
  const [data, setData] = useState<Data | null>(null)
  const [list, setList] = useState<ListKey>('due')
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lineCounts, setLineCounts] = useLineCounts()
  const [editingLine, setEditingLine] = useState(false)

  useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(1) }, 300); return () => clearTimeout(t) }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ list, page: String(page) })
    if (term) params.set('q', term)
    try {
      const d = await (await fetch('/api/admin/crm?' + params)).json()
      if (d.success) { setData(d.data); setError('') } else setError(d.error || '讀取失敗')
    } catch { setError('讀取失敗') }
    setLoading(false)
  }, [list, page, term])
  useEffect(() => { load() }, [load])

  const copy = async (r: Row) => {
    try { await navigator.clipboard.writeText(r.message); toast.success(`已複製給 ${r.name || r.phone} 的訊息，貼到 LINE 就能傳`) }
    catch { toast.error('複製失敗，請手動選取文字') }
  }
  const markContacted = async (r: Row) => {
    const d = await (await fetch('/api/admin/crm/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: r.phone, list_key: list }),
    })).json()
    if (d.success) { toast.success('已記錄聯繫，之後回購會算進挽回成效'); load() } else toast.error(d.error || '記錄失敗')
  }

  const s = data?.summary
  const current = LISTS.find(l => l.key === list)!

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">客戶經營</h1>
        <p className="mt-1 text-[13px] text-gray-600">誰在撐業務、誰該回購、誰多久沒買 —— 一般訂單與團購訂單合併計算（以手機辨識同一位客人）</p>
      </div>
      {error && <div className="card border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      {data && !data.group_buy_included && <p className="card bg-amber-50 p-3 text-sm text-amber-900">讀不到團購訂單，目前只計算一般訂單。</p>}

      {s && (
        <>
          {/* ── 客人健康狀況 ── */}
          <section className="card p-5">
            <h2 className="mb-3 font-bold text-gray-800">客人現況 <span className="text-sm font-normal text-gray-500">共 {s.customers.toLocaleString()} 位下過單・回購率 {s.repeat_rate}%</span></h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {([
                ['active', '活躍', '30 天內買過', 'border-green-200 bg-green-50 text-green-800'],
                ['steady', '穩定', '31～60 天', 'border-sky-200 bg-sky-50 text-sky-800'],
                ['dormant', '沉睡', '2～6 個月沒買', 'border-amber-200 bg-amber-50 text-amber-800'],
                ['lost', '流失', '超過半年沒買', 'border-gray-200 bg-gray-50 text-gray-700'],
              ] as const).map(([k, label, hint, style]) => (
                <div key={k} className={`rounded-2xl border p-4 ${style}`}>
                  <p className="text-sm font-bold">{label}</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{s.status[k].count}<span className="ml-1 text-sm font-semibold">人</span></p>
                  <p className="mt-1 text-[12px] opacity-80">{hint}・累計 {money(s.status[k].spend)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 誰在撐業務 ＋ LINE 轉換 ── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-3 font-bold text-gray-800">誰在撐業務</h2>
              <ul className="space-y-3 text-[15px] text-gray-700">
                <li className="flex items-baseline justify-between gap-3">
                  <span>前 20% 核心客戶（{s.core_count} 人）貢獻</span>
                  <b className="text-2xl text-green-700 tabular-nums">{s.core_share}%</b>
                </li>
                <li className="flex items-baseline justify-between gap-3">
                  <span>近 90 天營收來自老客（買過 2 次以上）</span>
                  <b className="text-2xl text-green-700 tabular-nums">{s.returning_share_90d}%</b>
                </li>
                <li className="flex items-baseline justify-between gap-3">
                  <span>平均多久回購一次</span>
                  <b className="text-2xl text-gray-800 tabular-nums">{s.global_cycle ? `${s.global_cycle} 天` : '—'}</b>
                </li>
              </ul>
              <button onClick={() => { setList('core'); setPage(1) }} className="mt-4 text-sm font-bold text-green-700 underline">看核心客戶名單 →</button>
            </section>

            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold text-gray-800">LINE 好友轉換</h2>
                <button onClick={() => setEditingLine(e => !e)} className="text-sm font-semibold text-green-700 underline">{editingLine ? '完成' : '修改人數'}</button>
              </div>
              {editingLine ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-bold text-gray-700">LINE 官方帳號好友
                    <input type="number" min={0} className="form-input mt-1 w-full" value={lineCounts.friends} onChange={e => setLineCounts({ ...lineCounts, friends: Number(e.target.value) || 0 })} />
                  </label>
                  <label className="text-sm font-bold text-gray-700">LINE 社群人數
                    <input type="number" min={0} className="form-input mt-1 w-full" value={lineCounts.community} onChange={e => setLineCounts({ ...lineCounts, community: Number(e.target.value) || 0 })} />
                  </label>
                </div>
              ) : (
                <>
                  <Funnel steps={[
                    { label: 'LINE 好友', value: lineCounts.friends },
                    { label: '下過單', value: s.customers },
                    { label: '回購過', value: s.repeat_customers },
                    { label: '30 天內有買', value: s.status.active.count },
                  ]} />
                  <p className="mt-3 text-[13px] leading-relaxed text-gray-600">
                    約 <b className="text-gray-800">{Math.max(0, lineCounts.friends - s.customers).toLocaleString()}</b> 位好友還沒下過單（潛水客）。
                    網站無法知道是哪幾位，建議用 LINE 群發「新品、團購、首購優惠」，連結加上
                    <code className="mx-1 rounded bg-gray-100 px-1">?utm_source=line</code>，再到「流量監控 → 流量來源」看成效。
                  </p>
                </>
              )}
            </section>
          </div>

          {/* ── 挽回成效 ── */}
          <section className="card p-5">
            <h2 className="mb-3 font-bold text-gray-800">主動聯繫成效 <span className="text-sm font-normal text-gray-500">近 60 天</span></h2>
            {!data!.contacts_ready ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">執行 <code className="font-mono">migrations/customer_contacts.sql</code> 後，名單上的「已聯繫」才會記錄，這裡會顯示聯繫後有多少人回來買。</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                {[
                  ['聯繫了', data!.effect.contacted, 'text-gray-800'],
                  ['回來買了', data!.effect.won, 'text-green-700'],
                  ['等待中（30 天內）', data!.effect.waiting, 'text-amber-700'],
                  ['挽回營收（近 90 天）', money(data!.effect.won_revenue), 'text-green-700'],
                ].map(([label, v, color]) => (
                  <div key={label as string} className="rounded-xl bg-gray-50 p-3">
                    <p className={`text-2xl font-bold tabular-nums ${color}`}>{v}</p>
                    <p className="mt-1 text-[12px] text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── 行動名單 ── */}
      <section className="card p-5">
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {LISTS.map(l => (
            <button key={l.key} onClick={() => { setList(l.key); setPage(1) }}
              className={`flex-shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${list === l.key ? (l.key === 'due' ? 'bg-amber-600 text-white' : 'bg-green-700 text-white') : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l.label}{data && <span className="ml-1 tabular-nums">({data.counts[l.key]})</span>}
            </button>
          ))}
        </div>
        <p className="mb-3 rounded-xl bg-green-50 px-3 py-2.5 text-sm leading-relaxed text-green-900">💡 {current.hint}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋姓名、手機、LINE ID" className="form-input min-w-0 flex-1" style={{ height: 42 }} />
          <a href={`/api/admin/crm?list=${list}&format=csv${term ? `&q=${encodeURIComponent(term)}` : ''}`}
            className="flex items-center rounded-xl border border-gray-300 px-4 text-sm font-bold text-gray-700 hover:bg-gray-50">匯出名單 (Excel)</a>
        </div>

        {loading ? <p className="py-12 text-center text-gray-500">載入中…</p>
          : !data?.rows.length ? <p className="py-12 text-center text-gray-500">這份名單目前沒有人 🎉</p>
          : (
            <ul className="divide-y divide-gray-100">
              {data.rows.map(r => (
                <li key={r.phone} className="py-3.5">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-60">
                      <p className="flex flex-wrap items-center gap-2">
                        <b className="text-[16px] text-gray-900">{r.name || '（未留姓名）'}</b>
                        <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${STATUS_STYLE[r.status_label]}`}>{r.status_label}</span>
                        {r.due && list !== 'due' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[12px] font-bold text-amber-800">該回購了</span>}
                      </p>
                      <p className="mt-0.5 text-[13px] text-gray-500">
                        <span className="tabular-nums">{r.phone}</span>{r.line_id && <>・LINE {r.line_id}</>}
                      </p>
                      <p className="mt-1 text-[13px] text-gray-600">
                        常買：{r.favorite_items.join('、') || '—'}
                      </p>
                    </div>
                    <div className="grid flex-shrink-0 grid-cols-3 gap-4 text-center">
                      <div><p className={`text-lg font-bold tabular-nums ${r.days_since > 60 ? 'text-amber-700' : 'text-gray-800'}`}>{r.days_since}<span className="text-xs"> 天</span></p><p className="text-[11px] text-gray-500">沒買（{date(r.last_at)}）</p></div>
                      <div><p className="text-lg font-bold tabular-nums text-gray-800">{r.orders}<span className="text-xs"> 次</span></p><p className="text-[11px] text-gray-500">{r.group_buy_orders ? `含團購 ${r.group_buy_orders}` : '購買'}{r.cycle_days ? `・約 ${r.cycle_days} 天一次` : ''}</p></div>
                      <div><p className="text-lg font-bold tabular-nums text-green-700">{money(r.spend)}</p><p className="text-[11px] text-gray-500">累計消費</p></div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button onClick={() => copy(r)} className="rounded-lg bg-[#06C755] px-3 py-1.5 text-sm font-bold text-white hover:opacity-90">複製 LINE 訊息</button>
                    <button onClick={() => markContacted(r)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-50">已聯繫</button>
                    {r.contact && (
                      <span className={`text-[13px] font-semibold ${r.contact.outcome === 'won' ? 'text-green-700' : r.contact.outcome === 'waiting' ? 'text-amber-700' : 'text-gray-500'}`}>
                        {date(r.contact.contacted_at)} {r.contact.admin_name || ''}聯繫過・{r.contact.outcome === 'won' ? '✓ 已回購' : r.contact.outcome === 'waiting' ? '等待回覆' : '沒有回應'}
                      </span>
                    )}
                    <details className="w-full text-[13px] text-gray-600">
                      <summary className="cursor-pointer select-none text-gray-500">預覽訊息</summary>
                      <p className="mt-1 whitespace-pre-line rounded-lg bg-gray-50 p-3">{r.message}</p>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
          )}

        {data && data.total > data.page_size && (
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">上一頁</button>
            <span className="self-center text-sm text-gray-600">第 {page} / {Math.ceil(data.total / data.page_size)} 頁</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * data.page_size >= data.total} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">下一頁</button>
          </div>
        )}
      </section>
    </div>
  )
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, steps[0].value)
  return (
    <ul className="space-y-2">
      {steps.map((st, i) => (
        <li key={st.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 flex-shrink-0 text-gray-600">{st.label}</span>
          <span className="h-6 flex-1 overflow-hidden rounded-lg bg-gray-100">
            <span className="flex h-full items-center rounded-lg bg-green-600 px-2 text-[12px] font-bold text-white" style={{ width: `${Math.max(6, Math.min(100, st.value / max * 100))}%` }}>
              {st.value.toLocaleString()}
            </span>
          </span>
          <span className="w-12 flex-shrink-0 text-right text-[12px] text-gray-500 tabular-nums">{i ? `${Math.round(st.value / max * 1000) / 10}%` : ''}</span>
        </li>
      ))}
    </ul>
  )
}
