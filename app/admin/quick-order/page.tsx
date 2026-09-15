'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { ORDER_SOURCES } from '@/lib/quickOrder/domain'

/**
 * 後台代客下單。
 *
 * 流程刻意是兩步：貼上 → 確認 → 建立。
 * 貼上就直接成立訂單看起來更快，但比對錯一次就是寄錯東西給真實客戶，
 * 而且庫存已經扣掉了。中間這一步是故意留的。
 */

interface Candidate {
  product_id: number
  product_name: string
  cover_image_url: string | null
  variant_id: number
  variant_name: string
  sku_code: string | null
  unit_price: number
  stock_qty: number
  score: number
}

interface StoreCandidate {
  id: number
  store_code: string | null
  store_name: string
  county: string
  district: string
  address: string
  score?: number
}

interface DraftItem {
  key: string
  raw: string
  quantity: number
  selected: Candidate | null
  candidates: Candidate[]
  confident: boolean
}

interface CatalogVariant {
  id: number; variant_name: string; sale_price: number
  stock_qty: number; sku_code: string | null
}
interface CatalogProduct {
  id: number; product_name: string; cover_image_url: string | null
  product_variants: CatalogVariant[]
}

const SAMPLE = '張三 0972720032 慶平  20mg 葉黃素軟膠囊X2'

let keySeq = 0
const nextKey = () => `item_${++keySeq}`

