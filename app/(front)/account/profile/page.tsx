'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUserAuth, useRequireUser } from '@/components/front/UserAuthContext'
import { validateTWPhone } from '@/lib/utils'
import StorePickerModal, { Store } from '@/components/front/StorePickerModal'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { user, loading } = useRequireUser()
  const { authedFetch } = useUserAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    if (!user) return
    authedFetch('/api/account/profile').then(r => r.json()).then(d => {
      if (d.success) setProfile(d.data)
      setLoadingData(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const update = (k: string, v: string) => setProfile((p: any) => ({ ...p, [k]: v }))

  const pickStore = (store: Store) => {
    setProfile((p: any) => ({
      ...p,
      default_store_id: store.id,
      default_store_name: store.store_name,
      default_store_address: store.address,
      default_store_county: store.county,
      default_store_district: store.district,
    }))
    setShowPicker(false)
  }

  const clearStore = () => {
    setProfile((p: any) => ({
      ...p,
      default_store_id: null,
      default_store_name: null,
      default_store_address: null,
      default_store_county: null,
      default_store_district: null,
    }))
  }

  const handleSave = async () => {
    if (profile?.phone && !validateTWPhone(profile.phone)) {
      toast.error('手機號碼格式錯誤'); return
    }
    setSaving(true)
    const res = await authedFetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    const d = await res.json()
    if (d.success) toast.success('個人資料已更新')
    else toast.error(d.error || '更新失敗')
    setSaving(false)
  }

  if (loading || loadingData) return <div className="py-20 text-center text-gray-600">載入中...</div>
  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">

        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
          <Link href="/account" className="hover:text-green-700">會員中心</Link>
          <span>›</span>
          <span className="text-gray-700">個人資料</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-800 mb-5">個人資料</h1>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <p className="text-[13px] text-gray-600 font-bold mb-3 tracking-wide">基本資料</p>
          <div className="space-y-4">
            <div>
              <label className="form-label">Email</label>
              <input className="form-input bg-gray-50 text-gray-500" value={user.email || ''} disabled />
              <p className="text-[13px] text-gray-600 mt-1">Email 無法修改</p>
            </div>
            <div>
              <label className="form-label">姓名</label>
              <input className="form-input" value={profile?.name || ''} onChange={e => update('name', e.target.value)} placeholder="請輸入姓名" />
            </div>
            <div>
              <label className="form-label">手機號碼</label>
              <input type="tel" inputMode="numeric" className="form-input" value={profile?.phone || ''}
                onChange={e => update('phone', e.target.value)} placeholder="09xxxxxxxx" />
              <p className="text-[13px] text-gray-600 mt-1">用來自動關聯訂單</p>
            </div>
            <div>
              <label className="form-label">LINE ID（選填）</label>
              <input className="form-input" value={profile?.line_id || ''}
                onChange={e => update('line_id', e.target.value)} placeholder="your_line_id" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <p className="text-[13px] text-gray-600 font-bold mb-3 tracking-wide">預設取貨門市</p>
          <p className="text-[13px] text-gray-500 mb-3 leading-relaxed">設定後，下次結帳會自動帶入這家門市</p>
          {profile?.default_store_id ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="font-bold text-green-800 leading-relaxed">{profile.default_store_name}</p>
                  <p className="text-green-600 text-sm font-semibold mt-1">{profile.default_store_county}{profile.default_store_district}</p>
                  <p className="text-gray-600 text-sm mt-1">{profile.default_store_address}</p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => setShowPicker(true)}
                    className="text-green-700 font-bold text-sm border-2 border-green-300 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap">
                    更換
                  </button>
                  <button onClick={clearStore}
                    className="text-red-600 font-bold text-sm border-2 border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap">
                    移除
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowPicker(true)}
              className="w-full py-4 px-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-green-400 hover:bg-green-50 text-gray-600 transition-all">
              <span className="text-2xl mr-2">📍</span>選擇預設 7-11 取貨門市
            </button>
          )}
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full text-lg py-4 disabled:opacity-50">
          {saving ? '儲存中...' : '儲存變更'}
        </button>

        {showPicker && (
          <StorePickerModal title="選擇預設 7-11 門市" onClose={() => setShowPicker(false)} onSelect={pickStore} />
        )}
      </div>
    </div>
  )
}
