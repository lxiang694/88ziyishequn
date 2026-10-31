'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { compressImage } from '@/lib/imageCompress'
import { isoToTwLocal, slugForStart, twLocalToIso } from '@/lib/groupBuy/domain'
import { insertImage, listImages, removeImageLine } from '@/lib/groupBuy/textImages'
import GroupBuyBanner from '@/components/front/groupBuy/GroupBuyBanner'

type ItemForm = {
  key: string
  id: number | null
  name: string; spec: string; description: string; image_url: string
  price: string; original_price: string; per_person_limit: string; total_quota: string
  is_active: boolean
  sold: number
}
type CampaignForm = {
  title: string; slug: string; subtitle: string; description: string; cover_image_url: string; banner_image_url: string
  starts_at_local: string; ends_at_local: string; ship_note: string
  ship_711_enabled: boolean; ship_711_normal_enabled: boolean; ship_home_enabled: boolean
  fee_711: string; fee_711_normal: string; fee_home: string; free_shipping_threshold: string
  is_published: boolean
}

const EMPTY_ITEM = (): ItemForm => ({
  key: Math.random().toString(36).slice(2), id: null, name: '', spec: '', description: '', image_url: '',
  price: '', original_price: '', per_person_limit: '', total_quota: '', is_active: true, sold: 0,
})

/** 預設：下個月 1 號 10:00 開團、10 號 23:59 截單，冷凍 7-11 開啟 */
function defaultCampaign(): CampaignForm {
  const tw = new Date(Date.now() + 8 * 3600_000)
  const y = tw.getUTCFullYear(), m = tw.getUTCMonth() + 2
  const ym = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 7)
  return {
    title: `${Number(ym.slice(5))} 月團購`, slug: ym, subtitle: '', description: '', cover_image_url: '', banner_image_url: '',
    starts_at_local: `${ym}-01T10:00`, ends_at_local: `${ym}-10T23:59`, ship_note: '截單後約 7～10 天出貨',
    ship_711_enabled: true, ship_711_normal_enabled: false, ship_home_enabled: false, fee_711: '0', fee_711_normal: '0', fee_home: '0', free_shipping_threshold: '',
    is_published: false,
  }
}

const str = (v: unknown) => (v == null ? '' : String(v))

async function upload(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', await compressImage(file))
  const d = await (await fetch('/api/admin/upload', { method: 'POST', body: fd })).json()
  if (!d.success) throw new Error(d.error || '上傳失敗')
  return d.url
}

