'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/components/front/CartContext'
import { useUserAuth } from '@/components/front/UserAuthContext'
import { formatPrice, validateTWPhone } from '@/lib/utils'
import StorePickerModal, { Store } from '@/components/front/StorePickerModal'
import toast from 'react-hot-toast'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, totalAmount, clearCart } = useCart()
  const { user, authedFetch } = useUserAuth()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ customer_name: '', phone: '', line_id: '', note: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [showStorePicker, setShowStorePicker] = useState(false)

  // 手機鍵盤彈出時（輸入框聚焦）隱藏底部固定結帳條，避免蓋住正在輸入的欄位
  const [inputFocused, setInputFocused] = useState(false)
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) setInputFocused(true)
    }
    const onFocusOut = () => setInputFocused(false)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  // "上次選擇的門市" suggestion — looked up by phone, works for guests & members alike
  const [lastStore, setLastStore] = useState<Store | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  // Logged-in member's saved recipient info (address book)
  const [savedAddresses, setSavedAddresses] = useState<any[]>([])
  const [saveAsAddress, setSaveAsAddress] = useState(true)

  // Auto-fill from member profile
  useEffect(() => {
    if (!user || profileLoaded) return
    authedFetch('/api/account/profile').then(r => r.json()).then(d => {
      if (d.success && d.data) {
        const p = d.data
        setForm(f => ({
          customer_name: f.customer_name || p.name || '',
          phone: f.phone || p.phone || '',
          line_id: f.line_id || p.line_id || '',
          note: f.note,
        }))
        if (p.default_store_id && !selectedStore) {
          setSelectedStore({
            id: p.default_store_id,
            store_name: p.default_store_name,
            address: p.default_store_address,
            county: p.default_store_county,
            district: p.default_store_district,
          })
        }
      }
      setProfileLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Load member's saved addresses (for logged-in quick-pick)
  useEffect(() => {
    if (!user) return
    authedFetch('/api/account/addresses').then(r => r.json()).then(d => {
      if (d.success) setSavedAddresses(d.data)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Detect "last used store" by phone — helps guests too, once they finish typing a valid number
  useEffect(() => {
    if (selectedStore || suggestionDismissed || !validateTWPhone(form.phone)) { setLastStore(null); return }
    const t = setTimeout(() => {
      fetch('/api/orders?phone=' + encodeURIComponent(form.phone.trim()))
        .then(r => r.json())
        .then(d => {
          const last = d.success ? d.data?.[0] : null
          if (last?.store_id && last?.store_name) {
            setLastStore({ id: last.store_id, store_name: last.store_name, address: last.store_address, county: last.county, district: last.district })
          }
        })
        .catch(() => {})
    }, 500)
    return () => clearTimeout(t)
  }, [form.phone, selectedStore, suggestionDismissed])

  const applyAddress = (addr: any) => {
    setForm(f => ({ ...f, customer_name: addr.recipient_name, phone: addr.phone, line_id: addr.line_id || '' }))
    setSelectedStore({ id: addr.store_id, store_name: addr.store_name, address: addr.store_address, county: addr.store_county, district: addr.store_district })
    setErrors({})
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.customer_name.trim()) e.customer_name = '請填寫姓名'
    if (!form.phone || !validateTWPhone(form.phone)) e.phone = '請填寫正確手機號碼（09xxxxxxxx）'
    if (!selectedStore) e.store = '請選擇 7-11 取貨門市'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) { toast.error('請確認填寫資料'); return }
    if (items.length === 0) { toast.error('購物車是空的'); return }
    setSubmitting(true)
    try {
      const fetchFn = user ? authedFetch : fetch
      const res = await fetchFn('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.customer_name.trim(),
          phone: form.phone.trim(),
          line_id: form.line_id.trim() || null,
          store_id: selectedStore!.id,
          store_name: selectedStore!.store_name,
          store_address: selectedStore!.address,
          county: selectedStore!.county,
          district: selectedStore!.district,
          note: form.note.trim() || null,
          items: items.map(i => ({
            product_id: i.product_id, product_name: i.product_name,
            cover_image_url: i.cover_image_url, variant_id: i.variant_id,
            variant_name: i.variant_name, sku_code: i.sku_code,
            unit_price: i.unit_price, quantity: i.quantity,
          })),
        }),
      })
      const data = await res.json()
      if (data.success) {
        if (user && saveAsAddress) {
          authedFetch('/api/account/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient_name: form.customer_name.trim(),
              phone: form.phone.trim(),
              line_id: form.line_id.trim() || null,
              store_id: selectedStore!.id,
              store_name: selectedStore!.store_name,
              store_address: selectedStore!.address,
              store_county: selectedStore!.county,
              store_district: selectedStore!.district,
            }),
          }).catch(() => {})
        }
        clearCart()
        router.push(`/order-success?order_no=${data.data.order_no}`)
      } else {
        toast.error(data.error || '下單失敗，請稍後再試')
      }
    } catch {
      toast.error('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <p className="text-xl text-gray-600 mb-6">購物車是空的</p>
        <Link href="/" className="btn-primary text-xl px-10">去選購商品</Link>
      </div>
    )
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-56 md:pb-10">
      {/* Back button */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cart" className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">確認訂單</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* LEFT: Form */}
        <div className="flex-1 space-y-5 order-2 md:order-1">

          {/* Mobile order summary at top */}
          <div className="md:hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-800">訂單商品（{totalItems} 件）</h2>
              <span className="text-green-700 font-bold text-lg">{formatPrice(totalAmount)}</span>
            </div>
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.variant_id} className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 relative flex-shrink-0">
                    {item.cover_image_url
                      ? <Image src={item.cover_image_url} alt={item.product_name} fill className="object-cover" sizes="48px" />
                      : <div className="w-full h-full flex items-center justify-center">💊</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm line-clamp-1">{item.product_name}</p>
                    <p className="text-gray-500 text-xs">{item.variant_name} × {item.quantity}</p>
                  </div>
                  <p className="font-bold text-gray-700 text-sm flex-shrink-0">{formatPrice(item.unit_price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Saved addresses quick-pick (logged-in members) */}
          {user && savedAddresses.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center text-base">⭐</span>
                常用收件資訊
              </h2>
              <div className="space-y-2">
                {savedAddresses.map(addr => (
                  <button key={addr.id} onClick={() => applyAddress(addr)}
                    className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-green-300 hover:bg-green-50 transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {addr.label ? `${addr.label}・` : ''}{addr.recipient_name} {addr.phone}
                        {addr.is_default && <span className="ml-1.5 text-xs text-green-600 font-bold">預設</span>}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5 truncate">{addr.store_name}（{addr.store_county}{addr.store_district}）</p>
                    </div>
                    <span className="flex-shrink-0 text-green-700 text-sm font-bold">使用</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recipient form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center text-base">✍️</span>
              收件資料
            </h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">姓名 <span className="text-red-500">*</span></label>
                <input
                  className={`form-input ${errors.customer_name ? 'border-red-400 bg-red-50' : ''}`}
                  placeholder="請輸入您的姓名"
                  value={form.customer_name}
                  onChange={e => { setForm(f => ({ ...f, customer_name: e.target.value })); setErrors(er => ({ ...er, customer_name: '' })) }}
                />
                {errors.customer_name && (
                  <p className="text-red-500 text-sm mt-1.5">⚠️ {errors.customer_name}</p>
                )}
              </div>
              <div>
                <label className="form-label">手機號碼 <span className="text-red-500">*</span></label>
                <input
                  className={`form-input ${errors.phone ? 'border-red-400 bg-red-50' : ''}`}
                  type="tel" inputMode="numeric" placeholder="09xxxxxxxx"
                  value={form.phone}
                  onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: '' })) }}
                />
                {errors.phone
                  ? <p className="text-red-500 text-sm mt-1.5">⚠️ {errors.phone}</p>
                  : <p className="text-gray-400 text-xs mt-1">事後用此號碼查詢訂單狀態</p>
                }
              </div>
              <div>
                <label className="form-label">LINE ID <span className="text-gray-400 font-normal text-sm">（選填，方便客服聯繫）</span></label>
                <input className="form-input" placeholder="your_line_id"
                  value={form.line_id} onChange={e => setForm(f => ({ ...f, line_id: e.target.value }))} />
              </div>
              {user && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded accent-green-700"
                    checked={saveAsAddress} onChange={e => setSaveAsAddress(e.target.checked)} />
                  儲存這筆收件資訊，下次結帳快速選擇
                </label>
              )}
            </div>
          </div>

          {/* Store picker */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center text-base">🏪</span>
              選擇 7-11 取貨門市 <span className="text-red-500 text-base">*</span>
            </h2>

            {selectedStore ? (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="font-bold text-green-800 text-lg leading-snug">{selectedStore.store_name}</p>
                    <p className="text-green-600 text-sm font-semibold mt-1">{selectedStore.county}{selectedStore.district}</p>
                    <p className="text-gray-600 text-sm mt-1">{selectedStore.address}</p>
                  </div>
                  <button onClick={() => setShowStorePicker(true)}
                    className="flex-shrink-0 text-green-700 font-bold text-sm border-2 border-green-300 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap">
                    更換
                  </button>
                </div>
              </div>
            ) : lastStore ? (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <p className="text-amber-800 text-sm font-semibold mb-2">💡 偵測到您上次選擇的門市：</p>
                <p className="font-bold text-gray-800">{lastStore.store_name}</p>
                <p className="text-green-600 text-sm font-semibold mt-0.5">{lastStore.county}{lastStore.district}</p>
                <p className="text-gray-500 text-sm mt-0.5">{lastStore.address}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setSelectedStore(lastStore); setErrors(e => ({ ...e, store: '' })) }}
                    className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold text-sm py-2 rounded-lg transition-colors">
                    直接使用此門市
                  </button>
                  <button onClick={() => { setSuggestionDismissed(true); setShowStorePicker(true) }}
                    className="flex-1 border-2 border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-sm py-2 rounded-lg transition-colors">
                    重新選擇
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowStorePicker(true)}
                className={`w-full py-5 px-4 rounded-xl border-2 border-dashed text-left transition-all hover:scale-[1.005]
                  ${errors.store ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-green-400 bg-gray-50 hover:bg-green-50'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📍</span>
                  <div>
                    <p className={`font-bold text-base ${errors.store ? 'text-red-600' : 'text-gray-600'}`}>
                      點此選擇 7-11 取貨門市
                    </p>
                    <p className="text-gray-400 text-sm mt-0.5">全台 7,000+ 家門市，輸入地址或區域即可搜尋</p>
                  </div>
                </div>
              </button>
            )}
            {errors.store && <p className="text-red-500 text-sm mt-2">⚠️ {errors.store}</p>}
          </div>

          {/* Payment & Delivery info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center text-base">💵</span>
              付款方式與到貨時間
            </h2>

            {/* Payment method */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4 mb-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">🏪</span>
                <div className="flex-1">
                  <p className="font-bold text-green-800 text-base mb-1.5">7-11 取貨付款</p>
                  <ul className="text-sm text-green-700 space-y-1 leading-relaxed">
                    <li>✓ 商品到 7-11 門市時於櫃檯付款即可</li>
                    <li>✓ 接受 現金、悠遊卡、icash、LINE Pay</li>
                    <li>✓ 我們<strong>不會預先扣款</strong>，請您安心下單</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Delivery time */}
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">📦</span>
                <div className="flex-1">
                  <p className="font-bold text-amber-800 text-base mb-1.5">預計到貨時間</p>
                  <ul className="text-sm text-amber-700 space-y-1 leading-relaxed">
                    <li>· <strong>現貨商品</strong>：下單後約 <strong>3 個工作日</strong>送達 7-11</li>
                    <li>· <strong>預購商品</strong>：下單後約 <strong>7 個工作日</strong>送達 7-11</li>
                    <li>· 商品到店後，我們會透過 <strong>LINE / 簡訊通知您</strong></li>
                  </ul>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-3 leading-relaxed">
              💡 7-11 商品保留期限為到店後 7 天，請您於期限內取貨
            </p>
          </div>

          {/* Note */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <label className="form-label">備註 <span className="text-gray-400 font-normal text-sm">（選填）</span></label>
            <textarea className="form-input" rows={3} placeholder="有任何特殊需求請填寫..."
              value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>

          {/* Trust badges */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-500 mb-3 text-center tracking-wide">— 安心下單保障 —</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: '🔒', title: 'SSL 加密', desc: '個資安全保護' },
                { icon: '🏪', title: '全台 7-11', desc: '7,000+ 家門市' },
                { icon: '💬', title: 'LINE 客服', desc: '即時專人回覆' },
                { icon: '🔄', title: '7 天鑑賞期', desc: '未拆封可退換' },
              ].map(badge => (
                <div key={badge.title} className="text-center px-2">
                  <div className="text-2xl mb-1">{badge.icon}</div>
                  <p className="text-xs font-bold text-gray-700 leading-tight">{badge.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{badge.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop submit */}
          <div className="hidden md:block space-y-2">
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full text-xl py-5">
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  處理中，請稍候...
                </span>
              ) : `確認下單・${formatPrice(totalAmount)}`}
            </button>
            <p className="text-center text-sm text-gray-400">下單後如需修改，請透過 LINE 聯絡客服</p>
          </div>
        </div>

        {/* RIGHT: Sticky order summary (desktop) */}
        <div className="hidden md:block w-80 flex-shrink-0 order-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-24">
            <h2 className="font-bold text-gray-800 text-lg mb-4 pb-3 border-b border-gray-100">
              訂單明細（{totalItems} 件）
            </h2>
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {items.map(item => (
                <div key={item.variant_id} className="flex gap-3 items-start">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 relative flex-shrink-0">
                    {item.cover_image_url
                      ? <Image src={item.cover_image_url} alt={item.product_name} fill className="object-cover" sizes="56px" />
                      : <div className="w-full h-full flex items-center justify-center text-xl">💊</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm line-clamp-2 leading-snug">{item.product_name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{item.variant_name} × {item.quantity}</p>
                    <p className="text-green-700 font-bold text-sm mt-1">{formatPrice(item.unit_price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>商品合計</span><span>{formatPrice(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>取貨方式</span><span>7-11 門市取貨</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>付款方式</span><span className="text-green-700 font-bold">取貨付款</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-100">
                <span className="text-gray-900">應付金額</span>
                <span className="text-green-700">{formatPrice(totalAmount)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center leading-relaxed">
              📦 約 3 工作日送達 7-11<br />到店後 LINE 通知您
            </p>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom（疊在底部導覽列上方；鍵盤彈出時隱藏，避免蓋住輸入框） */}
      <div className={`fixed left-0 right-0 md:hidden bg-white border-t-2 border-gray-100 shadow-2xl z-40 ${inputFocused ? 'hidden' : ''}`}
        style={{ bottom: 'calc(60px + env(safe-area-inset-bottom))' }}>
        <div className="px-4 py-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600 font-semibold">應付金額</span>
            <span className="text-xl font-bold text-green-700">{formatPrice(totalAmount)}</span>
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full text-xl py-4">
            {submitting ? '處理中...' : '確認下單'}
          </button>
        </div>
      </div>

      {showStorePicker && (
        <StorePickerModal
          onClose={() => setShowStorePicker(false)}
          onSelect={store => { setSelectedStore(store); setShowStorePicker(false); setErrors(e => ({ ...e, store: '' })) }}
        />
      )}
    </div>
  )
}
