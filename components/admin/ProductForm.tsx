'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { TIMING_OPTIONS } from '@/lib/productMeta'
import { HOME_SECTIONS, HOME_SECTION_KEYS } from '@/lib/homeSections'
import { suggestShopCategories } from '@/lib/shopCategories'
import { compressImage } from '@/lib/imageCompress'
import { stockLevel, LOW_STOCK } from '@/lib/adminStock'

interface Props { initialData?: any; productId?: number; onSuccess: () => void }

interface Variant { id?: number; variant_name: string; sale_price: string; original_price: string; stock_qty: string; sku_code: string; sort_order: number; is_active: boolean; image_url?: string | null }
interface GalleryImg { image_url: string; sort_order: number }

const emptyVariant = (): Variant => ({ variant_name: '', sale_price: '', original_price: '', stock_qty: '0', sku_code: '', sort_order: 0, is_active: true })

export default function ProductForm({ initialData, productId, onSuccess }: Props) {
  const [categories, setCategories] = useState<any[]>([])
  const [form, setForm] = useState({
    product_name: '', slug: '', short_intro: '', suitable_people: '', usage_method: '',
    ingredients: '', precautions: '', storage_method: '', is_published: false, cover_image_url: '',
    home_section: 'community', intake_timing: '', pairing_tips: '', source_notes: '',
  })
  const [selectedCats, setSelectedCats] = useState<number[]>([])
  const [shopCats, setShopCats] = useState<any[]>([])
  const [selectedShopCats, setSelectedShopCats] = useState<number[]>([])
  const [shopCatsNeedMigration, setShopCatsNeedMigration] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([emptyVariant()])
  const [gallery, setGallery] = useState<GalleryImg[]>([])
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetch('/api/admin/categories').then(r => r.json()).then(d => { if (d.success) setCategories(d.data) })
    fetch('/api/admin/shop-categories').then(r => r.json()).then(d => {
      if (!d.success) return
      setShopCats(d.data)
      setShopCatsNeedMigration(!!d.needsMigration)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (initialData) {
      setForm({
        product_name: initialData.product_name || '',
        slug: initialData.slug || '',
        short_intro: initialData.short_intro || '',
        suitable_people: initialData.suitable_people || '',
        usage_method: initialData.usage_method || '',
        ingredients: initialData.ingredients || '',
        precautions: initialData.precautions || '',
        storage_method: initialData.storage_method || '',
        is_published: initialData.is_published || false,
        cover_image_url: initialData.cover_image_url || '',
        home_section: HOME_SECTION_KEYS.includes(initialData.home_section) ? initialData.home_section : 'community',
        intake_timing: initialData.intake_timing || '',
        pairing_tips: initialData.pairing_tips || '',
        source_notes: initialData.source_notes || '',
      })
      setSelectedCats(initialData.product_category_relations?.map((r: any) => r.health_categories?.id).filter(Boolean) || [])
      setSelectedShopCats(initialData.shop_categories?.map((c: any) => c.id).filter(Boolean) || [])
      if (initialData.product_variants?.length > 0) {
        setVariants(initialData.product_variants.sort((a: any, b: any) => a.sort_order - b.sort_order).map((v: any) => ({
          id: v.id, variant_name: v.variant_name, sale_price: String(v.sale_price),
          original_price: String(v.original_price || ''), stock_qty: String(v.stock_qty),
          sku_code: v.sku_code || '', sort_order: v.sort_order, is_active: v.is_active, image_url: v.image_url || null,
        })))
      }
      if (initialData.product_images?.length > 0) {
        setGallery(initialData.product_images.sort((a: any, b: any) => a.sort_order - b.sort_order).map((i: any) => ({ image_url: i.image_url, sort_order: i.sort_order })))
      }
    }
  }, [initialData])

  const uploadImage = async (file: File): Promise<string | null> => {
    // 先在瀏覽器縮小、轉 WebP，客人才不必下載好幾 MB 的原圖（lib/imageCompress.ts）
    const fd = new FormData(); fd.append('file', await compressImage(file))
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    const d = await res.json()
    return d.success ? d.url : null
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const url = await uploadImage(file)
    if (url) setForm(f => ({ ...f, cover_image_url: url }))
    else toast.error('上傳失敗')
    setUploading(false)
  }

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploading(true)
    for (const file of files) {
      const url = await uploadImage(file)
      if (url) setGallery(prev => [...prev, { image_url: url, sort_order: prev.length }])
    }
    setUploading(false)
    toast.success('圖片上傳完成')
  }

  // 規格圖片（不同顏色、尺寸）：一個規格一張，客人在前台點這個規格就會看到
  const [variantUploading, setVariantUploading] = useState<number | null>(null)
  const handleVariantImage = async (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setVariantUploading(i)
    try {
      const url = await uploadImage(file)
      if (url) { setVariants(vs => vs.map((v, j) => j === i ? { ...v, image_url: url } : v)); toast.success('規格圖片上傳完成') }
      else toast.error('圖片上傳失敗，請再試一次')
    } finally { setVariantUploading(null) }
  }

  const handleAIGenerate = async (type: 'short_intro' | 'suitable_people' | 'both') => {
    if (!form.product_name) { toast.error('請先填寫商品名稱'); return }
    setAiLoading(type)
    try {
      const res = await fetch('/api/admin/products/ai-generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_name: form.product_name, product_id: productId, type }),
      })
      const d = await res.json()
      if (d.success) {
        if (d.data.short_intro) setForm(f => ({ ...f, short_intro: d.data.short_intro }))
        if (d.data.suitable_people) setForm(f => ({ ...f, suitable_people: d.data.suitable_people }))
        toast.success('AI 文案生成完成，請確認後儲存')
      } else toast.error(d.error || 'AI 生成失敗')
    } catch { toast.error('AI 生成失敗') }
    finally { setAiLoading(null) }
  }

  const handleSave = async () => {
    if (!form.product_name) { toast.error('請填寫商品名稱'); return }
    if (variants.some(v => !v.variant_name || !v.sale_price)) { toast.error('請填寫所有規格的名稱與售價'); return }
    // 沒有商品分類的商品在賣場裡只會出現在「全部商品」，客人照分類逛就找不到它
    if (!shopCatsNeedMigration && shopCats.length > 0 && selectedShopCats.length === 0) {
      toast.error('請至少選一個商品分類，客人是照這個分類逛賣場的'); return
    }
    setSaving(true)
    try {
      const body = {
        ...form,
        category_ids: selectedCats,
        shop_category_ids: selectedShopCats,
        variants: variants.map((v, i) => ({ ...v, sale_price: parseFloat(v.sale_price) || 0, original_price: v.original_price ? parseFloat(v.original_price) : null, stock_qty: parseInt(v.stock_qty) || 0, sort_order: i })),
        gallery_images: gallery,
      }
      const url = productId ? `/api/admin/products/${productId}` : '/api/admin/products'
      const method = productId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (d.success) {
        toast.success(productId ? '商品已更新' : '商品已新增')
        // 有訂單的規格刪不掉、改成下架了：講清楚，不然會以為沒刪成功
        if (d.notice) toast(d.notice, { icon: 'ℹ️', duration: 8000 })
        onSuccess()
      }
      else toast.error(d.error || '儲存失敗')
    } catch { toast.error('儲存失敗') }
    finally { setSaving(false) }
  }

  const addVariant = () => setVariants(v => [...v, { ...emptyVariant(), sort_order: v.length }])
  const removeVariant = (i: number) => setVariants(v => v.filter((_, idx) => idx !== i))
  const updateVariant = (i: number, key: keyof Variant, val: any) => setVariants(v => v.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  const toggleCat = (id: number) => setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  const toggleShopCat = (id: number) => setSelectedShopCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  // 名稱與簡介打到一半就能給建議，省掉「這該歸哪一類」的猶豫
  const shopSuggestions = suggestShopCategories({ product_name: form.product_name, short_intro: form.short_intro })
    .map(sg => shopCats.find(c => c.slug === sg.slug))
    .filter((c): c is any => !!c && !selectedShopCats.includes(c.id))

  // 儲存列上的提醒：還沒選分類、有規格庫存不足 —— 不用往回捲就知道
  const lowVariants = variants.filter(v => v.is_active && stockLevel(parseInt(v.stock_qty) || 0) !== 'ok')
  const missingShopCat = !shopCatsNeedMigration && shopCats.length > 0 && selectedShopCats.length === 0
  const textField = (key: keyof typeof form, label: string, opts: { rows?: number; placeholder?: string; hint?: string } = {}) => (
    <div>
      <label className="form-label">{label}</label>
      {opts.rows
        ? <textarea className="form-input" rows={opts.rows} placeholder={opts.placeholder} value={form[key] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
        : <input className="form-input" placeholder={opts.placeholder} value={form[key] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />}
      {opts.hint && <p className="mt-1 text-[13px] text-gray-500">{opts.hint}</p>}
    </div>
  )

  return (
    <div className="max-w-6xl pb-28">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ═══════ 左欄：商品內容 ═══════ */}
        <div className="min-w-0 space-y-5">

          {/* ① 基本資料 */}
          <Section n={1} title="基本資料">
            <div>
              <label className="form-label">商品名稱 <span className="text-red-500">*</span></label>
              <input className="form-input text-lg font-semibold" placeholder="例：6合一綜合維生素" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label className="form-label mb-0">一句話簡介</label>
                <AiButton loading={aiLoading === 'short_intro'} disabled={aiLoading !== null || !form.product_name} onClick={() => handleAIGenerate('short_intro')} />
              </div>
              <input className="form-input" placeholder="30 字以內，會顯示在商品名稱下面" value={form.short_intro} onChange={e => setForm(f => ({ ...f, short_intro: e.target.value }))} />
            </div>
          </Section>

          {/* ② 圖片 */}
          <Section n={2} title="商品圖片" hint="第一張是主圖（列表、分享都用這張）；相簿可以放多張，客人在商品頁左右滑">
            <div className="flex flex-wrap items-start gap-3">
              <div className="space-y-1.5">
                <label className="relative flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-green-500">
                  {form.cover_image_url
                    ? <Image src={form.cover_image_url} alt="主圖" fill className="object-cover" sizes="128px" />
                    : <span className="text-center text-gray-500"><span className="block text-2xl">📷</span><span className="text-[13px]">上傳主圖</span></span>}
                  <span className="absolute left-1.5 top-1.5 rounded bg-green-700 px-1.5 py-0.5 text-[11px] font-bold text-white">主圖</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} disabled={uploading} />
                </label>
                {form.cover_image_url && <button type="button" onClick={() => setForm(f => ({ ...f, cover_image_url: '' }))} className="text-[13px] text-red-500 hover:underline">移除主圖</button>}
              </div>
              {gallery.map((img, i) => (
                <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-gray-200">
                  <Image src={img.image_url} alt="" fill className="object-cover" sizes="96px" />
                  <button type="button" onClick={() => setGallery(g => g.filter((_, idx) => idx !== i))} aria-label="移除這張"
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm font-bold text-white">✕</button>
                </div>
              ))}
              <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-center text-gray-500 transition-colors hover:border-green-500">
                <span><span className="block text-2xl leading-none">＋</span><span className="text-[12px]">加相簿圖片</span></span>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleGalleryUpload} disabled={uploading} />
              </label>
            </div>
            {uploading && <p className="text-sm font-semibold text-green-700">圖片上傳中…</p>}
          </Section>

          {/* ③ 規格・價格・庫存 */}
          <Section n={3} title="規格・價格・庫存"
            hint={`每一種包裝、顏色、尺寸各一個規格。庫存少於 ${LOW_STOCK} 件會標橘色提醒補貨。`}
            action={<button type="button" onClick={addVariant} className="rounded-lg border border-green-600 px-3 py-1.5 text-sm font-bold text-green-700 hover:bg-green-50">＋ 新增規格</button>}>
            <div className="space-y-3">
              {variants.map((v, i) => {
                const lvl = stockLevel(parseInt(v.stock_qty) || 0)
                return (
                  <div key={i} className={`rounded-xl border-2 p-3 ${!v.is_active ? 'border-dashed border-gray-300 bg-gray-50' : lvl === 'out' ? 'border-red-200' : lvl === 'low' ? 'border-amber-200' : 'border-gray-100'}`}>
                    <div className="flex gap-3">
                      {/* 規格圖片（選填）：客人點這個規格就會看到 */}
                      <label className={`relative flex h-20 w-20 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center hover:border-green-500 ${variantUploading !== null ? 'pointer-events-none opacity-60' : ''}`}
                        title="規格圖片（選填，例如不同顏色、尺寸）">
                        {v.image_url
                          ? <Image src={v.image_url} alt={v.variant_name || `規格 ${i + 1}`} fill className="object-contain" sizes="80px" />
                          : <span className="px-1 text-[11px] leading-tight text-gray-500">{variantUploading === i ? '上傳中…' : <>📷<br />規格圖<br />（選填）</>}</span>}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleVariantImage(i, e)} disabled={variantUploading !== null} />
                      </label>
                      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
                        <Field label="規格名稱 *" className="col-span-2 sm:col-span-1">
                          <input className="form-input py-2" placeholder="例：1瓶（90顆）、紅色" value={v.variant_name} onChange={e => updateVariant(i, 'variant_name', e.target.value)} />
                        </Field>
                        <Field label="售價 *">
                          <input type="number" inputMode="numeric" className="form-input py-2" placeholder="0" value={v.sale_price} onChange={e => updateVariant(i, 'sale_price', e.target.value)} />
                        </Field>
                        <Field label="原價（劃線）">
                          <input type="number" inputMode="numeric" className="form-input py-2" placeholder="選填" value={v.original_price} onChange={e => updateVariant(i, 'original_price', e.target.value)} />
                        </Field>
                        <Field label={<span className="flex items-center gap-1">庫存{v.is_active && lvl !== 'ok' && <span className={`rounded px-1 text-[11px] font-bold ${lvl === 'out' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{lvl === 'out' ? '售完' : '不足'}</span>}</span>}>
                          <input type="number" inputMode="numeric" min="0" className={`form-input py-2 ${v.is_active && lvl === 'out' ? 'border-red-300 bg-red-50' : v.is_active && lvl === 'low' ? 'border-amber-300 bg-amber-50' : ''}`} value={v.stock_qty} onChange={e => updateVariant(i, 'stock_qty', e.target.value)} />
                        </Field>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-2 text-sm">
                      <label className="flex items-center gap-1.5 text-gray-500">SKU
                        <input className="form-input h-8 w-28 py-1 text-sm" placeholder="可留空" value={v.sku_code} onChange={e => updateVariant(i, 'sku_code', e.target.value)} />
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 font-medium text-gray-700">
                        <input type="checkbox" checked={v.is_active} onChange={e => updateVariant(i, 'is_active', e.target.checked)} className="h-5 w-5 accent-green-600" />
                        前台販售
                      </label>
                      {!v.is_active && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[12px] font-bold text-gray-600">已下架・前台不顯示</span>}
                      <span className="ml-auto flex items-center gap-3">
                        {v.image_url && <button type="button" onClick={() => setVariants(vs => vs.map((x, j) => j === i ? { ...x, image_url: null } : x))} className="text-[13px] text-gray-500 hover:underline">移除規格圖</button>}
                        {variants.length > 1 && <button type="button" onClick={() => removeVariant(i)} className="text-[13px] font-semibold text-red-500 hover:underline">刪除規格</button>}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* ④ 商品介紹 */}
          <Section n={4} title="商品介紹" hint="留空的欄位前台不顯示。直接貼上文案就好，前台會自動排版">
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label className="form-label mb-0">適合誰</label>
                <AiButton loading={aiLoading === 'suitable_people'} disabled={aiLoading !== null || !form.product_name} onClick={() => handleAIGenerate('suitable_people')} />
              </div>
              <textarea className="form-input" rows={4} value={form.suitable_people} onChange={e => setForm(f => ({ ...f, suitable_people: e.target.value }))} />
            </div>
            {textField('usage_method', '使用方法', { rows: 3 })}
            {textField('ingredients', '成分說明', { rows: 3 })}
            {textField('precautions', '注意事項', { rows: 3 })}
            {textField('storage_method', '保存方式', { placeholder: '例：置於陰涼乾燥處' })}
          </Section>

          {/* ⑤ 進階（平常不用動，收起來） */}
          <details className="card group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-gray-800">
              <span>⚙️ 進階資訊（選填）<span className="ml-2 text-sm font-normal text-gray-500">服用時間、搭配建議、來源、網址</span></span>
              <span className="text-gray-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <label className="form-label">⏰ 建議服用時間（可複選）</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {TIMING_OPTIONS.map(o => {
                    const selected = form.intake_timing.split(',').map(s => s.trim()).filter(Boolean)
                    const on = selected.includes(o.value)
                    return (
                      <button key={o.value} type="button"
                        onClick={() => { const next = on ? selected.filter(x => x !== o.value) : [...selected, o.value]; setForm(f => ({ ...f, intake_timing: next.join(',') })) }}
                        className={`rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition-colors ${on ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {textField('pairing_tips', '🔗 搭配建議', { rows: 2, placeholder: '例：搭配維生素D3、隨油脂吸收更好；與鈣、鐵錯開' })}
              {textField('source_notes', '🌿 成分來源 / 劑型 / 挑選重點', { rows: 2, placeholder: '例：游離型葉黃素、深海魚萃取、素食膠囊' })}
              <div>
                <label className="form-label">網址識別碼</label>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-mono text-sm text-gray-500">/products/</span>
                  <input className="form-input min-w-[200px] flex-1 font-mono" placeholder="留空會自動產生" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-gray-500">
                  只能用小寫英文、數字與連字號，例：<code className="rounded bg-gray-100 px-1">wild-camellia-oil</code>。
                  {initialData?.slug && <span className="mt-1 block text-amber-700">⚠️ 已上架的商品改這裡，舊網址就會失效（已分享出去的連結會連不到）。</span>}
                </p>
              </div>
            </div>
          </details>
        </div>

        {/* ═══════ 右欄：設定 ═══════ */}
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-3 font-bold text-gray-800">前台顯示</h2>
            <button type="button" role="switch" aria-checked={form.is_published} onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
              className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-colors ${form.is_published ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <span>
                <span className={`block font-bold ${form.is_published ? 'text-green-800' : 'text-gray-700'}`}>{form.is_published ? '上架中' : '未上架'}</span>
                <span className="text-[13px] text-gray-500">{form.is_published ? '客人看得到、可以買' : '儲存後客人看不到'}</span>
              </span>
              <span className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${form.is_published ? 'bg-green-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${form.is_published ? 'left-[22px]' : 'left-0.5'}`} />
              </span>
            </button>
          </div>

          <div className={`card p-5 ${missingShopCat ? 'ring-2 ring-red-200' : ''}`}>
            <h2 className="font-bold text-gray-800">商品分類 <span className="text-sm font-normal text-red-500">必選・可多選</span></h2>
            <p className="mb-3 mt-0.5 text-[13px] text-gray-500">客人在賣場照這個分類找商品</p>
            {shopCatsNeedMigration ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                商品分類資料表尚未建立：請先在 Supabase 執行 <code className="rounded bg-amber-100 px-1">migrations/shop_categories_schema.sql</code>。在那之前商品仍可正常儲存。
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {shopCats.map(cat => <Chip key={cat.id} on={selectedShopCats.includes(cat.id)} onClick={() => toggleShopCat(cat.id)}>{cat.emoji} {cat.name}</Chip>)}
                </div>
                {shopSuggestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px]">
                    <span className="text-gray-500">建議：</span>
                    {shopSuggestions.map(cat => (
                      <button key={cat.id} type="button" onClick={() => toggleShopCat(cat.id)} className="rounded-full border border-dashed border-green-400 px-2.5 py-1 font-medium text-green-700 hover:bg-green-50">＋ {cat.emoji} {cat.name}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-bold text-gray-800">健康方向 <span className="text-sm font-normal text-gray-500">可多選</span></h2>
            <p className="mb-3 mt-0.5 text-[13px] text-gray-500">決定哪些健康知識文章、自測結果會推薦這件商品</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => <Chip key={cat.id} on={selectedCats.includes(cat.id)} onClick={() => toggleCat(cat.id)}>{cat.name}</Chip>)}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-bold text-gray-800">首頁分區</h2>
            <div className="space-y-2">
              {HOME_SECTIONS.map(o => (
                <button key={o.key} type="button" onClick={() => setForm(f => ({ ...f, home_section: o.key }))}
                  className={`flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-bold transition-colors ${form.home_section === o.key ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-700 hover:border-green-300'}`}>
                  <span className={`h-4 w-4 flex-shrink-0 rounded-full border-2 ${form.home_section === o.key ? 'border-green-600 bg-green-600 ring-2 ring-inset ring-white' : 'border-gray-300'}`} />
                  {o.emoji} {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ 底部固定儲存列：捲到哪裡都按得到 ═══════
          後台主區塊是 overflow-auto，sticky 不會黏住，所以用 fixed；
          電腦版左邊讓出側邊欄的寬度（w-60） */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full px-2.5 py-1 font-bold ${form.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{form.is_published ? '● 上架中' : '○ 未上架'}</span>
            {missingShopCat && <span className="font-semibold text-red-600">⚠️ 還沒選商品分類</span>}
            {lowVariants.length > 0 && <span className="font-semibold text-amber-700">⚠️ {lowVariants.length} 個規格庫存不足</span>}
          </div>
          <div className="flex items-center gap-2">
            <a href="/admin/products" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">取消</a>
            <button onClick={handleSave} disabled={saving} className="btn-primary px-8 py-2.5 text-base">
              {saving ? '儲存中…' : productId ? '儲存修改' : '新增商品'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ n, title, hint, action, children }: { n: number; title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-700 text-[13px] text-white">{n}</span>{title}
          </h2>
          {hint && <p className="mt-1 text-[13px] text-gray-500">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, className = '', children }: { label: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <div className={className}><label className="mb-1 block text-[13px] font-semibold text-gray-600">{label}</label>{children}</div>
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
      {on && '✓ '}{children}
    </button>
  )
}

function AiButton({ loading, disabled, onClick }: { loading: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="rounded-lg bg-purple-50 px-2.5 py-1 text-[13px] font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-40">
      {loading ? '生成中…' : '✨ AI 幫我寫'}
    </button>
  )
}
