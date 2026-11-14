'use client'
/**
 * 後台「商品介紹」：一個欄位，整篇貼上。
 *
 * 管理員把整篇文案（重點、特色、適合誰、使用方法、搭配建議、成分規格、注意事項、保存方式…）
 * 一次貼進來，前台依小標題自動分區排版（lib/productSections.ts）。這裡：
 *   • 貼上時清掉看不見的東西（零寬字元、行尾空白、多餘空行），文字不改
 *   • 上方即時顯示「已辨識：重點 ✓ 特色 ✓ …」，一看就知道小標有沒有被認出來
 *   • 「前台預覽」用前台同一個元件顯示
 *   • 空的時候可以「插入建議格式」，照著填就好
 */
import { useState } from 'react'
import { cleanPastedText } from '@/lib/productText'
import { splitSections, KIND_LABEL, type SectionKind } from '@/lib/productSections'
import ProductDescription from '@/components/front/ProductDescription'

const TEMPLATE = `商品重點
（一句話寫最重要的三件事，例如：每錠 500mg・素食膠囊・每日 1 錠）

產品特色
01｜第一個特色
簡短說明

02｜第二個特色
簡短說明

適合誰
常熬夜、作息不規律
三餐外食、蔬果吃得少

使用方法
每日 1 錠，飯後以溫水食用。

搭配建議
（選填）

成分規格
成分：
容量：
產地：

注意事項
孕婦、哺乳期、服藥中請先諮詢醫師。

保存方式
置於陰涼乾燥處，避免陽光直射。`

const SHOWN: SectionKind[] = ['summary', 'features', 'who', 'usage', 'pairing', 'spec', 'caution', 'storage']

export default function DescriptionField({ value, onChange, shortIntro, timings, action }: {
  value: string
  onChange: (v: string) => void
  shortIntro?: string
  timings?: string[]
  action?: React.ReactNode
}) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const kinds = new Set(splitSections(value).map(s => s.kind))
  const rows = Math.min(28, Math.max(10, value.split('\n').length + 2))

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text/plain')
    if (!pasted) return
    const cleaned = cleanPastedText(pasted)
    if (cleaned === pasted) return
    e.preventDefault()
    const el = e.currentTarget
    onChange(value.slice(0, el.selectionStart) + cleaned + value.slice(el.selectionEnd))
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-gray-100 p-1 text-sm font-bold">
          {(['edit', 'preview'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 ${tab === t ? 'bg-white text-green-800 shadow-sm' : 'text-gray-500'}`}>
              {t === 'edit' ? '✏️ 貼上／編輯' : '👀 前台預覽'}
            </button>
          ))}
        </div>
        {action}
        {!value.trim() && (
          <button type="button" onClick={() => onChange(TEMPLATE)} className="rounded-lg border border-green-600 px-3 py-1.5 text-[13px] font-bold text-green-700 hover:bg-green-50">
            插入建議格式
          </button>
        )}
      </div>

      {/* 已辨識的區塊：小標有沒有被認出來，一眼就知道 */}
      {value.trim() && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-gray-500">已辨識：</span>
          {SHOWN.map(k => (
            <span key={k} className={`rounded-full px-2 py-0.5 font-bold ${kinds.has(k) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'}`}>
              {KIND_LABEL[k]}{kinds.has(k) ? ' ✓' : ''}
            </span>
          ))}
        </div>
      )}

      {tab === 'edit' ? (
        <textarea className="form-input font-[inherit] leading-relaxed" rows={rows} value={value}
          onChange={e => onChange(e.target.value)} onPaste={onPaste}
          placeholder={'整篇貼上就好。小標題單獨一行，例如：\n\n商品重點\n產品特色\n01｜第一個特色\n適合誰\n使用方法\n搭配建議\n成分規格\n注意事項\n保存方式'} />
      ) : (
        <div className="rounded-xl border border-green-200 bg-canvas p-3">
          <p className="mb-2 text-[12px] font-bold text-green-700">客人在手機上看到的樣子</p>
          <div className="mx-auto max-w-[420px]">
            {value.trim() ? <ProductDescription text={value} shortIntro={shortIntro} timings={timings} /> : <p className="py-8 text-center text-sm text-gray-500">還沒有內容</p>}
          </div>
        </div>
      )}
      <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500">
        小標題單獨一行（例如「適合誰」「使用方法」「注意事項」），前台會自動分區；「01｜標題」會變成特色卡；「成分：…」一行一項會排成表格。
      </p>
    </div>
  )
}
