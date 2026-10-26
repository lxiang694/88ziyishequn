'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

interface Store {
  id: number
  store_code: string
  store_name: string
  county: string
  district: string
  address: string
  is_active: boolean
}
type Draft = Omit<Store, 'id'> & { id?: number }
const BLANK: Draft = { store_code: '', store_name: '', county: '', district: '', address: '', is_active: true }

const STATUS = [
  { key: '', label: '全部' },
  { key: 'active', label: '營業中' },
  { key: 'inactive', label: '已停用' },
] as const

/**
 * 後台：7-11 門市管理。
 * 7-11 換店號、改店名、搬家、關店時在這裡改，不用再進資料庫。
 */
function StoresContent() {
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [term, setTerm] = useState(searchParams.get('q') || '')
  const [status, setStatus] = useState<(typeof STATUS)[number]['key']>('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Store[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(30)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Draft | null>(null)

  // 打字停 300ms 才查
  useEffect(() => {
    const t = setTimeout(() => { setTerm(q.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (term) params.set('q', term)
    if (status) params.set('status', status)
    try {
      const d = await (await fetch('/api/admin/stores?' + params)).json()
      if (d.success) { setRows(d.data); setTotal(d.total); setPageSize(d.pageSize) }
      else toast.error(d.error || '讀取失敗')
    } catch { toast.error('讀取失敗') }
    setLoading(false)
  }, [page, term, status])
  useEffect(() => { load() }, [load])

  const quickToggle = async (s: Store) => {
    const next = !s.is_active
    if (!confirm(next
      ? `重新啟用「${s.store_name}」（${s.store_code}）？\n\n啟用後客人結帳可以選這間門市，用這間門市的訂單也能轉賣貨便。`
      : `停用「${s.store_name}」（${s.store_code}）？\n\n停用後客人結帳選不到這間門市；已經下單、選這間門市的訂單會卡在賣貨便轉單，需要另外聯絡客人換門市。`)) return
    const d = await (await fetch(`/api/admin/stores/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...s, is_active: next }),
    })).json()
    if (d.success) { toast.success(next ? '已啟用' : '已停用'); load() } else toast.error(d.error || '操作失敗')
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">門市管理</h1>
          <p className="mt-1 text-[13px] text-gray-600">7-11 換店號、改店名、搬家或關店時，在這裡修改</p>
        </div>
        <button onClick={() => setEditing({ ...BLANK })} className="btn-primary px-5 py-2.5 text-sm">＋ 新增門市</button>
      </div>

      <div className="card mb-4 space-y-3 p-4">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋店號、店名或地址，例如：276247、正隆、板橋"
          className="form-input w-full" style={{ height: 46 }} />
        <div className="flex flex-wrap items-center gap-2">
          {STATUS.map(s => (
            <button key={s.key} onClick={() => { setStatus(s.key); setPage(1) }}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${status === s.key ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s.label}
            </button>
          ))}
          <span className="ml-auto text-sm text-gray-500">共 {total.toLocaleString()} 間</span>
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-gray-600">載入中...</p>
      ) : rows.length === 0 ? (
        <div className="card py-14 text-center text-gray-600">
          <p>找不到符合的門市</p>
          {term && <button onClick={() => setEditing({ ...BLANK, store_code: /^\d{6}$/.test(term) ? term : '', store_name: /^\d+$/.test(term) ? '' : term })}
            className="mt-3 font-semibold text-green-700 underline">新增這間門市</button>}
        </div>
      ) : (
        <ul className="card divide-y divide-gray-100">
          {rows.map(s => (
            <li key={s.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${s.is_active ? '' : 'bg-gray-50'}`}>
              <span className="w-[4.5rem] flex-shrink-0 font-mono text-[15px] font-bold text-gray-800">{s.store_code}</span>
              <span className="min-w-0 flex-1 basis-48">
                <span className="flex items-center gap-2">
                  <b className="text-gray-900">{s.store_name}</b>
                  {!s.is_active && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[12px] font-bold text-gray-700">已停用</span>}
                </span>
                <span className="block text-[13px] text-gray-500">{s.address}</span>
              </span>
              <span className="flex flex-shrink-0 gap-2">
                <button onClick={() => setEditing({ ...s })}
                  className="rounded-lg border border-green-600 px-3 py-1.5 text-sm font-bold text-green-700 hover:bg-green-50">修改</button>
                <button onClick={() => quickToggle(s)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${s.is_active ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`}>
                  {s.is_active ? '停用' : '啟用'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {total > pageSize && (
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">上一頁</button>
          <span className="self-center text-sm text-gray-600">第 {page} / {Math.ceil(total / pageSize)} 頁</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">下一頁</button>
        </div>
      )}

      {editing && <StoreEditor draft={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

function StoreEditor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Draft>(draft)
  const [usage, setUsage] = useState<{ orders: number; groupBuyOrders: number } | null>(null)
  const [sync, setSync] = useState(true)
  const [saving, setSaving] = useState(false)
  const isNew = !draft.id

  useEffect(() => {
    if (!draft.id) return
    fetch(`/api/admin/stores/${draft.id}`).then(r => r.json()).then(d => { if (d.success) setUsage(d.usage) }).catch(() => {})
  }, [draft.id])

  const set = (k: keyof Draft, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))
  const pending = (usage?.orders || 0) + (usage?.groupBuyOrders || 0)
  const infoChanged = !isNew && (form.store_name !== draft.store_name || form.address !== draft.address || form.county !== draft.county || form.district !== draft.district || form.store_code !== draft.store_code)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(isNew ? '/api/admin/stores' : `/api/admin/stores/${draft.id}`, {
        method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sync_pending: infoChanged && sync }),
      })
      const d = await res.json()
      if (!d.success) { toast.error(d.error || '儲存失敗'); return }
      const n = (d.synced?.orders || 0) + (d.synced?.groupBuyOrders || 0)
      toast.success(isNew ? '已新增門市' : n ? `已儲存，並更新 ${n} 張未出貨訂單的門市資料` : '已儲存')
      onSaved()
    } catch { toast.error('儲存失敗') } finally { setSaving(false) }
  }

  const field = (k: keyof Draft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-gray-700">{label}</span>
      <input value={String(form[k] ?? '')} onChange={e => set(k, e.target.value)} className="form-input w-full" style={{ height: 44 }} {...props} />
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-gray-900">{isNew ? '新增門市' : `修改門市：${draft.store_name}`}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            {field('store_code', '店號', { inputMode: 'numeric', maxLength: 6, placeholder: '6 位數字' })}
            {field('store_name', '門市名稱', { placeholder: '例如：正隆（不用加「門市」）' })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('county', '縣市', { placeholder: '新北市' })}
            {field('district', '鄉鎮區', { placeholder: '板橋區' })}
          </div>
          {field('address', '地址', { placeholder: '完整地址' })}
          <label className="flex items-center gap-2 pt-1 text-sm font-bold text-gray-700">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="h-5 w-5" />
            營業中（客人結帳可以選這間門市）
          </label>
        </div>

        {!isNew && pending > 0 && (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
            這間門市有 <b>{usage!.orders}</b> 張待確認訂單{usage!.groupBuyOrders ? <>、<b>{usage!.groupBuyOrders}</b> 張團購待出貨訂單</> : null}。
            {infoChanged && (
              <label className="mt-2 flex items-start gap-2 font-semibold">
                <input type="checkbox" checked={sync} onChange={e => setSync(e.target.checked)} className="mt-0.5 h-4 w-4" />
                同時更新這些訂單上的門市名稱與地址（建議勾選，否則賣貨便轉單會顯示「名稱或地址不一致」）
              </label>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700">取消</button>
          <button onClick={save} disabled={saving} className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50">{saving ? '儲存中…' : '儲存'}</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminStoresPage() {
  return <Suspense fallback={<p className="py-16 text-center text-gray-600">載入中...</p>}><StoresContent /></Suspense>
}
