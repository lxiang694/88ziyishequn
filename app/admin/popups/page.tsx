'use client'
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Popup {
  id: number
  name: string
  badge_text: string | null
  title: string
  body: string | null
  price_text: string | null
  image_url: string | null
  cta_text: string
  link_path: string
  product_slug: string | null
  is_active: boolean
  priority: number
  delay_ms: number
  auto_close_ms: number
  cooldown_hours: number
  starts_at: string | null
  ends_at: string | null
  include_paths: string[]
  exclude_paths: string[]
}

const BLANK = {
  name: '', badge_text: '', title: '', body: '', price_text: '', image_url: '',
  cta_text: '看看詳情', link_path: '', product_slug: '',
  is_active: false, priority: 0,
  delay_ms: 800, auto_close_ms: 5000, cooldown_hours: 12,
  starts_at: '', ends_at: '',
  include_paths: '', exclude_paths: '/cart\n/checkout\n/order-success',
}

type Form = typeof BLANK

function toForm(p: Popup): Form {
  return {
    name: p.name, badge_text: p.badge_text || '', title: p.title, body: p.body || '',
    price_text: p.price_text || '', image_url: p.image_url || '',
    cta_text: p.cta_text, link_path: p.link_path, product_slug: p.product_slug || '',
    is_active: p.is_active, priority: p.priority,
    delay_ms: p.delay_ms, auto_close_ms: p.auto_close_ms, cooldown_hours: p.cooldown_hours,
    starts_at: p.starts_at || '', ends_at: p.ends_at || '',
    include_paths: (p.include_paths || []).join('\n'),
    exclude_paths: (p.exclude_paths || []).join('\n'),
  }
}

