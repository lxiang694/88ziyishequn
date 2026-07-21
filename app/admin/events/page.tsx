'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'

const emptyForm = { title: '', slug: '', address: '', event_time: '', description: '', is_active: true }

export default function AdminEventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    fetch('/api/admin/events').then(r => r.json()).then(d => {
      if (d.success) setEvents(d.data)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (ev: any) => {
    setEditingId(ev.id)
    setForm({ title: ev.title, slug: ev.slug, address: ev.address || '', event_time: ev.event_time || '', description: ev.description || '', is_active: ev.is_active })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('請填寫活動名稱'); return }
    setSaving(true)
    const res = editingId
      ? await fetch(`/api/admin/events/${editingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: form.title, address: form.address, event_time: form.event_time, description: form.description, is_active: form.is_active }),
        })
      : await fetch('/api/admin/events', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
    const d = await res.json()
    if (d.success) { toast.success(editingId ? '已更新' : '已建立'); setShowForm(false); load() }
    else toast.error(d.error || '儲存失敗')
    setSaving(false)
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`確定要刪除活動「${title}」？報名資料也會一併刪除，無法復原。`)) return
    const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) { toast.success('已刪除'); load() } else toast.error(d.error || '刪除失敗')
  }

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/events/${slug}`
    navigator.clipboard.writeText(url).then(() => toast.success('連結已複製')).catch(() => toast.error('複製失敗'))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">社群活動</h1>
          <p className="text-gray-400 text-sm mt-0.5">建立線下活動報名頁面，公開連結可直接分享給社群</p>
        </div>
        <button onClick={openAdd} className="btn-primary py-2 px-4 text-sm">＋ 新增活動</button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">載入中...</div>
      ) : events.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-400">還沒有活動，點右上角新增一個吧</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="card p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/admin/events/${ev.id}`} className="font-bold text-gray-800 hover:text-green-700">{ev.title}</Link>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ev.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {ev.is_active ? '進行中' : '已下架'}
                    </span>
                    <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">{ev.registration_count} 人報名</span>
                  </div>
                  <p className="text-gray-400 text-xs font-mono mt-1">/events/{ev.slug}</p>
                  {ev.event_time && <p className="text-gray-500 text-sm mt-1">🕒 {ev.event_time}</p>}
                  {ev.address && <p className="text-gray-500 text-sm">📍 {ev.address}</p>}
                  <p className="text-gray-300 text-xs mt-1">建立於 {formatDateTime(ev.created_at)}</p>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => copyLink(ev.slug)} className="text-xs font-bold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg px-3 py-1.5 whitespace-nowrap">複製連結</button>
                  <Link href={`/admin/events/${ev.id}`} className="text-xs font-bold text-green-700 border border-green-200 hover:bg-green-50 rounded-lg px-3 py-1.5 whitespace-nowrap text-center">查看報名</Link>
                  <button onClick={() => openEdit(ev)} className="text-xs font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg px-3 py-1.5 whitespace-nowrap">編輯</button>
                  <button onClick={() => handleDelete(ev.id, ev.title)} className="text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 whitespace-nowrap">刪除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl p-5 space-y-4" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">{editingId ? '編輯活動' : '新增活動'}</h3>
              <button onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl">✕</button>
            </div>
            <div>
              <label className="form-label">活動名稱 <span className="text-red-500">*</span></label>
              <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            {!editingId && (
              <div>
                <label className="form-label">網址代稱 <span className="text-gray-400 font-normal text-sm">（選填，留空會自動產生，建議用英文/數字）</span></label>
                <input className="form-input" placeholder="例如 banqiao-2026-07" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="form-label">活動時間</label>
              <input className="form-input" placeholder="例如 2026/07/18（六）14:00" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">活動地址</label>
              <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">活動說明 <span className="text-gray-400 font-normal text-sm">（選填，顯示在報名表單上方）</span></label>
              <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded accent-green-700" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              上架中（開放公開報名）
            </label>
            <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 disabled:opacity-50">
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