export default function QuickOrderPage() {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [creating, setCreating] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [source, setSource] = useState<string>('line_dm')
  const [store, setStore] = useState<StoreCandidate | null>(null)
  const [storeCandidates, setStoreCandidates] = useState<StoreCandidate[]>([])
  const [items, setItems] = useState<DraftItem[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [parsed, setParsed] = useState(false)

  const [result, setResult] = useState<{ order_no: string; confirm_text: string; source_recorded: boolean } | null>(null)

  // 手動挑商品
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')

  // 換門市
  const [storeSearchOpen, setStoreSearchOpen] = useState(false)
  const [storeQuery, setStoreQuery] = useState('')
  const [storeResults, setStoreResults] = useState<StoreCandidate[]>([])
  const storeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/admin/quick-order/catalog')
      .then(r => r.json())
      .then(d => { if (d.success) setCatalog(d.data || []) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!storeSearchOpen) return
    if (storeTimer.current) clearTimeout(storeTimer.current)
    storeTimer.current = setTimeout(() => {
      const q = storeQuery.trim()
      if (!q) { setStoreResults([]); return }
      fetch(`/api/stores?limit=40&search=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(d => { if (d.success) setStoreResults(d.data || []) })
        .catch(() => {})
    }, 300)
    return () => { if (storeTimer.current) clearTimeout(storeTimer.current) }
  }, [storeQuery, storeSearchOpen])

  const reset = useCallback(() => {
    setText(''); setName(''); setPhone(''); setNote('')
    setStore(null); setStoreCandidates([]); setItems([])
    setWarnings([]); setParsed(false); setResult(null)
  }, [])

  const doParse = useCallback(async () => {
    if (!text.trim()) { toast.error('請先貼上訂單資訊'); return }
    setParsing(true)
    try {
      const res = await fetch('/api/admin/quick-order/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const d = await res.json()
      if (!d.success) { toast.error(d.error || '解析失敗'); return }

      const data = d.data
      setName(data.customer_name || '')
      setPhone(data.phone || '')
      setStore(data.store || null)
      setStoreCandidates(data.store_candidates || [])
      setItems((data.items || []).map((it: any) => ({
        key: nextKey(),
        raw: it.raw,
        quantity: it.quantity,
        selected: it.selected,
        candidates: it.candidates || [],
        confident: it.confident,
      })))
      setWarnings(data.warnings || [])
      setParsed(true)
    } catch {
      toast.error('解析失敗，請稍後再試')
    } finally {
      setParsing(false)
    }
  }, [text])

  const total = items.reduce(
    (s, i) => s + (i.selected ? i.selected.unit_price * i.quantity : 0), 0)

  const unresolved = items.filter(i => !i.selected).length
  const needsCheck = items.filter(i => i.selected && !i.confident).length
  const shortStock = items.filter(i => i.selected && i.selected.stock_qty < i.quantity)

  const canSubmit = parsed && name.trim() && /^09\d{8}$/.test(phone.trim())
    && store && items.length > 0 && unresolved === 0 && !creating

  const submit = async () => {
    if (!canSubmit) return
    if (shortStock.length > 0) {
      const names = shortStock.map(i => i.selected!.product_name).join('、')
      if (!confirm(`${names} 庫存不足，仍要建立訂單嗎？`)) return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/quick-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name.trim(),
          phone: phone.trim(),
          store_id: store!.id,
          note: note.trim(),
          source,
          items: items.filter(i => i.selected).map(i => ({
            product_id: i.selected!.product_id,
            variant_id: i.selected!.variant_id,
            quantity: i.quantity,
          })),
        }),
      })
      const d = await res.json()
      if (!d.success) { toast.error(d.error || '建立失敗'); return }
      setResult({
        order_no: d.data.order_no,
        confirm_text: d.data.confirm_text,
        source_recorded: d.data.source_recorded,
      })
      toast.success(`訂單 ${d.data.order_no} 已建立`)
    } catch {
      toast.error('建立失敗，請稍後再試')
    } finally {
      setCreating(false)
    }
  }

  const copyConfirm = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.confirm_text)
      toast.success('已複製，可以貼回 Line 了')
    } catch {
      toast.error('複製失敗，請手動選取')
    }
  }

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i))
  }

  const addFromCatalog = (p: CatalogProduct, v: CatalogVariant) => {
    const cand: Candidate = {
      product_id: p.id, product_name: p.product_name,
      cover_image_url: p.cover_image_url,
      variant_id: v.id, variant_name: v.variant_name,
      sku_code: v.sku_code, unit_price: v.sale_price,
      stock_qty: v.stock_qty, score: 2,
    }
    setItems(prev => {
      const hit = prev.find(i => i.selected?.variant_id === v.id)
      if (hit) {
        return prev.map(i => i.key === hit.key ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        key: nextKey(), raw: '', quantity: 1,
        selected: cand, candidates: [cand], confident: true,
      }]
    })
    setPickerOpen(false)
    setPickerQuery('')
    if (!parsed) setParsed(true)
  }

  const filteredCatalog = pickerQuery.trim()
    ? catalog.filter(p => p.product_name.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
    : catalog

  // ── 成功畫面 ────────────────────────────────────────────
  if (result) {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4">
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-2xl font-bold text-gray-900">訂單已建立</h1>
          <p className="text-gray-500 mt-1 font-mono text-lg">{result.order_no}</p>

          {!result.source_recorded && (
            <p className="mt-4 text-sm text-amber-800 bg-amber-50 rounded-xl p-3 text-left">
              訂單已成立，但來源沒有記錄成功。
              請確認 <code className="font-mono">migrations/orders_source.sql</code> 已在
              Supabase 執行過。
            </p>
          )}

          <div className="mt-6 text-left">
            <label className="form-label">貼回 Line 的確認訊息</label>
            <pre className="whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-xl p-4 text-[15px] leading-relaxed text-gray-800">
              {result.confirm_text}
            </pre>
            <button onClick={copyConfirm}
              className="btn-primary w-full mt-3 min-h-[52px]">
              📋 複製確認訊息
            </button>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={reset} className="btn-primary flex-1 min-h-[48px]">
              再下一筆
            </button>
            <a href="/admin/orders" className="btn-secondary flex-1 min-h-[48px] leading-[48px]">
              查看訂單
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── 主畫面 ──────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">⚡ 快速下單</h1>
        <p className="text-gray-500 text-sm mt-1">
          把 Line 上的訂單資訊貼進來，確認後建立訂單
        </p>
      </div>

      {/* 貼上區 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <label className="form-label">貼上訂單資訊</label>
        <textarea
          className="form-input font-mono text-[15px]"
          rows={4}
          placeholder={SAMPLE}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doParse()
          }}
        />
        <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
          順序：<b>姓名 → 手機 → 門市 → 商品規格與數量</b>。
          換行或空白分隔都可以，數量寫 <code className="font-mono">X2</code> 或
          <code className="font-mono"> 2瓶</code>。
        </p>
        <div className="flex gap-2 mt-3">
          <button onClick={doParse} disabled={parsing}
            className="btn-primary flex-1 min-h-[48px] disabled:opacity-50">
            {parsing ? '解析中…' : '解析'}
          </button>
          <button onClick={() => setText(SAMPLE)}
            className="btn-secondary px-4 min-h-[48px] text-sm">
            填入範例
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="font-bold text-amber-900 text-sm mb-1">請確認</p>
          <ul className="text-amber-800 text-sm space-y-0.5 list-disc pl-5">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {parsed && (
        <>
          {/* 收件人 */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-900">收件人</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">姓名</label>
                <input className="form-input" value={name}
                  onChange={e => setName(e.target.value)} placeholder="收件人姓名" />
              </div>
              <div>
                <label className="form-label">手機</label>
                <input className="form-input font-mono" value={phone}
                  onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxxx" />
                {phone && !/^09\d{8}$/.test(phone.trim()) && (
                  <p className="text-red-600 text-[13px] mt-1">格式不正確（09 開頭 10 碼）</p>
                )}
              </div>
            </div>

            {/* 門市 */}
            <div>
              <label className="form-label">7-11 取貨門市</label>
              {store ? (
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-green-900">{store.store_name}</p>
                    <p className="text-green-700 text-sm">{store.county}{store.district}</p>
                    <p className="text-gray-500 text-[13px] mt-0.5 truncate">{store.address}</p>
                  </div>
                  <button onClick={() => { setStoreSearchOpen(true); setStoreQuery('') }}
                    className="text-green-700 text-sm font-bold underline shrink-0">換一間</button>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-amber-900 text-sm font-bold mb-2">
                    {storeCandidates.length > 0 ? '有多間相似門市，請選一間' : '尚未選擇門市'}
                  </p>
                  <div className="space-y-1">
                    {storeCandidates.map(s => (
                      <button key={s.id} onClick={() => setStore(s)}
                        className="w-full text-left p-2.5 rounded-lg bg-white hover:bg-green-50 border border-gray-200">
                        <span className="font-bold text-gray-800">{s.store_name}</span>
                        <span className="text-gray-500 text-sm ml-2">{s.county}{s.district}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { setStoreSearchOpen(true); setStoreQuery('') }}
                    className="btn-secondary w-full mt-2 min-h-[44px] text-sm">
                    🔍 搜尋其他門市
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 商品 */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">商品</h2>
              <button onClick={() => setPickerOpen(true)}
                className="text-green-700 text-sm font-bold">＋ 手動加商品</button>
            </div>

            {items.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">
                還沒有商品，可以按上面的「手動加商品」
              </p>
            )}

            <div className="space-y-3">
              {items.map(item => (
                <div key={item.key}
                  className={`rounded-xl border p-3 ${
                    !item.selected ? 'border-red-300 bg-red-50'
                      : !item.confident ? 'border-amber-300 bg-amber-50'
                      : 'border-gray-200'}`}>
                  {item.raw && (
                    <p className="text-[13px] text-gray-500 mb-1.5">
                      原文：<span className="font-mono">{item.raw}</span>
                    </p>
                  )}

                  {item.selected ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 leading-snug">
                            {item.selected.product_name}
                          </p>
                          <p className="text-gray-600 text-sm">
                            {item.selected.variant_name}
                            　NT${item.selected.unit_price.toLocaleString('en-US')}
                          </p>
                          {item.selected.stock_qty < item.quantity && (
                            <p className="text-red-600 text-[13px] font-bold mt-1">
                              ⚠️ 庫存只剩 {item.selected.stock_qty}
                            </p>
                          )}
                          {!item.confident && (
                            <p className="text-amber-800 text-[13px] mt-1">
                              不太確定是不是這個，請確認
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateItem(item.key,
                            { quantity: Math.max(1, item.quantity - 1) })}
                            className="w-9 h-9 rounded-lg border border-gray-300 text-lg">−</button>
                          <span className="w-9 text-center font-bold">{item.quantity}</span>
                          <button onClick={() => updateItem(item.key,
                            { quantity: Math.min(999, item.quantity + 1) })}
                            className="w-9 h-9 rounded-lg border border-gray-300 text-lg">＋</button>
                        </div>
                      </div>

                      {item.candidates.length > 1 && (
                        <select
                          className="form-input mt-2 text-sm"
                          value={item.selected.variant_id}
                          onChange={e => {
                            const v = Number(e.target.value)
                            const c = item.candidates.find(x => x.variant_id === v)
                            if (c) updateItem(item.key, { selected: c, confident: true })
                          }}>
                          {item.candidates.map(c => (
                            <option key={c.variant_id} value={c.variant_id}>
                              {c.product_name}　{c.variant_name}　NT${c.unit_price}
                            </option>
                          ))}
                        </select>
                      )}
                    </>
                  ) : (
                    <div>
                      <p className="text-red-700 text-sm font-bold">
                        找不到對應商品，請手動選擇
                      </p>
                      <button onClick={() => { setPickerOpen(true); setPickerQuery(item.raw) }}
                        className="btn-secondary w-full mt-2 min-h-[44px] text-sm">
                        🔍 挑一個商品
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setItems(prev => prev.filter(i => i.key !== item.key))}
                    className="text-gray-400 hover:text-red-600 text-[13px] mt-2">
                    移除這項
                  </button>
                </div>
              ))}
            </div>

            {items.length > 0 && (
              <div className="flex justify-between items-baseline mt-4 pt-3 border-t border-gray-100">
                <span className="text-gray-600">合計（貨到付款）</span>
                <span className="text-2xl font-bold text-green-700">
                  NT${total.toLocaleString('en-US')}
                </span>
              </div>
            )}
          </div>

          {/* 來源與備註 */}
          <div className="bg-white rounded-2xl shadow-sm p-5 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">訂單來源</label>
              <select className="form-input" value={source}
                onChange={e => setSource(e.target.value)}>
                {ORDER_SOURCES.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
              <p className="text-[13px] text-gray-500 mt-1">
                之後要看「廣告帶來幾筆訂單」就靠這一欄
              </p>
            </div>
            <div>
              <label className="form-label">備註（選填）</label>
              <input className="form-input" value={note} maxLength={200}
                onChange={e => setNote(e.target.value)}
                placeholder="例：客戶指定週三後再出貨" />
            </div>
          </div>

          {/* 送出 */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            {(unresolved > 0 || needsCheck > 0) && (
              <p className="text-sm mb-3 text-gray-700">
                {unresolved > 0 && <span className="text-red-600 font-bold">還有 {unresolved} 項商品沒有選定。</span>}
                {needsCheck > 0 && <span className="text-amber-700"> 有 {needsCheck} 項是猜的，送出前請確認。</span>}
              </p>
            )}
            <button onClick={submit} disabled={!canSubmit}
              className="btn-primary w-full min-h-[56px] text-lg disabled:opacity-40">
              {creating ? '建立中…' : `建立訂單　NT$${total.toLocaleString('en-US')}`}
            </button>
          </div>
        </>
      )}

      {/* 商品選擇器 */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col"
            style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-lg">選擇商品</h3>
              <button onClick={() => setPickerOpen(false)}
                className="w-10 h-10 rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <input className="form-input" autoFocus placeholder="🔍 搜尋商品名稱"
                value={pickerQuery} onChange={e => setPickerQuery(e.target.value)} />
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              {filteredCatalog.length === 0 && (
                <p className="text-center text-gray-500 py-8">找不到商品</p>
              )}
              {filteredCatalog.map(p => (
                <div key={p.id}>
                  <p className="font-bold text-gray-800 text-sm mb-1">{p.product_name}</p>
                  <div className="space-y-1">
                    {p.product_variants.map(v => (
                      <button key={v.id} onClick={() => addFromCatalog(p, v)}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg border border-gray-200 hover:bg-green-50 text-left">
                        <span className="text-gray-700 text-sm">{v.variant_name}</span>
                        <span className="text-sm shrink-0">
                          <span className="font-bold text-green-700">NT${v.sale_price.toLocaleString('en-US')}</span>
                          <span className={`ml-2 ${v.stock_qty > 0 ? 'text-gray-400' : 'text-red-500'}`}>
                            庫存 {v.stock_qty}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 門市搜尋 */}
      {storeSearchOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col"
            style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-lg">搜尋 7-11 門市</h3>
              <button onClick={() => setStoreSearchOpen(false)}
                className="w-10 h-10 rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <input className="form-input" autoFocus placeholder="🔍 門市名稱或地址"
                value={storeQuery} onChange={e => setStoreQuery(e.target.value)} />
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {storeResults.length === 0 && storeQuery.trim() && (
                <p className="text-center text-gray-500 py-8">找不到門市</p>
              )}
              {storeResults.map(s => (
                <button key={s.id}
                  onClick={() => { setStore(s); setStoreSearchOpen(false) }}
                  className="w-full text-left p-3 rounded-xl hover:bg-green-50">
                  <p className="font-bold text-gray-800">{s.store_name}</p>
                  <p className="text-green-600 text-sm">{s.county}{s.district}</p>
                  <p className="text-gray-500 text-[13px] truncate">{s.address}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
