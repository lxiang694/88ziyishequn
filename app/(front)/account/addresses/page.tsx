'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUserAuth, useRequireUser } from '@/components/front/UserAuthContext'
import { validateTWPhone } from '@/lib/utils'
import StorePickerModal, { Store } from '@/components/front/StorePickerModal'
import toast from 'react-hot-toast'

const emptyForm = { label: '', recipient_name: '', phone: '', line_id: '' }

export default function AddressesPage() {
  const { user, loading } = useRequireUser()
  const { authedFetch } = useUserAuth()
  const [addresses, setAddresses] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [store, setStore] = useState<Store | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    authedFetch('/api/account/addresses').then(r => r.json()).then(d => {
      if (d.success) setAddresses(d.data)
      setLoadingData(false)
    })
  }

  useEffect(() => {
    if (!user) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setStore(null)
    setShowForm(true)
  }

  const openEdit = (addr: any) => {
    setEditingId(addr.id)
    setForm({ label: addr.label || '', recipient_name: addr.recipient_name, phone: addr.phone, line_id: addr.line_id || '' })
    setStore({ id: addr.store_id, store_name: addr.store_name, address: addr.store_address, county: addr.store_county, district: addr.store_district })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.recipient_name.trim()) { toast.error('請填寫姓名'); return }
    if (!validateTWPhone(form.phone)) { toast.error('手機號碼格式錯誤'); return }
    if (!store) { toast.error('請選擇 7-11 門市'); return }

    setSaving(true)
    const payload = {
      label: form.label.trim() || null,
      recipient_name: form.recipient_name.trim(),
      phone: form.phone.trim(),
      line_id: form.line_id.trim() || null,
      store_id: store.id,
      store_name: store.store_name,
      store_address: store.address,
      store_county: store.county,
      store_district: store.district,
    }
    const res = editingId
      ? await authedFetch(`/api/account/addresses/${editingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      : await authedFetch('/api/account/addresses', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
    const d = await res.json()
    if (d.success) {
      toast.success(editingId ? '已更新' : '已新增')
      setShowForm(false)
      load()
    } else {
      toast.error(d.error || '儲存失敗')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這筆常用收件資訊？')) return
    const res = await authedFetch(`/api/account/addresses/${id}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) { toast.success('已刪除'); load() } else { toast.error(d.error || '刪除失敗') }
  }

  const handleSetDefault = async (id: string) => {
    const res = await authedFetch(`/api/account/addresses/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_default: true }),
    })
    const d = await res.json()
    if (d.success) { load() } else { toast.error(d.error || '設定失敗') }
  }

  if (loading || loadingData) return <div className="py-20 text-center text-gray-600">載入中...</div>
  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
          <Link href="/account" className="hover:text-green-700">會員中心</Link>
          <span>›</span>
          <span className="text-gray-700">常用收件資訊</span>
        </nav>

        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-800">常用收件資訊</h1>
          <button onClick={openAdd} className="btn-primary py-2 px-4 text-sm">＋ 新增</button>
        </div>

        {addresses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="text-4xl mb-3">⭐</div>
            <p className="text-gray-600 mb-4">還沒有常用收件資訊</p>
            <p className="text-gray-600 text-sm">結帳時勾選「儲存這筆收件資訊」即可自動加入，<br />也可以在這裡手動新增</p>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map(addr => (
              <div key={addr.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800">
                      {addr.label && <span className="text-green-700">{addr.label}・</span>}
                      {addr.recipient_name} <span className="text-gray-500 font-mono text-sm">{addr.phone}</span>
                      {addr.is_default && <span className="ml-2 text-[13px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">預設</span>}
                    </p>
                    {addr.line_id && <p className="text-gray-600 text-[13px] mt-0.5">LINE: {addr.line_id}</p>}
                    <p className="text-green-600 text-sm font-semibold mt-1">{addr.store_name}</p>
                    <p className="text-gray-500 text-sm">{addr.store_county}{addr.store_district}・{addr.store_address}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  {!addr.is_default && (
                    <button onClick={() => handleSetDefault(addr.id)}
                      className="text-[13px] font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg px-3 py-1.5">設為預設</button>
                  )}
                  <button onClick={() => openEdit(addr)}
                    className="text-[13px] font-bold text-green-700 border border-green-200 hover:bg-green-50 rounded-lg px-3 py-1.5">編輯</button>
                  <button onClick={() => handleDelete(addr.id)}
                    className="text-[13px] font-bold text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 ml-auto">刪除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl p-5 space-y-4" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">{editingId ? '編輯收件資訊' : '新增收件資訊'}</h3>
              <button onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl">✕</button>
            </div>
            <div>
              <label className="form-label">標籤 <span className="text-gray-600 font-normal text-sm">（選填，例如「家裡」「公司」）</span></label>
              <input className="form-input" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">姓名 <span className="text-red-500">*</span></label>
              <input className="form-input" value={form.recipient_name} onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">手機號碼 <span className="text-red-500">*</span></label>
              <input type="tel" inputMode="numeric" className="form-input" placeholder="09xxxxxxxx"
                value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">LINE ID <span className="text-gray-600 font-normal text-sm">（選填）</span></label>
              <input className="form-input" value={form.line_id} onChange={e => setForm(f => ({ ...f, line_id: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">7-11 取貨門市 <span className="text-red-500">*</span></label>
              {store ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 flex justify-between items-start gap-3">
                  <div>
                    <p className="font-bold text-green-800">{store.store_name}</p>
                    <p className="text-green-600 text-sm">{store.county}{store.district}</p>
                    <p className="text-gray-500 text-[13px]">{store.address}</p>
                  </div>
                  <button onClick={() => setShowPicker(true)} className="text-green-700 font-bold text-[13px] border-2 border-green-300 px-2 py-1 rounded-lg whitespace-nowrap">更換</button>
                </div>
              ) : (
                <button onClick={() => setShowPicker(true)} className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-green-400 hover:bg-green-50 text-gray-600 text-sm">
                  📍 點此選擇門市
                </button>
              )}
            </div>
            <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 disabled:opacity-50">
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </div>
      )}

      {showPicker && (
        <StorePickerModal onClose={() => setShowPicker(false)} onSelect={s => { setStore(s); setShowPicker(false) }} />
      )}
    </div>
  )
}
