'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { campaignPhase, formatTwDateTime, PHASE_LABEL, type Phase } from '@/lib/groupBuy/domain'

type Row = { id: number; slug: string; title: string; starts_at: string; ends_at: string; is_published: boolean; orders: number; revenue: number }

const PHASE_STYLE: Record<Phase, string> = {
  draft: 'bg-gray-100 text-gray-600', upcoming: 'bg-amber-100 text-amber-800',
  open: 'bg-red-100 text-red-700', closed: 'bg-slate-200 text-slate-700',
}

/** 團購檔期列表。每月開團：按「複製成下個月」，改日期、價格就能發布 */
export default function GroupBuyAdminPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await (await fetch('/api/admin/group-buy', { cache: 'no-store' })).json()
    if (d.success) { setRows(d.data); setNeedsMigration(!!d.needsMigration) } else toast.error(d.error || '讀取失敗')
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const copy = async (row: Row) => {
    if (!confirm(`把「${row.title}」複製成下個月的檔期？\n\n會一起複製上架中的商品，時間各往後一個月，先存成草稿。`)) return
    setBusy(true)
    const d = await (await fetch('/api/admin/group-buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ copy_from: row.id }) })).json()
    setBusy(false)
    if (!d.success) return toast.error(d.error || '複製失敗')
    toast.success('已複製，請確認日期與價格後發布')
    router.push(`/admin/group-buy/${d.data.id}`)
  }

  const now = new Date()
  return (
    <div className="max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">團購管理</h1>
          <p className="mt-0.5 text-sm text-gray-600">每月一檔。前台網址固定是 <code className="rounded bg-gray-100 px-1">/group-buy</code>，會自動帶到目前這一檔。</p>
        </div>
        <Link href="/admin/group-buy/new" className="rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-800">＋ 新增檔期</Link>
      </div>

      {needsMigration && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          團購資料表還沒建立：請先在 Supabase SQL Editor 執行 <code>migrations/group_buy_schema.sql</code>。
        </div>
      )}

      <div className="space-y-3">
        {loading ? <p className="card p-8 text-center text-gray-500">載入中…</p>
          : rows.length === 0 ? <p className="card p-8 text-center text-gray-500">還沒有檔期，按右上角「新增檔期」開始第一檔。</p>
          : rows.map(r => {
            const phase = campaignPhase(r, now)
            return (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${PHASE_STYLE[phase]}`}>{PHASE_LABEL[phase]}</span>
                      <h2 className="text-lg font-bold text-gray-900">{r.title}</h2>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{formatTwDateTime(r.starts_at)} 開團 ～ {formatTwDateTime(r.ends_at)} 截單</p>
                    <p className="mt-0.5 text-sm text-gray-600">訂單 <b>{r.orders}</b> 筆・金額 <b>${r.revenue.toLocaleString('zh-TW')}</b>（不含已取消）</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/group-buy/${r.id}/orders`} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-bold text-white">訂單與叫貨</Link>
                    <Link href={`/admin/group-buy/${r.id}`} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">編輯檔期與商品</Link>
                    <button disabled={busy} onClick={() => copy(r)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">複製成下個月</button>
                    {r.is_published && <a href={`/group-buy/${r.slug}`} target="_blank" rel="noopener" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">看前台 ↗</a>}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
