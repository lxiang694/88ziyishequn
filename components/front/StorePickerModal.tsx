'use client'
import { useState, useEffect, useRef } from 'react'

export interface Store { id: number; store_name: string; county: string; district: string; address: string }

export default function StorePickerModal({
  title = '選擇 7-11 取貨門市',
  onSelect,
  onClose,
}: {
  title?: string
  onSelect: (store: Store) => void
  onClose: () => void
}) {
  const [counties, setCounties] = useState<string[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [selectedCounty, setSelectedCounty] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [search, setSearch] = useState('')
  const [loadingStores, setLoadingStores] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/stores/counties').then(r => r.json()).then(d => { if (d.success) setCounties(d.data) })
  }, [])

  useEffect(() => {
    if (!selectedCounty) { setDistricts([]); setSelectedDistrict(''); return }
    fetch(`/api/stores/districts?county=${encodeURIComponent(selectedCounty)}`)
      .then(r => r.json()).then(d => { if (d.success) setDistricts(d.data) })
    setSelectedDistrict('')
  }, [selectedCounty])

  useEffect(() => {
    setLoadingStores(true)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      const params = new URLSearchParams({ limit: '60' })
      if (selectedCounty) params.set('county', selectedCounty)
      if (selectedDistrict) params.set('district', selectedDistrict)
      if (search.trim()) params.set('search', search.trim())
      fetch('/api/stores?' + params).then(r => r.json()).then(d => {
        if (d.success) setStores(d.data)
        setLoadingStores(false)
      })
    }, search ? 350 : 0)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [selectedCounty, selectedDistrict, search])

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-xl md:rounded-2xl rounded-t-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex justify-center pt-2 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">✕</button>
        </div>
        <div className="px-4 py-3 space-y-3 border-b border-gray-100 flex-shrink-0">
          <input className="form-input" placeholder="🔍 搜尋門市名稱或地址..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <select className="form-input" value={selectedCounty} onChange={e => setSelectedCounty(e.target.value)}>
              <option value="">全部縣市</option>
              {counties.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="form-input" value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} disabled={!selectedCounty}>
              <option value="">全部區域</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {loadingStores ? (
            <div className="py-12 text-center text-gray-400 text-base">搜尋中...</div>
          ) : stores.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-gray-400">找不到門市，請嘗試其他關鍵字或縣市</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {stores.map(store => (
                <button key={store.id} onClick={() => onSelect(store)}
                  className="w-full text-left p-4 rounded-xl hover:bg-green-50 transition-colors active:bg-green-100">
                  <p className="font-bold text-gray-800 text-base">{store.store_name}</p>
                  <p className="text-green-600 text-sm font-semibold mt-0.5">{store.county}{store.district}</p>
                  <p className="text-gray-500 text-sm mt-0.5">{store.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
