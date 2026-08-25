'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'

/**
 * 報價草稿表單（建立與編輯共用）。
 *
 * 注意：表單刻意**不送**總價、基本服務費與方案名稱快照 ——
 * 那三項一律由伺服器從 care_services 取當下值並重算。
 * 這裡顯示的合計只是給操作者看的預覽，不是送出的資料。
 */
interface ServiceOption { code: string; name: string; price: number; hours_label: string | null }

export interface QuoteFormValue {
  service_code: string
  travel_estimate_amount: number
  travel_estimate_basis: string
  overtime_rule_snapshot: string
  valid_until: string
  items: { item_code: string; label_snapshot: string; unit_price: number; quantity: number }[]
}

const EMPTY: QuoteFormValue = {
  service_code: '',
  travel_estimate_amount: 0,
  travel_estimate_basis: '',
  overtime_rule_snapshot: '',
  valid_until: '',
  items: [],
}

export default function CareQuoteForm({
  initial, submitLabel, onSubmit,
}: {
  initial?: Partial<QuoteFormValue>
  submitLabel: string
  onSubmit: (v: QuoteFormValue) => Promise<void>
}) {
  const [services, setServices] = useState<ServiceOption[]>([])
  const [v, setV] = useState<QuoteFormValue>({ ...EMPTY, ...initial })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/care/services').then(r => r.json()).then(d => {
      if (d.success) setServices(d.data)
    }).catch(() => {})
  }, [])

  const set = <K extends keyof QuoteFormValue>(k: K, val: QuoteFormValue[K]) =>
    setV(s => ({ ...s, [k]: val }))

  const base = services.find(s => s.code === v.service_code)?.price ?? 0
  const itemsTotal = v.items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const preview = base + v.travel_estimate_amount + itemsTotal

  const addItem = () =>
    set('items', [...v.items, { item_code: '', label_snapshot: '', unit_price: 0, quantity: 1 }])
  const updItem = (i: number, patch: Partial<QuoteFormValue['items'][number]>) =>
    set('items', v.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const delItem = (i: number) => set('items', v.items.filter((_, idx) => idx !== i))

  const submit = async () => {
    if (!v.service_code) return toast.error('請選擇服務方案')
    if (!v.travel_estimate_basis.trim()) return toast.error('請填寫交通計價說明')
    if (!v.overtime_rule_snapshot.trim()) return toast.error('請填寫超時規則')
    if (!v.valid_until) return toast.error('請選擇報價有效期限')
    setBusy(true)
    try { await onSubmit(v) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label" htmlFor="q-service">服務方案</label>
        <select id="q-service" className="form-input" value={v.service_code}
          onChange={e => set('service_code', e.target.value)}>
          <option value="">請選擇</option>
          {services.map(s => (
            <option key={s.code} value={s.code}>
              {s.name}（{formatPrice(s.price)}{s.hours_label ? `・${s.hours_label}` : ''}）
            </option>
          ))}
        </select>
        <p className="text-gray-600 text-[13px] mt-1">
          基本服務費會以送出當下的方案價格建立快照，日後改價不影響已送出的報價。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label" htmlFor="q-travel">交通預估金額</label>
          <input id="q-travel" type="number" min={0} className="form-input"
            value={v.travel_estimate_amount}
            onChange={e => set('travel_estimate_amount', Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div>
          <label className="form-label" htmlFor="q-valid">報價有效期限</label>
          <input id="q-valid" type="date" className="form-input"
            value={v.valid_until} onChange={e => set('valid_until', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="form-label" htmlFor="q-basis">交通計價說明</label>
        <textarea id="q-basis" className="form-input" rows={2} maxLength={300}
          placeholder="例：來回實際里程每公里 15 元，停車費依收據核實計算"
          value={v.travel_estimate_basis} onChange={e => set('travel_estimate_basis', e.target.value)} />
        <p className="text-gray-600 text-[13px] mt-1">必須寫清楚怎麼算，不可只寫「另計」。</p>
      </div>

      <div>
        <label className="form-label" htmlFor="q-overtime">超時規則</label>
        <textarea id="q-overtime" className="form-input" rows={2} maxLength={300}
          placeholder="例：超過方案時數後，每 30 分鐘 300 元，服務前先告知"
          value={v.overtime_rule_snapshot} onChange={e => set('overtime_rule_snapshot', e.target.value)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="form-label mb-0">加購項目</label>
          <button type="button" onClick={addItem} className="btn-secondary">新增一項</button>
        </div>
        {v.items.length === 0 ? (
          <p className="text-gray-600 text-[15px]">目前沒有加購項目。</p>
        ) : (
          <div className="space-y-2">
            {v.items.map((it, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                <input className="form-input" placeholder="代碼" value={it.item_code}
                  aria-label={`第 ${i + 1} 項代碼`}
                  onChange={e => updItem(i, { item_code: e.target.value })} />
                <input className="form-input sm:col-span-2" placeholder="項目名稱" value={it.label_snapshot}
                  aria-label={`第 ${i + 1} 項名稱`}
                  onChange={e => updItem(i, { label_snapshot: e.target.value })} />
                <input className="form-input" type="number" min={0} placeholder="單價" value={it.unit_price}
                  aria-label={`第 ${i + 1} 項單價`}
                  onChange={e => updItem(i, { unit_price: Math.max(0, Number(e.target.value) || 0) })} />
                <div className="flex gap-2">
                  <input className="form-input" type="number" min={1} placeholder="數量" value={it.quantity}
                    aria-label={`第 ${i + 1} 項數量`}
                    onChange={e => updItem(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                  <button type="button" onClick={() => delItem(i)}
                    className="min-h-[48px] px-3 rounded-xl border-2 border-gray-200 text-gray-600">刪</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-gray-600 text-[13px]">預覽合計（實際金額以伺服器重算為準）</p>
        <p className="text-2xl font-bold text-gray-900">{formatPrice(preview)}</p>
        <p className="text-gray-600 text-[13px] mt-1">
          基本 {formatPrice(base)}＋交通 {formatPrice(v.travel_estimate_amount)}＋加購 {formatPrice(itemsTotal)}
        </p>
      </div>

      <button onClick={submit} disabled={busy} className="btn-primary w-full">
        {busy ? '處理中…' : submitLabel}
      </button>
    </div>
  )
}