export default function GroupBuyEditPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const isNew = params.id === 'new'
  const [c, setC] = useState<CampaignForm>(defaultCampaign())
  const [items, setItems] = useState<ItemForm[]>([EMPTY_ITEM()])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  // 資料庫有沒有「首頁入口背景圖」欄位（還沒執行 SQL 時不顯示上傳、也不送這個欄位）
  const [bannerReady, setBannerReady] = useState(false)

  useEffect(() => {
    if (!isNew) return
    fetch('/api/admin/group-buy', { cache: 'no-store' }).then(r => r.json()).then(d => setBannerReady(!!d.banner_ready)).catch(() => {})
  }, [isNew])

  useEffect(() => {
    if (isNew) return
    fetch(`/api/admin/group-buy/${params.id}`, { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (!d.success) { toast.error(d.error || '讀取失敗'); return }
      const x = d.data.campaign
      setBannerReady('banner_image_url' in x)
      setC({
        title: x.title, slug: x.slug, subtitle: x.subtitle, description: x.description, cover_image_url: x.cover_image_url || '', banner_image_url: x.banner_image_url || '',
        starts_at_local: isoToTwLocal(x.starts_at), ends_at_local: isoToTwLocal(x.ends_at), ship_note: x.ship_note,
        ship_711_enabled: x.ship_711_enabled, ship_711_normal_enabled: !!x.ship_711_normal_enabled, ship_home_enabled: x.ship_home_enabled,
        fee_711: str(x.fee_711), fee_711_normal: str(x.fee_711_normal ?? 0), fee_home: str(x.fee_home), free_shipping_threshold: str(x.free_shipping_threshold),
        is_published: x.is_published,
      })
      setItems(d.data.items.map((i: any) => ({
        key: String(i.id), id: i.id, name: i.name, spec: i.spec, description: i.description, image_url: i.image_url || '',
        price: str(i.price), original_price: str(i.original_price), per_person_limit: str(i.per_person_limit),
        total_quota: str(i.total_quota), is_active: i.is_active, sold: i.sold,
      })))
    }).finally(() => setLoading(false))
  }, [isNew, params.id])

  const set = <K extends keyof CampaignForm>(k: K, v: CampaignForm[K]) => setC(prev => ({ ...prev, [k]: v }))
  const setItem = (key: string, patch: Partial<ItemForm>) => setItems(list => list.map(i => i.key === key ? { ...i, ...patch } : i))
  const move = (index: number, dir: -1 | 1) => setItems(list => {
    const j = index + dir
    if (j < 0 || j >= list.length) return list
    const next = [...list]; [next[index], next[j]] = [next[j], next[index]]
    return next
  })
  const remove = (it: ItemForm) => {
    if (it.sold > 0 && !confirm(`「${it.name}」已經有人訂了，移除後會改成下架（已成立的訂單不受影響）。確定？`)) return
    setItems(list => list.filter(i => i.key !== it.key))
  }

  const onUpload = async (target: 'cover' | string, file?: File) => {
    if (!file) return
    setUploading(target)
    try {
      const u = await upload(file)
      if (target === 'cover') set('cover_image_url', u)
      else if (target === 'banner') set('banner_image_url', u)
      else setItem(target, { image_url: u })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上傳失敗')
    } finally { setUploading('') }
  }

  const save = async (publish?: boolean) => {
    const { banner_image_url, ...rest } = c
    // 背景圖欄位還沒建立時不送，免得整個儲存失敗
    const campaign = { ...rest, ...(bannerReady ? { banner_image_url } : {}), is_published: publish ?? c.is_published }
    const payload = {
      campaign,
      items: items.map(i => ({
        id: i.id, name: i.name, spec: i.spec, description: i.description, image_url: i.image_url,
        price: i.price, original_price: i.original_price, per_person_limit: i.per_person_limit,
        total_quota: i.total_quota, is_active: i.is_active,
      })),
    }
    setSaving(true)
    try {
      let id = params.id
      if (isNew) {
        const created = await (await fetch('/api/admin/group-buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...campaign, is_published: false }) })).json()
        if (!created.success) { toast.error(created.error || '新增失敗'); return }
        id = String(created.data.id)
      }
      const d = await (await fetch(`/api/admin/group-buy/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).json()
      if (!d.success) {
        toast.error(d.error || '儲存失敗')
        if (isNew) router.replace(`/admin/group-buy/${id}`)
        return
      }
      toast.success(campaign.is_published ? '已儲存，團購開啟中' : '已儲存（團購關閉中）')
      if (isNew) router.replace(`/admin/group-buy/${id}`)
      else { setC(prev => ({ ...prev, is_published: campaign.is_published })); router.refresh() }
    } finally { setSaving(false) }
  }

  const input = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-[15px] focus:border-green-600 focus:outline-none'
  const label = 'block text-sm font-bold text-gray-700'

  if (loading) return <p className="card p-8 text-center text-gray-500">載入中…</p>

  return (
    <div className="max-w-3xl pb-28">
      <Link href="/admin/group-buy" className="text-sm font-bold text-green-700">← 團購管理</Link>
      <h1 className="mt-2 text-xl font-bold text-gray-800 sm:text-2xl">{isNew ? '新增團購檔期' : c.title}</h1>

      {/* ── 檔期設定 ─────────────────────────────── */}
      <section className="card mt-4 space-y-4 p-4 sm:p-5">
        <h2 className="text-lg font-bold">檔期設定</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>檔期名稱<input className={input} value={c.title} onChange={e => set('title', e.target.value)} placeholder="11 月團購｜鱸魚精" /></label>
          <label className={label}>網址代稱
            <input className={input} value={c.slug} onChange={e => set('slug', e.target.value.toLowerCase())} placeholder="2026-11" />
            <span className="mt-1 block text-xs font-normal text-gray-500">前台網址：/group-buy/{c.slug || '…'}</span>
          </label>
          <label className={label}>開團時間（台灣時間）<input type="datetime-local" className={input} value={c.starts_at_local}
            onChange={e => { set('starts_at_local', e.target.value); const iso = twLocalToIso(e.target.value); if (isNew && iso) set('slug', slugForStart(iso)) }} /></label>
          <label className={label}>截單時間（台灣時間）<input type="datetime-local" className={input} value={c.ends_at_local} onChange={e => set('ends_at_local', e.target.value)} /></label>
        </div>
        <label className={label}>一句話介紹（標題下方）<input className={input} value={c.subtitle} onChange={e => set('subtitle', e.target.value)} maxLength={200} placeholder="台灣在地養殖鱸魚，滴滴精華" /></label>
        <label className={label}>出貨說明<input className={input} value={c.ship_note} onChange={e => set('ship_note', e.target.value)} maxLength={200} /></label>

        <div>
          <p className={label}>封面圖（選填，16:9 最好看）</p>
          <div className="mt-1 flex items-center gap-3">
            {c.cover_image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.cover_image_url} alt="" className="h-16 w-28 rounded-lg object-cover" />}
            <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">
              {uploading === 'cover' ? '上傳中…' : c.cover_image_url ? '更換' : '上傳圖片'}
              <input type="file" accept="image/*" className="hidden" onChange={e => onUpload('cover', e.target.files?.[0])} />
            </label>
            {c.cover_image_url && <button className="text-sm text-red-600" onClick={() => set('cover_image_url', '')}>移除</button>}
          </div>
        </div>

        {/* 首頁「每月團購」入口的背景圖，下面直接預覽首頁看到的樣子 */}
        <div className="rounded-xl border border-gray-200 p-3">
          <p className={label}>首頁入口背景圖（選填）</p>
          <p className="mt-0.5 text-xs text-gray-500">首頁「每月團購」那一塊的背景。建議橫式、寬 1200 像素以上，主體放中間（左右上下會依手機寬度裁切）。圖上會自動加一層深色，白字一樣清楚。沒放就用綠色背景。</p>
          {!bannerReady ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">要先在 Supabase SQL Editor 執行 <code className="rounded bg-white px-1">migrations/group_buy_banner_image.sql</code>，重新整理這頁就能上傳。</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-lg border-2 border-green-600 bg-white px-3 py-2 text-sm font-bold text-green-700 hover:bg-green-50">
                {uploading === 'banner' ? '上傳中…' : c.banner_image_url ? '更換背景圖' : '🖼️ 上傳背景圖'}
                <input type="file" accept="image/*" className="hidden" onChange={e => { onUpload('banner', e.target.files?.[0]); e.target.value = '' }} />
              </label>
              {c.banner_image_url && <button className="text-sm text-red-600" onClick={() => set('banner_image_url', '')}>移除，改回綠色背景</button>}
            </div>
          )}
          <div className="mx-auto mt-3 max-w-md">
            <p className="text-xs font-bold text-gray-500">首頁預覽（手機）</p>
            <GroupBuyBanner preview campaign={{
              slug: c.slug, title: c.title || '本月團購', is_published: true,
              starts_at: twLocalToIso(c.starts_at_local) || new Date().toISOString(),
              ends_at: twLocalToIso(c.ends_at_local) || new Date(Date.now() + 7 * 86_400_000).toISOString(),
              banner_image_url: c.banner_image_url || null,
            }} />
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className={label}>取貨方式（勾選要開放的，至少一種）</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-white p-3">
              <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="h-5 w-5 accent-green-700" checked={c.ship_711_enabled} onChange={e => set('ship_711_enabled', e.target.checked)} />7-11 冷凍取貨付款</label>
              <label className="mt-2 block text-sm text-gray-700">運費<input className={input} inputMode="numeric" value={c.fee_711} onChange={e => set('fee_711', e.target.value)} disabled={!c.ship_711_enabled} /></label>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="h-5 w-5 accent-green-700" checked={c.ship_711_normal_enabled} onChange={e => set('ship_711_normal_enabled', e.target.checked)} />7-11 常溫取貨付款</label>
              <label className="mt-2 block text-sm text-gray-700">運費<input className={input} inputMode="numeric" value={c.fee_711_normal} onChange={e => set('fee_711_normal', e.target.value)} disabled={!c.ship_711_normal_enabled} /></label>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="h-5 w-5 accent-green-700" checked={c.ship_home_enabled} onChange={e => set('ship_home_enabled', e.target.checked)} />黑貓冷凍宅配（貨到付款）</label>
              <label className="mt-2 block text-sm text-gray-700">運費<input className={input} inputMode="numeric" value={c.fee_home} onChange={e => set('fee_home', e.target.value)} disabled={!c.ship_home_enabled} /></label>
            </div>
          </div>
          <label className="mt-3 block text-sm font-bold text-gray-700">滿額免運門檻（選填，留空＝不免運）
            <input className={input} inputMode="numeric" value={c.free_shipping_threshold} onChange={e => set('free_shipping_threshold', e.target.value)} placeholder="例如 3000" />
          </label>
        </div>

        <DescriptionEditor label="團購說明（選填，顯示在商品下方）" value={c.description} onChange={v => set('description', v)} max={5000} rows={6}
          placeholder={'品牌介紹、保存方式、食用方式…\n（文案請避免「治療」「預防疾病」等療效用語）'} />
      </section>

      {/* ── 團購商品 ─────────────────────────────── */}
      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">團購商品（{items.length}）</h2>
          <button onClick={() => setItems(list => [...list, EMPTY_ITEM()])} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-bold text-white">＋ 新增商品</button>
        </div>
        <div className="mt-3 space-y-3">
          {items.map((it, i) => (
            <div key={it.key} className={`card p-4 ${it.is_active ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-gray-800">#{i + 1} {it.name || '（未命名）'}{it.sold > 0 && <span className="ml-2 text-sm font-semibold text-red-600">已售 {it.sold}</span>}</p>
                <div className="flex gap-1 text-sm">
                  <button className="rounded border px-2 py-1" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button className="rounded border px-2 py-1" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <label className="flex items-center gap-1 rounded border px-2 py-1"><input type="checkbox" checked={it.is_active} onChange={e => setItem(it.key, { is_active: e.target.checked })} />上架</label>
                  <button className="rounded border border-red-200 px-2 py-1 text-red-600" onClick={() => remove(it)}>移除</button>
                </div>
              </div>
              <div className="mt-3 flex gap-3">
                <label className="flex h-24 w-24 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-center text-xs text-gray-500">
                  {uploading === it.key ? '上傳中…' : it.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={it.image_url} alt="" className="h-full w-full object-cover" /> : '＋ 商品圖'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => onUpload(it.key, e.target.files?.[0])} />
                </label>
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <label className={label}>商品名稱<input className={input} value={it.name} onChange={e => setItem(it.key, { name: e.target.value })} placeholder="邱家鱸魚精" /></label>
                  <label className={label}>規格<input className={input} value={it.spec} onChange={e => setItem(it.key, { spec: e.target.value })} placeholder="60ml × 6 入／盒" /></label>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className={label}>團購價<input className={input} inputMode="numeric" value={it.price} onChange={e => setItem(it.key, { price: e.target.value })} /></label>
                <label className={label}>原價（選填）<input className={input} inputMode="numeric" value={it.original_price} onChange={e => setItem(it.key, { original_price: e.target.value })} /></label>
                <label className={label}>每人限購（選填）<input className={input} inputMode="numeric" value={it.per_person_limit} onChange={e => setItem(it.key, { per_person_limit: e.target.value })} placeholder="不限" /></label>
                <label className={label}>總量（選填）<input className={input} inputMode="numeric" value={it.total_quota} onChange={e => setItem(it.key, { total_quota: e.target.value })} placeholder="不限" /></label>
              </div>
              <div className="mt-2">
                <DescriptionEditor label="商品介紹（選填）" value={it.description} onChange={v => setItem(it.key, { description: v })} max={3000} rows={4} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 儲存列 ─────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:left-60">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-sm text-gray-600">{c.is_published ? '🟢 開啟中：前台看得到' : '⚪ 已關閉：前台看不到'}</span>
          {!isNew && c.is_published && <a href={`/group-buy/${c.slug}`} target="_blank" rel="noopener" className="rounded-lg border px-3 py-2 text-sm font-semibold">看前台 ↗</a>}
          <button disabled={saving} onClick={() => save()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold disabled:opacity-40">儲存</button>
          <button disabled={saving} onClick={() => save(!c.is_published)}
            className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-40 ${c.is_published ? 'bg-gray-600' : 'bg-green-700'}`}>
            {c.is_published ? '儲存並關閉團購' : '儲存並開啟團購'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 團購說明／商品介紹的編輯框：可以插入圖片。
 * 按「插入圖片」選照片 → 自動上傳 → 插在游標的位置（自成一行），前台顯示成整張圖。
 * 文字框裡看到的是 ![](網址)，不用動它；下面的縮圖列可以看到插了哪些圖、一鍵移除。
 */
function DescriptionEditor({ label: title, value, onChange, max, rows, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; max: number; rows: number; placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [busy, setBusy] = useState(false)
  const images = listImages(value)

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    let text = value
    let pos = ref.current?.selectionStart ?? text.length
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        const url = await upload(file)
        const next = insertImage(text, pos, url)
        if (next.text.length > max) { toast.error(`字數超過上限 ${max}，這張圖放不進去，請刪掉一些文字或圖片`); break }
        text = next.text; pos = next.cursor
        onChange(text)
      }
      requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上傳失敗')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <span className="text-sm font-bold text-gray-700">{title}</span>
        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-green-600 bg-white px-3 py-1.5 text-sm font-bold text-green-700 hover:bg-green-50 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          🖼️ {busy ? '上傳中…' : '插入圖片'}
          <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={e => { addImages(e.target.files); e.target.value = '' }} />
        </label>
      </div>
      <textarea ref={ref} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-[15px] focus:border-green-600 focus:outline-none"
        rows={rows} value={value} onChange={e => onChange(e.target.value)} maxLength={max} placeholder={placeholder} />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>先把游標點在要放圖的地方，再按「插入圖片」（可一次選多張）</span>
        <span className={value.length > max * 0.9 ? 'font-bold text-amber-700' : ''}>{value.length} / {max} 字</span>
      </div>
      {images.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <li key={`${img.line}-${img.url}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`第 ${i + 1} 張`} className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
              <button type="button" onClick={() => onChange(removeImageLine(value, img.line))}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow" aria-label={`移除第 ${i + 1} 張圖`}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
