'use client'
import { useState, useEffect, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/components/front/CartContext'
import { useUserAuth } from '@/components/front/UserAuthContext'
import { formatPrice, validateTWPhone } from '@/lib/utils'
import { recipientNameError, suggestRecipientName } from '@/lib/recipientName'
import { getStoredRef } from '@/components/front/referral/referralClient'
import StorePickerModal, { Store } from '@/components/front/StorePickerModal'
import { trackFunnel } from '@/lib/funnel'
import { splitPackages, type ShipGroups } from '@/lib/shipPackages'
import { CheckoutPackages, type PackageLine } from '@/components/front/ShipPackages'
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

  // 手機版訂單商品摘要：預設收起（縮圖＋件數＋金額一眼可見），點「明細」展開逐項，讓姓名／手機／門市不需下拉即可看到
  const [showItems, setShowItems] = useState(false)

  // 現貨＋預購會從兩個賣貨便賣場分兩包寄、分兩次付款：查出每個規格屬於哪一包，下單前就講清楚
  const [shipGroups, setShipGroups] = useState<ShipGroups>({})
  const variantKey = items.map(i => i.variant_id).sort((a, b) => a - b).join(',')
  useEffect(() => {
    if (!variantKey.includes(',')) { setShipGroups({}); return }
    let alive = true
    fetch('/api/shipping/packages?v=' + variantKey).then(r => r.json())
      .then(d => { if (alive && d.success) setShipGroups(d.data || {}) }).catch(() => {})
    return () => { alive = false }
  }, [variantKey])

  // 收件人已確認（會員資料帶入、或選了常用收件人）時收成一張小卡，按「修改」才展開表單；
  // 訪客邊打字邊收起會嚇到人，所以只在這兩種情況才收
  const [recipientLocked, setRecipientLocked] = useState(false)
  const [showAddressList, setShowAddressList] = useState(false)
  const [showNote, setShowNote] = useState(false)


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

  // "上次選擇的門市" — 依手機號查到後「直接帶入」為已選門市（可更換），避免使用者以為已選卻未實際選取而卡在驗證
  const [storeFromLast, setStoreFromLast] = useState(false)

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
        if (!recipientNameError(p.name || '') && validateTWPhone(p.phone || '')) setRecipientLocked(true)
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

  // Detect "last used store" by phone — 查到後直接帶入為已選門市（可更換）
  useEffect(() => {
    if (selectedStore || !validateTWPhone(form.phone)) return
    const t = setTimeout(() => {
      fetch('/api/orders?phone=' + encodeURIComponent(form.phone.trim()))
        .then(r => r.json())
        .then(d => {
          const last = d.success ? d.data?.[0] : null
          if (last?.store_id && last?.store_name) {
            setSelectedStore({ id: last.store_id, store_name: last.store_name, address: last.store_address, county: last.county, district: last.district })
            setStoreFromLast(true)
            setErrors(e => ({ ...e, store: '' }))
          }
        })
        .catch(() => {})
    }, 500)
    return () => clearTimeout(t)
  }, [form.phone, selectedStore])

  const applyAddress = (addr: any) => {
    setForm(f => ({ ...f, customer_name: addr.recipient_name, phone: addr.phone, line_id: addr.line_id || '' }))
    setSelectedStore({ id: addr.store_id, store_name: addr.store_name, address: addr.store_address, county: addr.store_county, district: addr.store_district })
    setStoreFromLast(false)
    setRecipientLocked(!recipientNameError(addr.recipient_name || '') && validateTWPhone(addr.phone || ''))
    setShowAddressList(false)
    setErrors({})
  }

  const validate = () => {
    const e: Record<string, string> = {}
    const nameProblem = recipientNameError(form.customer_name)
    if (nameProblem) e.customer_name = nameProblem
    if (!form.phone || !validateTWPhone(form.phone)) e.phone = '請填寫正確手機號碼（09xxxxxxxx）'
    if (!selectedStore) e.store = '請選擇 7-11 取貨門市'
    setErrors(e)
    return e
  }

  const handleSubmit = async () => {
    trackFunnel('submit_click')
    const e = validate()
    const firstKey = Object.keys(e)[0]
    if (firstKey) {
      // 明確指出缺少的欄位，並捲動到該欄位，避免使用者不知道哪裡沒填
      trackFunnel('submit_fail', { reason: firstKey })
      toast.error(e[firstKey])
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (items.length === 0) { trackFunnel('submit_fail', { reason: 'empty_cart' }); toast.error('購物車是空的'); return }
    setSubmitting(true)
    try {
      // 一律用 authedFetch：它在沒有 session 時就是普通 fetch，
      // 但可以避免「session 還在載入、user 暫時是 null」時把訂單送成訪客單，
      // 那會讓這筆訂單永遠不會出現在「我的訂單」。
      const res = await authedFetch('/api/orders', {
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
          // 朋友的推薦連結點進來的：記上推薦碼
          ref: getStoredRef(),
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
        trackFunnel('order_success', { order_no: data.data?.order_no })
        clearCart()
        router.push(`/order-success?order_no=${data.data.order_no}`)
      } else {
        trackFunnel('submit_fail', { reason: 'api', error: (data.error || '').toString().slice(0, 120) })
        toast.error(data.error || '下單失敗，請稍後再試')
      }
    } catch {
      trackFunnel('submit_fail', { reason: 'network' })
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
  const recipientValid = !recipientNameError(form.customer_name) && validateTWPhone(form.phone)
  const recipientCollapsed = recipientLocked && recipientValid
  const visibleItems = showItems ? items : items.slice(0, 3)
  const packages = splitPackages<PackageLine & { variant_id: number }>(items.map(i => ({
    key: i.variant_id, variant_id: i.variant_id, name: i.product_name, variant: i.variant_name,
    quantity: i.quantity, subtotal: i.unit_price * i.quantity, image: i.cover_image_url,
  })), shipGroups)

  return (
    <div className="max-w-5xl mx-auto px-4 pt-14 md:pt-8 pb-28 md:pb-10">
      <h1 className="text-2xl font-bold text-gray-900">確認訂單</h1>
      <CheckoutSteps />

      <div className="flex flex-col md:flex-row gap-6">
        {/* LEFT: Form */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ① 收件人 */}
          <Section n={1} title="收件人" id="field-recipient">
            {recipientCollapsed ? (
              <>
                <div className="flex items-start justify-between gap-3 rounded-xl border-2 border-green-200 bg-green-50/60 p-4">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-gray-900">{form.customer_name}</p>
                    <p className="mt-0.5 text-[15px] text-gray-700 tabular-nums">{prettyPhone(form.phone)}</p>
                    {form.line_id && <p className="mt-0.5 text-[13px] text-gray-500">LINE ID：{form.line_id}</p>}
                  </div>
                  <button type="button" onClick={() => setRecipientLocked(false)}
                    className="flex-shrink-0 rounded-lg border-2 border-green-300 bg-white px-3 py-1.5 text-sm font-bold text-green-700 hover:bg-green-100">
                    修改
                  </button>
                </div>
                <p className="mt-2 text-[13px] text-gray-500">7-11 取貨時，報這個姓名或手機號碼即可</p>
              </>
            ) : (
              <div className="space-y-4">
                <div id="field-customer_name" className="scroll-mt-24">
                  <label className="form-label">取件人姓名 <span className="text-red-500">*</span></label>
                  <input
                    className={`form-input ${errors.customer_name ? 'border-red-400 bg-red-50' : ''}`}
                    placeholder="例如：王小明" autoComplete="name"
                    value={form.customer_name}
                    onChange={e => { setForm(f => ({ ...f, customer_name: e.target.value })); setErrors(er => ({ ...er, customer_name: '' })) }}
                    // 離開欄位就先檢查：「鄭景耀,」這種多打一個符號的，當下就提醒
                    onBlur={() => { if (form.customer_name.trim()) setErrors(er => ({ ...er, customer_name: recipientNameError(form.customer_name) || '' })) }}
                  />
                  {errors.customer_name ? (
                    <div className="mt-1.5">
                      <p className="text-red-600 text-sm">⚠️ {errors.customer_name}</p>
                      {suggestRecipientName(form.customer_name) && (
                        <button type="button"
                          onClick={() => { setForm(f => ({ ...f, customer_name: suggestRecipientName(f.customer_name) || f.customer_name })); setErrors(er => ({ ...er, customer_name: '' })) }}
                          className="mt-1.5 rounded-lg border border-green-600 bg-green-50 px-3 py-1.5 text-sm font-bold text-green-800">
                          改成「{suggestRecipientName(form.customer_name)}」
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-[13px] mt-1.5">請填真實姓名，7-11 取貨時會核對（不要加符號或稱謂）</p>
                  )}
                </div>
                <div id="field-phone" className="scroll-mt-24">
                  <label className="form-label">手機號碼 <span className="text-red-500">*</span></label>
                  <input
                    className={`form-input tabular-nums ${errors.phone ? 'border-red-400 bg-red-50' : ''}`}
                    type="tel" inputMode="numeric" autoComplete="tel" placeholder="0912345678"
                    value={form.phone}
                    onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: '' })) }}
                  />
                  {errors.phone
                    ? <p className="text-red-600 text-sm mt-1.5">⚠️ {errors.phone}</p>
                    : <p className="text-gray-500 text-[13px] mt-1.5">之後用這支手機就能查訂單進度</p>
                  }
                </div>
                <div>
                  <label className="form-label">LINE ID <span className="text-gray-500 font-normal text-sm">（選填，方便客服聯絡您）</span></label>
                  <input className="form-input" placeholder="選填"
                    value={form.line_id} onChange={e => setForm(f => ({ ...f, line_id: e.target.value }))} />
                </div>
                {user && (
                  <label className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded accent-green-700"
                      checked={saveAsAddress} onChange={e => setSaveAsAddress(e.target.checked)} />
                    存成常用收件人，下次結帳一鍵帶入
                  </label>
                )}
              </div>
            )}

            {/* 會員的常用收件人（含門市），點一下整組帶入 */}
            {user && savedAddresses.length > 0 && (
              <div className="mt-3">
                <button type="button" onClick={() => setShowAddressList(s => !s)} aria-expanded={showAddressList}
                  className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-[15px] font-bold text-gray-700 hover:border-green-300 hover:bg-green-50">
                  <span>⭐ 從常用收件人選擇（{savedAddresses.length}）</span>
                  <svg className={`w-4 h-4 text-gray-500 transition-transform ${showAddressList ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showAddressList && (
                  <ul className="mt-2 space-y-2">
                    {savedAddresses.map(addr => {
                      const current = recipientCollapsed && addr.recipient_name === form.customer_name && addr.phone === form.phone && addr.store_id === selectedStore?.id
                      return (
                        <li key={addr.id}>
                          <button type="button" onClick={() => applyAddress(addr)}
                            className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${current ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-green-300'}`}>
                            <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${current ? 'border-green-600' : 'border-gray-300'}`} aria-hidden>
                              {current && <span className="h-2.5 w-2.5 rounded-full bg-green-600" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-bold text-gray-900">
                                {addr.label ? `${addr.label}・` : ''}{addr.recipient_name} <span className="font-normal tabular-nums text-gray-600">{prettyPhone(addr.phone)}</span>
                                {addr.is_default && <span className="ml-1.5 rounded bg-green-100 px-1.5 py-0.5 text-[12px] font-bold text-green-800">預設</span>}
                              </span>
                              <span className="mt-0.5 block truncate text-[13px] text-gray-500">7-11 {storeLabel(addr.store_name)}（{addr.store_county}{addr.store_district}）</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </Section>

          {/* ② 取貨門市 */}
          <Section n={2} title="7-11 取貨門市" id="field-store">
            {selectedStore ? (
              <>
                {storeFromLast && (
                  <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">💡 已帶入您上次取貨的門市，要換請按「更換」</p>
                )}
                <div className="flex items-start gap-3 rounded-xl border-2 border-green-200 bg-green-50/60 p-4">
                  <span className="mt-0.5 flex-shrink-0 rounded-md bg-orange-500 px-1.5 py-0.5 text-[12px] font-bold text-white">7-11</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold leading-snug text-gray-900">{storeLabel(selectedStore.store_name)}</p>
                    <p className="mt-0.5 text-sm font-semibold text-green-700">{selectedStore.county}{selectedStore.district}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{selectedStore.address}</p>
                  </div>
                  <button type="button" onClick={() => setShowStorePicker(true)}
                    className="flex-shrink-0 rounded-lg border-2 border-green-300 bg-white px-3 py-1.5 text-sm font-bold text-green-700 hover:bg-green-100">
                    更換
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => setShowStorePicker(true)}
                className={`w-full rounded-xl border-2 border-dashed px-4 py-5 text-left transition-colors
                  ${errors.store ? 'border-red-400 bg-red-50' : 'border-green-300 bg-green-50/40 hover:bg-green-50'}`}>
                <span className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden>📍</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-base font-bold ${errors.store ? 'text-red-600' : 'text-green-800'}`}>點這裡選擇取貨門市</span>
                    <span className="mt-0.5 block text-sm text-gray-600">輸入路名、地區或門市名稱就能找到</span>
                  </span>
                  <span className="text-xl text-green-700" aria-hidden>›</span>
                </span>
              </button>
            )}
            {errors.store && <p className="text-red-600 text-sm mt-2">⚠️ {errors.store}</p>}
          </Section>

          {/* ③ 付款方式 */}
          <Section n={3} title="付款方式">
            <div className="flex items-start gap-3 rounded-xl border-2 border-green-500 bg-green-50/60 p-4">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-green-600" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-base font-bold text-gray-900">
                  7-11 取貨付款
                  <span className="rounded bg-green-700 px-1.5 py-0.5 text-[12px] font-bold text-white">不用先付錢</span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">到門市取貨時再付款，可用現金、悠遊卡、icash、LINE Pay</p>
              </div>
            </div>
            <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-gray-700">
              <li className="flex gap-2.5"><span aria-hidden>🚚</span><span><b>到貨時間</b>：現貨約 3 個工作日、預購約 7 個工作日送到門市</span></li>
              <li className="flex gap-2.5"><span aria-hidden>📩</span><span><b>到店通知</b>：7-11 會傳簡訊給您，請在 7 天內取貨</span></li>
            </ul>
          </Section>

          {/* 訂單明細（手機；電腦版在右側） */}
          <section className="md:hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-bold text-gray-900">訂單明細<span className="ml-1.5 text-base font-semibold text-gray-500">（{totalItems} 件）</span></h2>
            {packages ? <CheckoutPackages packages={packages} /> : <>
            <ul className="divide-y divide-gray-100">
              {visibleItems.map(item => (
                <li key={item.variant_id} className="flex items-center gap-3 py-2.5">
                  <ItemThumb item={item} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-gray-800">{item.product_name}</p>
                    <p className="mt-0.5 text-[13px] text-gray-500">{item.variant_name}・{formatPrice(item.unit_price)} × {item.quantity}</p>
                  </div>
                  <p className="flex-shrink-0 font-bold text-gray-900 tabular-nums">{formatPrice(item.unit_price * item.quantity)}</p>
                </li>
              ))}
            </ul>
            {items.length > 3 && (
              <button type="button" onClick={() => setShowItems(s => !s)}
                className="mt-1 w-full rounded-lg py-2 text-sm font-bold text-green-700 hover:bg-green-50">
                {showItems ? '收起' : `看全部 ${items.length} 樣商品`}
              </button>
            )}
            </>}
            <AmountBreakdown totalItems={totalItems} totalAmount={totalAmount} parts={packages?.length} />
          </section>

          {/* 備註：多數人用不到，收起來 */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            {showNote || form.note ? (
              <div className="p-4">
                <label className="form-label">給我們的備註 <span className="text-gray-500 font-normal text-sm">（選填）</span></label>
                <textarea className="form-input" rows={3} placeholder="例如：希望和上一筆訂單一起寄" autoFocus={showNote && !form.note}
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            ) : (
              <button type="button" onClick={() => setShowNote(true)} className="flex w-full items-center gap-2 px-4 py-3.5 text-[15px] font-bold text-gray-600 hover:text-green-700">
                <span className="text-lg leading-none text-green-700" aria-hidden>＋</span>給我們的備註（選填）
              </button>
            )}
          </div>

          {/* 下單按鈕：電腦版放在內文；手機版用底部固定條（往下捲一直看得到），這裡只留說明 */}
          <div className="space-y-2.5 pt-1">
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary hidden w-full text-xl py-5 md:flex">
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
            <p className="text-center text-[13px] leading-relaxed text-gray-500">
              現在不會扣款，到 7-11 取貨時才付款<br />下單後要修改，請 LINE 聯絡客服
            </p>
          </div>

          {/* 安心保障 */}
          <ul className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: '🔒', title: '資料加密', desc: '個資安全保護' },
              { icon: '🔄', title: '7 天鑑賞期', desc: '未拆封可退換' },
              { icon: '💬', title: 'LINE 客服', desc: '專人回覆' },
            ].map(b => (
              <li key={b.title} className="rounded-xl bg-white/70 px-1 py-2.5">
                <p className="text-xl" aria-hidden>{b.icon}</p>
                <p className="mt-0.5 text-[13px] font-bold text-gray-700">{b.title}</p>
                <p className="text-[12px] text-gray-500">{b.desc}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT: Sticky order summary (desktop) */}
        <div className="hidden md:block w-80 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-24">
            <h2 className="font-bold text-gray-800 text-lg mb-3 pb-3 border-b border-gray-100">
              訂單明細（{totalItems} 件）
            </h2>
            {packages ? <div className="mb-2"><CheckoutPackages packages={packages} compact /></div> : (
            <div className="space-y-3 mb-2 max-h-72 overflow-y-auto">
              {items.map(item => (
                <div key={item.variant_id} className="flex gap-3 items-start">
                  <ItemThumb item={item} size={56} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm line-clamp-2 leading-relaxed">{item.product_name}</p>
                    <p className="text-gray-500 text-[13px] mt-0.5">{item.variant_name} × {item.quantity}</p>
                    <p className="text-gray-900 font-bold text-sm mt-1">{formatPrice(item.unit_price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
            )}
            <AmountBreakdown totalItems={totalItems} totalAmount={totalAmount} parts={packages?.length} />
            <p className="text-[13px] text-gray-500 mt-3 text-center leading-relaxed">
              {packages ? <>📦 分 {packages.length} 個包裹寄出，各自到店、各自付款</> : <>📦 約 3 個工作日送到 7-11</>}<br />到店後 7-11 會傳簡訊通知您
            </p>
          </div>
        </div>
      </div>

      {/* 手機底部固定條：金額＋下單同一列，捲到哪都在（疊在底部導覽列上方；只有鍵盤彈出時隱藏，避免蓋住輸入框） */}
      <div className={`fixed left-0 right-0 md:hidden bg-white border-t border-gray-200 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] z-40 ${inputFocused ? 'hidden' : ''}`}
        style={{ bottom: 'calc(60px + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-gray-500">{packages ? `分 ${packages.length} 包・各自取貨付款` : '應付金額・取貨時付款'}</p>
            <p className="text-xl font-bold leading-tight text-green-700 tabular-nums">{formatPrice(totalAmount)}</p>
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-shrink-0 px-7 py-3.5 text-lg">
            {submitting ? '處理中...' : '確認下單'}
          </button>
        </div>
      </div>

      {showStorePicker && (
        <StorePickerModal
          onClose={() => setShowStorePicker(false)}
          onSelect={store => { setSelectedStore(store); setStoreFromLast(false); setShowStorePicker(false); setErrors(e => ({ ...e, store: '' })) }}
        />
      )}
    </div>
  )
}

const prettyPhone = (p: string) => {
  const d = p.trim()
  return /^09\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}` : d
}
const storeLabel = (name: string | null | undefined) => (!name ? '' : name.endsWith('門市') || name.endsWith('店') ? name : `${name}門市`)

/** 結帳三步驟：購物車 ✓ → 填寫資料（目前） → 完成 */
function CheckoutSteps() {
  const steps = ['購物車', '填寫資料', '下單完成']
  return (
    <ol className="mx-auto mb-5 mt-3 flex max-w-md items-start" aria-label="結帳步驟">
      {steps.map((label, i) => (
        <li key={label} className="relative flex flex-1 flex-col items-center text-center" aria-current={i === 1 ? 'step' : undefined}>
          {i > 0 && <span className={`absolute right-1/2 top-[13px] h-[3px] w-full -translate-y-1/2 ${i <= 1 ? 'bg-green-600' : 'bg-gray-200'}`} aria-hidden />}
          <span className={`relative z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full text-[13px] font-bold
            ${i < 1 ? 'bg-green-600 text-white' : i === 1 ? 'bg-green-600 text-white ring-4 ring-green-100' : 'bg-gray-200 text-gray-500'}`}>
            {i < 1 ? '✓' : i + 1}
          </span>
          <span className={`mt-1.5 text-[13px] ${i === 1 ? 'font-bold text-green-800' : 'text-gray-500'}`}>{label}</span>
        </li>
      ))}
    </ol>
  )
}

function Section({ n, title, id, children }: { n: number; title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold text-gray-900">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-700 text-[14px] font-bold text-white" aria-hidden>{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function ItemThumb({ item, size }: { item: { cover_image_url?: string | null; product_name: string }; size: number }) {
  return (
    <div className="relative flex-shrink-0 overflow-hidden rounded-xl bg-gray-100" style={{ width: size, height: size }}>
      {item.cover_image_url
        ? <Image src={item.cover_image_url} alt={item.product_name} fill className="object-cover" sizes={`${size}px`} />
        : <div className="flex h-full w-full items-center justify-center text-xl">💊</div>}
    </div>
  )
}

function AmountBreakdown({ totalItems, totalAmount, parts }: { totalItems: number; totalAmount: number; parts?: number }) {
  return (
    <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-3">
      <div className="flex justify-between text-[15px] text-gray-600">
        <span>商品小計（{totalItems} 件）</span><span className="tabular-nums">{formatPrice(totalAmount)}</span>
      </div>
      <div className="flex justify-between text-[15px] text-gray-600">
        <span>運費</span><span className="font-bold text-green-700">免運</span>
      </div>
      <div className="flex items-baseline justify-between border-t border-gray-100 pt-2">
        <span className="text-base font-bold text-gray-900">應付金額{parts ? `（${parts} 包合計）` : ''}</span>
        <span className="text-2xl font-bold text-green-700 tabular-nums">{formatPrice(totalAmount)}</span>
      </div>
      <p className="text-right text-[13px] text-gray-500">{parts ? '每包到店時分別付款' : '到 7-11 取貨時付款'}</p>
    </div>
  )
}
