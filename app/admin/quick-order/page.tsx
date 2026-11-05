'use client'
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { ORDER_SOURCES } from '@/lib/quickOrder/domain'
import { searchCatalog } from '@/lib/quickOrder/pickerSearch'

/**
 * 後台代客下單。
 *
 * 流程刻意是兩步：貼上 → 確認 → 建立。
 * 貼上就直接成立訂單看起來更快，但比對錯一次就是寄錯東西給真實客戶，
 * 而且庫存已經扣掉了。中間這一步是故意留的。
 *
 * 手機上操作為主：貼上可以一鍵從剪貼簿貼、貼進去就自動解析；
 * 選商品、選門市用全螢幕面板，搜尋框在上、結果緊接在下，鍵盤不會把結果蓋住。
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
const money = (n: number) => `NT$${n.toLocaleString('en-US')}`

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

  // 手動挑商品；pickerFor 是要替換的那一項（找不到對應商品的那項），沒有就是新增一項
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  // 換門市
  const [storeSearchOpen, setStoreSearchOpen] = useState(false)
  const [storeQuery, setStoreQuery] = useState('')
  const [storeResults, setStoreResults] = useState<StoreCandidate[]>([])
  const storeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const textRef = useRef<HTMLTextAreaElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

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
    window.scrollTo({ top: 0 })
  }, [])

  const doParse = useCallback(async (input?: string) => {
    const body = (input ?? text)
    if (!body.trim()) { toast.error('請先貼上訂單資訊'); return }
    setParsing(true)
    try {
      const res = await fetch('/api/admin/quick-order/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
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
      // 解析完直接捲到結果，不用自己往下找
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch {
      toast.error('解析失敗，請稍後再試')
    } finally {
      setParsing(false)
    }
  }, [text])

  // 一鍵從剪貼簿貼上並解析；瀏覽器不允許讀剪貼簿時，改成請使用者長按輸入框貼上
  const pasteFromClipboard = async () => {
    try {
      const clip = (await navigator.clipboard.readText()).trim()
      if (!clip) { toast.error('剪貼簿是空的，請先到 LINE 複製訂單訊息'); return }
      setText(clip)
      doParse(clip)
    } catch {
      textRef.current?.focus()
      toast('請長按下面的框框 →「貼上」', { icon: '👇' })
    }
  }

  const total = items.reduce(
    (s, i) => s + (i.selected ? i.selected.unit_price * i.quantity : 0), 0)

  const unresolved = items.filter(i => !i.selected).length
  const needsCheck = items.filter(i => i.selected && !i.confident).length
  const shortStock = items.filter(i => i.selected && i.selected.stock_qty < i.quantity)
  const phoneOk = /^09\d{8}$/.test(phone.trim())

  const canSubmit = parsed && name.trim() && phoneOk
    && store && items.length > 0 && unresolved === 0 && !creating

  // 底部按鈕上直接寫還差什麼，不用自己找哪裡沒填
  const missing = !parsed ? '' : !name.trim() ? '請填收件人姓名'
    : !phoneOk ? '手機格式不正確' : !store ? '請選取貨門市'
    : items.length === 0 ? '請加入商品' : unresolved > 0 ? `還有 ${unresolved} 項商品沒選定` : ''

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
      window.scrollTo({ top: 0 })
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

  const openPicker = (forKey: string | null, query = '') => {
    setPickerFor(forKey); setPickerQuery(query); setPickerOpen(true)
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
      // 從「找不到對應商品」那一項點進來的：直接換掉那一項（保留原本的數量）
      if (pickerFor && prev.some(i => i.key === pickerFor)) {
        return prev.map(i => i.key === pickerFor ? { ...i, selected: cand, candidates: [cand], confident: true } : i)
      }
      const hit = prev.find(i => i.selected?.variant_id === v.id)
      if (hit) {
        return prev.map(i => i.key === hit.key ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        key: nextKey(), raw: '', quantity: 1,
        selected: cand, candidates: [cand], confident: true,
      }]
    })
    toast.success(`已加入：${p.product_name}`)
    setPickerOpen(false)
    setPickerQuery('')
    setPickerFor(null)
    if (!parsed) setParsed(true)
  }

  const filteredCatalog = searchCatalog(catalog, pickerQuery)

  // ── 成功畫面 ────────────────────────────────────────────
  if (result) {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4">
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✅</div>
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
            <p className="form-label">貼回 Line 的確認訊息</p>
            <pre className="whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-xl p-4 text-[15px] leading-relaxed text-gray-800">
              {result.confirm_text}
            </pre>
            <button onClick={copyConfirm}
              className="btn-primary w-full mt-3 min-h-[56px] text-lg">
              📋 複製確認訊息
            </button>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={reset} className="btn-secondary flex-1 min-h-[52px]">
              ⚡ 再下一筆
            </button>
            <a href="/admin/orders" className="btn-secondary flex-1 min-h-[52px]">
              查看訂單
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── 主畫面 ──────────────────────────────────────────────
  return (
    <div className={`max-w-3xl mx-auto px-4 pt-5 space-y-4 ${parsed ? 'pb-32' : 'pb-8'}`}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">⚡ 快速下單</h1>
        <p className="text-gray-500 text-sm mt-1">複製 LINE 上的訂單訊息 → 貼上 → 確認 → 建立</p>
      </div>

      {/* ① 貼上 */}
      <Card step={1} title="貼上訂單訊息">
        <button onClick={pasteFromClipboard} disabled={parsing}
          className="btn-primary w-full min-h-[56px] text-lg disabled:opacity-50">
          {parsing ? '解析中…' : '📋 貼上並自動解析'}
        </button>
        <p className="mt-2 text-center text-[13px] text-gray-500">先在 LINE 長按訊息 →「複製」，再按上面的按鈕</p>

        <div className="relative mt-4">
          <textarea
            ref={textRef}
            className="form-input font-mono text-[15px]"
            rows={4}
            placeholder={`也可以直接貼在這裡，貼上後會自動解析\n例：${SAMPLE}`}
            value={text}
            onChange={e => setText(e.target.value)}
            onPaste={e => {
              // 框是空的時候貼上：直接解析，不用再按一次
              const pasted = e.clipboardData.getData('text')
              if (!text.trim() && pasted.trim()) {
                e.preventDefault()
                setText(pasted)
                doParse(pasted)
              }
            }}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doParse()
            }}
          />
          {text && (
            <button onClick={() => { setText(''); textRef.current?.focus() }}
              className="absolute right-2 top-2 rounded-lg bg-gray-100 px-2.5 py-1 text-[13px] font-bold text-gray-600" aria-label="清除貼上的內容">清除</button>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => doParse()} disabled={parsing || !text.trim()}
            className="btn-secondary flex-1 min-h-[48px] disabled:opacity-40">
            {parsed ? '重新解析' : '解析'}
          </button>
          <button onClick={() => openPicker(null)}
            className="btn-secondary flex-1 min-h-[48px]">
            🛒 直接選商品
          </button>
        </div>
        <details className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-[13px] leading-relaxed text-gray-600">
          <summary className="cursor-pointer font-bold text-gray-700">怎樣的訊息解析得最準？</summary>
          <p className="mt-1.5">
            有「收件人：」「電話：」「○○門市」這類標示的，<b>順序不拘</b>，門市後面附的地址會用來挑對門市。
            沒有標示時請照 <b>姓名 → 手機 → 門市 → 商品</b> 的順序。
            數量寫 <code className="font-mono">X2</code> 或 <code className="font-mono">2瓶</code>。
          </p>
          <button onClick={() => setText(SAMPLE)} className="mt-2 font-bold text-green-700 underline">填入範例試試看</button>
        </details>
      </Card>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="font-bold text-amber-900 mb-1">⚠️ 請確認</p>
          <ul className="text-amber-800 text-[15px] space-y-0.5 list-disc pl-5">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {parsed && (
        <div ref={resultRef} className="scroll-mt-20 space-y-4">
          {/* ② 收件人與門市 */}
          <Card step={2} title="收件人與門市" done={!!(name.trim() && phoneOk && store)}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label" htmlFor="qo-name">姓名</label>
                <input id="qo-name" className="form-input" value={name}
                  onChange={e => setName(e.target.value)} placeholder="收件人姓名" />
              </div>
              <div>
                <label className="form-label" htmlFor="qo-phone">手機</label>
                <input id="qo-phone" className={`form-input font-mono ${phone && !phoneOk ? 'border-red-400 bg-red-50' : ''}`}
                  value={phone} inputMode="numeric" maxLength={10}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="09 開頭 10 碼" />
                {phone && !phoneOk && (
                  <p className="text-red-600 text-[13px] mt-1">格式不正確（09 開頭 10 碼）</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <p className="form-label">7-11 取貨門市</p>
              {store ? (
                <div className="flex items-start gap-3 bg-green-50 border-2 border-green-200 rounded-xl p-3">
                  <span className="mt-0.5 rounded-md bg-orange-500 px-1.5 py-0.5 text-[12px] font-bold text-white">7-11</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{store.store_name}門市{store.store_code && <span className="ml-1.5 font-mono text-[13px] font-normal text-gray-500">{store.store_code}</span>}</p>
                    <p className="text-green-700 text-sm">{store.county}{store.district}</p>
                    <p className="text-gray-500 text-[13px] mt-0.5">{store.address}</p>
                  </div>
                  <button onClick={() => { setStoreSearchOpen(true); setStoreQuery('') }}
                    className="shrink-0 rounded-lg border-2 border-green-300 bg-white px-3 py-1.5 text-sm font-bold text-green-700">更換</button>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-amber-900 text-sm font-bold mb-2">
                    {storeCandidates.length > 0 ? '有幾間相似的門市，請點選正確的那間' : '還沒選門市'}
                  </p>
                  <div className="space-y-1.5">
                    {storeCandidates.map(s => (
                      <button key={s.id} onClick={() => setStore(s)}
                        className="w-full text-left p-3 rounded-lg bg-white hover:bg-green-50 border border-gray-200">
                        <span className="font-bold text-gray-800">{s.store_name}</span>
                        <span className="text-gray-500 text-sm ml-2">{s.county}{s.district}</span>
                        <span className="block truncate text-[13px] text-gray-500">{s.address}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { setStoreSearchOpen(true); setStoreQuery('') }}
                    className="btn-secondary w-full mt-2 min-h-[48px] text-sm">
                    🔍 搜尋門市
                  </button>
                </div>
              )}
            </div>
          </Card>

          {/* ③ 商品 */}
          <Card step={3} title={`商品${items.length ? `（${items.length}）` : ''}`} done={items.length > 0 && unresolved === 0}
            action={<button onClick={() => openPicker(null)} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-bold text-white">＋ 加商品</button>}>
            {items.length === 0 && (
              <button onClick={() => openPicker(null)} className="w-full rounded-xl border-2 border-dashed border-gray-300 py-6 text-gray-500">
                還沒有商品，點這裡挑選
              </button>
            )}

            <div className="space-y-3">
              {items.map(item => (
                <div key={item.key}
                  className={`rounded-xl border-2 p-3 ${
                    !item.selected ? 'border-red-300 bg-red-50'
                      : !item.confident ? 'border-amber-300 bg-amber-50'
                      : 'border-gray-100'}`}>
                  {item.raw && (
                    <p className="text-[13px] text-gray-500 mb-2">
                      客人寫的：<span className="font-mono text-gray-700">{item.raw}</span>
                    </p>
                  )}

                  {item.selected ? (
                    <>
                      <div className="flex items-start gap-3">
                        <Thumb src={item.selected.cover_image_url} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 leading-snug">{item.selected.product_name}</p>
                          <p className="text-gray-600 text-sm">{item.selected.variant_name}・{money(item.selected.unit_price)}</p>
                          {item.selected.stock_qty < item.quantity && (
                            <p className="text-red-600 text-[13px] font-bold mt-1">⚠️ 庫存只剩 {item.selected.stock_qty}</p>
                          )}
                          {!item.confident && (
                            <p className="text-amber-800 text-[13px] font-bold mt-1">不太確定是不是這個，請確認</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateItem(item.key, { quantity: Math.max(1, item.quantity - 1) })}
                            className="h-10 w-10 rounded-lg border-2 border-gray-200 bg-white text-xl" aria-label="減少數量">−</button>
                          <span className="w-10 text-center text-lg font-bold">{item.quantity}</span>
                          <button onClick={() => updateItem(item.key, { quantity: Math.min(999, item.quantity + 1) })}
                            className="h-10 w-10 rounded-lg border-2 border-gray-200 bg-white text-xl" aria-label="增加數量">＋</button>
                        </div>
                        <p className="font-bold text-gray-900">{money(item.selected.unit_price * item.quantity)}</p>
                      </div>

                      {item.candidates.length > 1 && (
                        <select
                          className="form-input mt-3 text-sm"
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
                      <div className="mt-2 flex gap-4 text-[13px]">
                        <button onClick={() => openPicker(item.key, item.raw)} className="font-bold text-green-700">換別的商品</button>
                        <button onClick={() => setItems(prev => prev.filter(i => i.key !== item.key))} className="text-gray-400 hover:text-red-600">移除</button>
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-red-700 font-bold">找不到對應的商品</p>
                      <button onClick={() => openPicker(item.key, item.raw)}
                        className="btn-primary w-full mt-2 min-h-[48px]">
                        🔍 挑選商品（數量 {item.quantity}）
                      </button>
                      <button onClick={() => setItems(prev => prev.filter(i => i.key !== item.key))}
                        className="mt-2 text-[13px] text-gray-400 hover:text-red-600">移除這項</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* ④ 來源與備註 */}
          <Card step={4} title="來源與備註">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label" htmlFor="qo-source">訂單來源</label>
                <select id="qo-source" className="form-input" value={source}
                  onChange={e => setSource(e.target.value)}>
                  {ORDER_SOURCES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <p className="text-[13px] text-gray-500 mt-1">之後要看「廣告帶來幾筆訂單」就靠這一欄</p>
              </div>
              <div>
                <label className="form-label" htmlFor="qo-note">備註（選填）</label>
                <input id="qo-note" className="form-input" value={note} maxLength={200}
                  onChange={e => setNote(e.target.value)}
                  placeholder="例：客戶指定週三後再出貨" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 底部固定：合計＋建立訂單，按鈕上直接寫還差什麼 */}
      {parsed && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:left-60"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-gray-500">合計（貨到付款）</p>
              <p className="text-xl font-bold leading-tight text-green-700">{money(total)}</p>
              {needsCheck > 0 && !missing && <p className="text-[12px] font-bold text-amber-700">有 {needsCheck} 項是猜的，請確認</p>}
            </div>
            <button onClick={submit} disabled={!canSubmit}
              className="btn-primary min-h-[52px] flex-shrink-0 px-5 text-[16px] disabled:bg-gray-300 disabled:text-gray-600">
              {creating ? '建立中…' : missing || '建立訂單'}
            </button>
          </div>
        </div>
      )}

      {/* 商品選擇：全螢幕，搜尋在上、結果在下，鍵盤不會擋住 */}
      {pickerOpen && (
        <FullSheet title={pickerFor ? '挑選商品' : '加入商品'} onClose={() => { setPickerOpen(false); setPickerFor(null) }}
          search={<SearchBox value={pickerQuery} onChange={setPickerQuery} placeholder="搜尋商品名稱或貨號" />}>
          {pickerFor && pickerQuery && (
            <p className="px-1 pb-2 text-[13px] text-gray-500">依「{pickerQuery}」找到最像的排在前面</p>
          )}
          {filteredCatalog.length === 0 && (
            <p className="py-10 text-center text-gray-500">找不到「{pickerQuery}」<br /><span className="text-[13px]">試試只打商品的兩三個字</span></p>
          )}
          <div className="space-y-3">
            {filteredCatalog.map(p => (
              <div key={p.id} className="rounded-xl border border-gray-100 p-3">
                <div className="mb-2 flex items-center gap-3">
                  <Thumb src={p.cover_image_url} />
                  <p className="font-bold leading-snug text-gray-900">{p.product_name}</p>
                </div>
                <div className="space-y-1.5">
                  {p.product_variants.map(v => (
                    <button key={v.id} onClick={() => addFromCatalog(p, v)}
                      className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-lg border-2 border-gray-100 px-3 py-2 text-left active:bg-green-50 hover:border-green-300">
                      <span className="text-[15px] text-gray-800">{v.variant_name}{v.sku_code && <span className="ml-1.5 font-mono text-[12px] text-gray-400">{v.sku_code}</span>}</span>
                      <span className="shrink-0 text-right">
                        <span className="block font-bold text-green-700">{money(v.sale_price)}</span>
                        <span className={`block text-[12px] ${v.stock_qty > 0 ? 'text-gray-400' : 'font-bold text-red-500'}`}>{v.stock_qty > 0 ? `庫存 ${v.stock_qty}` : '缺貨'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FullSheet>
      )}

      {/* 門市搜尋：同樣全螢幕 */}
      {storeSearchOpen && (
        <FullSheet title="搜尋 7-11 門市" onClose={() => setStoreSearchOpen(false)}
          search={<SearchBox value={storeQuery} onChange={setStoreQuery} placeholder="門市名稱、店號或地址" />}>
          {!storeQuery.trim() && <p className="py-10 text-center text-gray-500">輸入門市名稱，例如「長益」</p>}
          {storeResults.length === 0 && storeQuery.trim() && (
            <p className="py-10 text-center text-gray-500">找不到門市</p>
          )}
          <div className="space-y-2">
            {storeResults.map(s => (
              <button key={s.id}
                onClick={() => { setStore(s); setStoreSearchOpen(false) }}
                className="w-full rounded-xl border-2 border-gray-100 p-3 text-left active:bg-green-50 hover:border-green-300">
                <p className="font-bold text-gray-900">{s.store_name}{s.store_code && <span className="ml-1.5 font-mono text-[13px] font-normal text-gray-400">{s.store_code}</span>}</p>
                <p className="text-green-700 text-sm">{s.county}{s.district}</p>
                <p className="text-gray-500 text-[13px]">{s.address}</p>
              </button>
            ))}
          </div>
        </FullSheet>
      )}
    </div>
  )
}

function Card({ step, title, done, action, children }: { step: number; title: string; done?: boolean; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-gray-900">
          <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white ${done ? 'bg-green-600' : 'bg-gray-800'}`}>{done ? '✓' : step}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Thumb({ src }: { src: string | null }) {
  return (
    <span className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span>💊</span>}
    </span>
  )
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <input className="form-input pl-10 pr-16" autoFocus type="search" inputMode="search" enterKeyHint="search"
        placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>🔍</span>
      {value && <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-gray-100 px-2.5 py-1 text-[13px] font-bold text-gray-600">清除</button>}
    </div>
  )
}

/**
 * 全螢幕面板（手機）／置中視窗（電腦）。
 * 手機用 visualViewport 算「鍵盤以外看得到的範圍」，面板只佔那一塊：
 * 搜尋框在最上面、結果列在下面，鍵盤彈出也看得到結果。
 */
function FullSheet({ title, onClose, search, children }: { title: string; onClose: () => void; search: ReactNode; children: ReactNode }) {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    const update = () => {
      if (window.innerWidth >= 640 || !vv) { setBox(null); return }
      setBox({ top: vv.offsetTop, height: vv.height })
    }
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    const html = document.documentElement, prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      html.style.overflow = prev
    }
  }, [])
  return (
    <div className="fixed inset-0 z-50 bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="fixed inset-x-0 top-0 flex h-full flex-col bg-white sm:static sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-2xl"
        style={box ? { top: box.top, height: box.height } : undefined}>
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
          <button onClick={onClose} className="flex h-10 items-center gap-1 rounded-lg px-2 font-bold text-green-700" aria-label="返回">‹ 返回</button>
          <h3 className="flex-1 text-center text-lg font-bold">{title}</h3>
          <span className="w-16" aria-hidden />
        </div>
        <div className="border-b border-gray-100 p-3">{search}</div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-3">{children}</div>
      </div>
    </div>
  )
}
