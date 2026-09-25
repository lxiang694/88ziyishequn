'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { TIMING_OPTIONS } from '@/lib/productMeta'
import { HOME_SECTIONS, HOME_SECTION_KEYS } from '@/lib/homeSections'
import { suggestShopCategories } from '@/lib/shopCategories'

interface Props { initialData?: any; productId?: number; onSuccess: () => void }

interface Variant { id?: number; variant_name: string; sale_price: string; original_price: string; stock_qty: string; sku_code: string; sort_order: number; is_active: boolean }
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
          sku_code: v.sku_code || '', sort_order: v.sort_order, is_active: v.is_active,
        })))
      }
      if (initialData.product_images?.length > 0) {
        setGallery(initialData.product_images.sort((a: any, b: any) => a.sort_order - b.sort_order).map((i: any) => ({ image_url: i.image_url, sort_order: i.sort_order })))
      }
    }
  }, [initialData])

  const uploadImage = async (file: File): Promise<string | null> => {
    const fd = new FormData(); fd.append('file', file)
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
      if (d.success) { toast.success(productId ? '商品已更新' : '商品已新增'); onSuccess() }
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

  return (
    <div className="max-w-3xl space-y-6">
      {/* Basic info */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 text-lg mb-4">基本資料</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">商品名稱 *</label>
            <input className="form-input" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} />
          </div>

          <div>
            <label className="form-label">網址識別碼</label>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-gray-500 text-sm font-mono">/products/</span>
              <input
                className="form-input flex-1 min-w-[200px] font-mono"
                placeholder="留空會自動產生"
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
              只能用小寫英文、數字與連字號，例：<code className="bg-gray-100 px-1 rounded">wild-camellia-oil</code>。
              留空的話系統會自動產生（中文名稱＋時間戳）。
              {initialData?.slug && (
                <span className="block text-amber-700 mt-1">
                  ⚠️ 已上架的商品改這裡，舊網址就會失效（已分享出去的連結會連不到）。
                </span>
              )}
            </p>
          </div>

          {/* AI generate buttons */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
            <p className="text-sm font-semibold text-purple-700 mb-2">✨ AI 自動生成文案</p>
            <div className="flex flex-wrap gap-2">
              {[
                { type: 'short_intro' as const, label: '生成一句話簡介' },
                { type: 'suitable_people' as const, label: '生成適合人群' },
                { type: 'both' as const, label: '兩者都生成' },
              ].map(btn => (
                <button key={btn.type} onClick={() => handleAIGenerate(btn.type)} disabled={aiLoading !== null || !form.product_name} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                  {aiLoading === btn.type ? '生成中...' : btn.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">一句話簡介</label>
            <input className="form-input" placeholder="30字以內簡短說明" value={form.short_intro} onChange={e => setForm(f => ({ ...f, short_intro: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">適合人群</label>
            <textarea className="form-input" rows={3} value={form.suitable_people} onChange={e => setForm(f => ({ ...f, suitable_people: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">使用方法</label>
            <textarea className="form-input" rows={3} value={form.usage_method} onChange={e => setForm(f => ({ ...f, usage_method: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">成分說明</label>
            <textarea className="form-input" rows={3} value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">注意事項</label>
            <textarea className="form-input" rows={3} value={form.precautions} onChange={e => setForm(f => ({ ...f, precautions: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">保存方式</label>
            <input className="form-input" value={form.storage_method} onChange={e => setForm(f => ({ ...f, storage_method: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* 情境化資訊（誰／何時／怎麼搭／來源） */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 text-lg mb-1">情境化保健資訊</h2>
        <p className="text-gray-600 text-sm mb-4">誰適合（上面「適合人群」）、何時吃、怎麼搭、什麼來源——留空的欄位前台不顯示。</p>
        <div className="space-y-4">
          <div>
            <label className="form-label">⏰ 建議服用時間（可複選）</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {TIMING_OPTIONS.map(o => {
                const selected = form.intake_timing.split(',').map(s => s.trim()).filter(Boolean)
                const on = selected.includes(o.value)
                return (
                  <button key={o.value} type="button"
                    onClick={() => {
                      const next = on ? selected.filter(v => v !== o.value) : [...selected, o.value]
                      setForm(f => ({ ...f, intake_timing: next.join(',') }))
                    }}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold border-2 transition-colors ${on ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="form-label">🔗 搭配建議</label>
            <textarea className="form-input" rows={2} placeholder="例：協同——搭配維生素D3、隨油脂吸收更好；避免同時——與鈣、鐵錯開" value={form.pairing_tips} onChange={e => setForm(f => ({ ...f, pairing_tips: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">🌿 成分來源 / 劑型 / 挑選重點</label>
            <textarea className="form-input" rows={2} placeholder="例：游離型葉黃素、深海魚萃取、USP 認證、素食膠囊" value={form.source_notes} onChange={e => setForm(f => ({ ...f, source_notes: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 text-lg mb-4">商品圖片</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">主圖</label>
            <div className="flex gap-4 items-start">
              <label className="flex-shrink-0 w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 hover:border-green-500 cursor-pointer flex items-center justify-center bg-gray-50 transition-colors overflow-hidden relative">
                {form.cover_image_url ? (
                  <Image src={form.cover_image_url} alt="主圖" fill className="object-cover" sizes="112px" />
                ) : (
                  <div className="text-center text-gray-600"><div className="text-2xl mb-1">📷</div><div className="text-[13px]">上傳主圖</div></div>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} disabled={uploading} />
              </label>
              {form.cover_image_url && (
                <button onClick={() => setForm(f => ({ ...f, cover_image_url: '' }))} className="text-red-500 text-sm font-semibold hover:underline">移除主圖</button>
              )}
            </div>
          </div>

          <div>
            <label className="form-label">相簿圖片</label>
            <div className="flex flex-wrap gap-3">
              {gallery.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden group">
                  <Image src={img.image_url} alt="" fill className="object-cover" sizes="80px" />
                  <button onClick={() => setGallery(g => g.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xl">✕</button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 hover:border-green-500 cursor-pointer flex items-center justify-center bg-gray-50 transition-colors">
                <div className="text-center text-gray-600"><div className="text-xl">+</div></div>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleGalleryUpload} disabled={uploading} />
              </label>
            </div>
            {uploading && <p className="text-sm text-purple-600 mt-2">上傳中...</p>}
          </div>
        </div>
      </div>

      {/* 商品分類 —— 客人逛賣場的動線，必選 */}
      <div className="card p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold text-gray-800 text-lg">商品分類（必選，可多選）</h2>
          {selectedShopCats.length === 0 && shopCats.length > 0 && (
            <span className="text-sm font-semibold text-red-600">尚未選擇</span>
          )}
        </div>
        <p className="mb-4 text-sm text-gray-500">
          客人在賣場首頁與頁尾是照這個分類找商品的。沒有選的話，這件商品只會出現在「全部商品」裡。
        </p>

        {shopCatsNeedMigration ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            商品分類資料表尚未建立。請先在 Supabase SQL Editor 執行
            <code className="mx-1 rounded bg-amber-100 px-1">migrations/shop_categories_schema.sql</code>
            ，這個區塊就會出現。在那之前商品仍可正常儲存。
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {shopCats.map(cat => (
                <button key={cat.id} type="button" onClick={() => toggleShopCat(cat.id)}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-colors border-2 ${selectedShopCats.includes(cat.id) ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>
            {shopSuggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-500">看商品名稱，可能是：</span>
                {shopSuggestions.map(cat => (
                  <button key={cat.id} type="button" onClick={() => toggleShopCat(cat.id)}
                    className="rounded-full border border-dashed border-green-400 px-3 py-1 font-medium text-green-700 hover:bg-green-50">
                    ＋ {cat.emoji} {cat.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Categories */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 text-lg mb-1">健康方向分類（可多選）</h2>
        <p className="mb-4 text-sm text-gray-500">
          給健康知識文章與自測結果用的，決定這件商品會被哪些文章推薦。跟上面的商品分類是兩回事。
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => toggleCat(cat.id)} className={`px-4 py-2 rounded-full font-medium text-sm transition-colors border-2 ${selectedCats.includes(cat.id) ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Variants */}
      <div className="card p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-800 text-lg">規格管理</h2>
          <button onClick={addVariant} className="text-green-700 font-semibold text-sm hover:underline">＋ 新增規格</button>
        </div>
        <div className="space-y-4">
          {variants.map((v, i) => (
            <div key={i} className="border-2 border-gray-100 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-700 text-sm">規格 {i + 1}</span>
                {variants.length > 1 && <button onClick={() => removeVariant(i)} className="text-red-500 text-sm font-semibold hover:underline">刪除</button>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label text-[13px]">規格名稱 *</label><input className="form-input py-2" placeholder="例：30顆/盒" value={v.variant_name} onChange={e => updateVariant(i, 'variant_name', e.target.value)} /></div>
                <div><label className="form-label text-[13px]">SKU 編碼</label><input className="form-input py-2" placeholder="可留空" value={v.sku_code} onChange={e => updateVariant(i, 'sku_code', e.target.value)} /></div>
                <div><label className="form-label text-[13px]">售價 * (NT$)</label><input type="number" className="form-input py-2" placeholder="0" value={v.sale_price} onChange={e => updateVariant(i, 'sale_price', e.target.value)} /></div>
                <div><label className="form-label text-[13px]">原價 (NT$)</label><input type="number" className="form-input py-2" placeholder="選填" value={v.original_price} onChange={e => updateVariant(i, 'original_price', e.target.value)} /></div>
                <div><label className="form-label text-[13px]">庫存數量</label><input type="number" className="form-input py-2" min="0" value={v.stock_qty} onChange={e => updateVariant(i, 'stock_qty', e.target.value)} /></div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={v.is_active} onChange={e => updateVariant(i, 'is_active', e.target.checked)} className="w-5 h-5 accent-green-600" />
                    <span className="text-sm font-medium text-gray-700">啟用此規格</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 首頁分區 */}
      <div className="card p-5">
        <label className="form-label">首頁分區</label>
        <p className="text-gray-600 text-sm mb-3">決定此商品在首頁顯示於哪一區</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HOME_SECTIONS.map(o => (
            <button key={o.key} type="button" onClick={() => setForm(f => ({ ...f, home_section: o.key }))}
              className={`text-left px-4 py-3 rounded-xl border-2 transition-colors ${form.home_section === o.key ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
              <span className="font-bold text-gray-800">{o.emoji} {o.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Publish + Save */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} className="w-6 h-6 accent-green-600" />
            <div>
              <span className="font-bold text-gray-800 text-lg">立即上架</span>
              <p className="text-gray-500 text-sm">勾選後商品將在前台顯示</p>
            </div>
          </label>
          <button onClick={handleSave} disabled={saving} className="btn-primary py-3 px-8 text-lg">
            {saving ? '儲存中...' : (productId ? '儲存修改' : '新增商品')}
          </button>
        </div>
      </div>
    </div>
  )
}