export default function PopupsAdminPage() {
  const [rows, setRows] = useState<Popup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tableMissing, setTableMissing] = useState(false)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<Form>(BLANK)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true); setError(''); setTableMissing(false)
    fetch('/api/admin/popups').then(r => r.json())
      .then(d => {
        if (d.success) setRows(d.data)
        else { setError(d.error || '載入失敗'); if (d.table_missing) setTableMissing(true) }
        setLoading(false)
      })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const up = (k: keyof Form, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    const url = editing === 'new' ? '/api/admin/popups' : `/api/admin/popups/${editing}`
    const body = editing === 'new' ? form : { ...form, action: 'update' }
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setSaving(false)
    if (!d.success) return toast.error(d.error || '儲存失敗')
    toast.success(editing === 'new' ? '已新增' : '已更新')
    setEditing(null); load()
  }

  const toggle = async (p: Popup) => {
    const res = await fetch(`/api/admin/popups/${p.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', is_active: !p.is_active }),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(!p.is_active ? '已開啟' : '已關閉'); load()
  }

  const remove = async (p: Popup) => {
    if (!confirm(`確定刪除「${p.name}」？此操作無法復原。`)) return
    const res = await fetch(`/api/admin/popups/${p.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete' }),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '刪除失敗')
    toast.success('已刪除'); load()
  }

  const activeCount = rows.filter(r => r.is_active).length

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-2xl font-bold text-gray-800">前台彈窗</h1>
        <button onClick={() => { setForm(BLANK); setEditing('new') }}
          className="btn-primary py-2 px-4 text-sm">＋ 新增彈窗</button>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        訪客進站後會看到彈窗。**同時只會顯示一個** —— 兩個疊在一起是最快讓人關掉網站的方法。
        有多個開啟時，取「優先順序」數字最大的那一個。
      </p>

      {tableMissing && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-4">
          <p className="font-bold text-amber-900 mb-1">⚙️ 資料表尚未建立</p>
          <p className="text-amber-800 text-sm leading-relaxed">
            請先在 Supabase SQL Editor 執行
            <code className="bg-white px-1.5 py-0.5 rounded mx-1 font-mono text-[13px]">
              migrations/site_popups_schema.sql
            </code>
            。執行後原本的野生茶籽油彈窗會自動搬進來，內容不會遺失。
          </p>
        </div>
      )}

      {error && !tableMissing && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {loading && <div className="card p-8 text-center text-gray-500">載入中…</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="card p-8 text-center text-gray-500 text-sm">
          目前沒有任何彈窗。按右上角「新增彈窗」建立第一個。
        </div>
      )}

      {activeCount > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-3">
          <p className="text-[13px] text-blue-800">
            目前有 {activeCount} 個彈窗開著，訪客只會看到優先順序最高的那一個。
          </p>
        </div>
      )}

      <div className="space-y-3">
        {rows.map(p => (
          <div key={p.id} className={`card p-4 border-2 ${p.is_active ? 'border-green-300' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-bold text-gray-800">
                  {p.name}
                  <span className={`ml-2 text-[13px] font-semibold px-2 py-0.5 rounded-full ${
                    p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? '顯示中' : '已關閉'}
                  </span>
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {p.title}
                  <span className="text-gray-400"> → {p.link_path}</span>
                </p>
                <p className="text-[13px] text-gray-500 mt-0.5">
                  優先 {p.priority}・延遲 {p.delay_ms}ms・
                  {p.auto_close_ms > 0 ? `${p.auto_close_ms / 1000} 秒後自動關` : '不自動關'}・
                  冷卻 {p.cooldown_hours} 小時
                  {(p.starts_at || p.ends_at) && (
                    <span>・期間 {p.starts_at || '不限'} ~ {p.ends_at || '不限'}</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => toggle(p)}
                  className={`text-sm font-bold rounded-lg px-3 py-1.5 border-2 ${
                    p.is_active
                      ? 'border-gray-200 text-gray-600'
                      : 'border-green-600 text-green-700'}`}>
                  {p.is_active ? '關閉' : '開啟'}
                </button>
                <button onClick={() => { setForm(toForm(p)); setEditing(p.id) }}
                  className="text-sm border rounded-lg px-3 py-1.5">編輯</button>
                <button onClick={() => remove(p)}
                  className="text-sm text-red-600 border border-red-200 rounded-lg px-3 py-1.5">刪除</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing !== null && (
        <div className="card p-5 mt-5 border-2 border-green-300">
          <h2 className="font-bold text-gray-800 text-lg mb-4">
            {editing === 'new' ? '新增彈窗' : '編輯彈窗'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="form-label">彈窗名稱 *（只有後台看得到）</label>
              <input className="form-input" value={form.name}
                onChange={e => up('name', e.target.value)} placeholder="例：野生茶籽油預售" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">小標籤</label>
                <input className="form-input" value={form.badge_text}
                  onChange={e => up('badge_text', e.target.value)} placeholder="🌿 預售中 · 今年只有這一批" />
              </div>
              <div>
                <label className="form-label">價格文字</label>
                <input className="form-input" value={form.price_text}
                  onChange={e => up('price_text', e.target.value)} placeholder="NT$1,350 / 500ml" />
              </div>
            </div>

            <div>
              <label className="form-label">標題 *（最多 40 字）</label>
              <input className="form-input" value={form.title}
                onChange={e => up('title', e.target.value)} placeholder="野生茶籽油" />
            </div>

            <div>
              <label className="form-label">內文（最多 120 字）</label>
              <textarea className="form-input" rows={2} value={form.body}
                onChange={e => up('body', e.target.value)}
                placeholder="山上現在還在採，預計 10 月出油後直接寄給您。" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">按鈕文字 *</label>
                <input className="form-input" value={form.cta_text}
                  onChange={e => up('cta_text', e.target.value)} />
              </div>
              <div>
                <label className="form-label">按鈕連結 *（站內路徑）</label>
                <input className="form-input font-mono" value={form.link_path}
                  onChange={e => up('link_path', e.target.value)} placeholder="/camellia-oil" />
              </div>
            </div>

            <div>
              <label className="form-label">關聯商品識別碼</label>
              <input className="form-input font-mono" value={form.product_slug}
                onChange={e => up('product_slug', e.target.value)} placeholder="wild-camellia-oil" />
              <p className="text-[13px] text-gray-500 mt-1">
                填了就會自動用該商品的封面圖。不填也可以，下面自己指定圖片網址。
              </p>
            </div>

            <div>
              <label className="form-label">圖片網址（優先於商品封面）</label>
              <input className="form-input font-mono" value={form.image_url}
                onChange={e => up('image_url', e.target.value)} placeholder="https://..." />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">開始日期</label>
                <input type="date" className="form-input" value={form.starts_at}
                  onChange={e => up('starts_at', e.target.value)} />
              </div>
              <div>
                <label className="form-label">結束日期</label>
                <input type="date" className="form-input" value={form.ends_at}
                  onChange={e => up('ends_at', e.target.value)} />
                <p className="text-[13px] text-gray-500 mt-1">
                  過了就自動不再顯示，忘了關也沒關係。
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="form-label">優先順序</label>
                <input type="number" className="form-input" value={form.priority}
                  onChange={e => up('priority', Number(e.target.value))} />
              </div>
              <div>
                <label className="form-label">延遲顯示（毫秒）</label>
                <input type="number" className="form-input" value={form.delay_ms}
                  onChange={e => up('delay_ms', Number(e.target.value))} />
              </div>
              <div>
                <label className="form-label">自動關閉（毫秒）</label>
                <input type="number" className="form-input" value={form.auto_close_ms}
                  onChange={e => up('auto_close_ms', Number(e.target.value))} />
                <p className="text-[13px] text-gray-500 mt-1">0 = 不自動關</p>
              </div>
              <div>
                <label className="form-label">冷卻（小時）</label>
                <input type="number" className="form-input" value={form.cooldown_hours}
                  onChange={e => up('cooldown_hours', Number(e.target.value))} />
                <p className="text-[13px] text-gray-500 mt-1">關掉後多久才再彈</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">只在這些路徑顯示</label>
                <textarea className="form-input font-mono text-sm" rows={3}
                  value={form.include_paths} onChange={e => up('include_paths', e.target.value)}
                  placeholder="留空 = 全站都顯示&#10;一行一個，例：/products" />
              </div>
              <div>
                <label className="form-label">這些路徑不顯示</label>
                <textarea className="form-input font-mono text-sm" rows={3}
                  value={form.exclude_paths} onChange={e => up('exclude_paths', e.target.value)} />
                <p className="text-[13px] text-gray-500 mt-1">
                  建議保留結帳流程 —— 正在結帳的人被打斷，可能就不買了。
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={form.is_active}
                onChange={e => up('is_active', e.target.checked)} />
              立即開啟顯示
            </label>

            <div className="flex gap-3 pt-3 border-t border-gray-100">
              <button onClick={() => setEditing(null)} className="btn-secondary">取消</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-6">
        <p className="text-[13px] text-gray-600 leading-relaxed">
          <strong>測試方式：</strong>在任何前台網址後面加上
          <code className="bg-white px-1.5 py-0.5 rounded mx-1 font-mono">?popup=1</code>
          就會強制顯示一次，略過冷卻與期間限制。
          例：<code className="bg-white px-1.5 py-0.5 rounded font-mono">/?popup=1</code>
        </p>
      </div>
    </div>
  )
}
