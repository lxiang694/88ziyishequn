/**
 * 商品介紹（前台）：整篇文案依小標題分區，每區用各自的樣式排，一眼掃讀。
 *
 *   開場     → 白卡，一般段落
 *   重點     → 深綠色摘要（最上面）
 *   特色     → 白卡＋編號特色卡（「01｜…」自動變卡）
 *   適合誰   → 綠色實心勾清單
 *   怎麼用   → 編號步驟；有「建議服用時間」時放成標籤
 *   怎麼搭   → 淺藍色提示框
 *   規格     → 「標籤：值」排成左右兩欄的表格
 *   注意事項 → 琥珀色框，一直展開（安全相關，不收起來）
 *   保存、來源 → 收成可點開的列（次要資訊）
 *
 * 文案來源：products.description（後台整篇貼上）；舊商品沒有的話，
 * 用原本分開的欄位組成一篇（legacyToDescription），所以全部商品都是同一套樣式。
 * 沒有「重點」區時，若有一句話簡介＋兩張以上特色卡，自動組一塊「先看重點」。
 */
import { renderProductText } from '@/lib/productBlocks'
import { splitSections, specRows, featureTitles, labeledItems, lineItems, type Section, type SectionKind } from '@/lib/productSections'

const ICON: Partial<Record<SectionKind, string>> = {
  intro: '🌿', features: '✨', who: '👥', usage: '📋', spec: '🧪', other: '📌', source: '🌱', storage: '📦',
}
const DEFAULT_TITLE: Partial<Record<SectionKind, string>> = {
  intro: '商品介紹', summary: '先看重點', features: '產品特色', who: '適合誰', usage: '怎麼用',
  pairing: '怎麼搭比較好', spec: '成分規格', caution: '注意事項', storage: '保存方式', source: '來源與挑選',
}

/** 打勾清單的一項：「標籤：說明」時標籤加粗、說明換行淡一點 */
function CheckItem({ label, desc }: { label: string; desc?: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-[0.2em] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-[12px] font-bold text-white" aria-hidden>✓</span>
      <span className="min-w-0">
        <span className={desc ? 'block font-bold text-gray-900' : ''}>{label}</span>
        {desc && <span className="mt-0.5 block text-[15px] leading-relaxed text-gray-500">{desc}</span>}
      </span>
    </li>
  )
}

/** 「標籤：說明」的一般條列：標籤加粗 */
function LabeledList({ items, dot = 'bg-green-600' }: { items: { label: string; desc: string }[]; dot?: string }) {
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span className={`mt-[0.7em] h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`} aria-hidden />
          <span className="min-w-0"><b className="font-bold text-gray-900">{it.label}</b><span className="opacity-60">：</span>{it.desc}</span>
        </li>
      ))}
    </ul>
  )
}

function Card({ kind, title, id, children }: { kind: SectionKind; title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 flex items-center gap-2.5 text-[18px] font-bold text-gray-900">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-base" aria-hidden>{ICON[kind] || '📌'}</span>
        {title}
      </h3>
      <div className="text-[16px] leading-[1.8] text-gray-700">{children}</div>
    </section>
  )
}

function SectionView({ s, timings, specId }: { s: Section; timings: string[]; specId?: string }) {
  const title = s.title || DEFAULT_TITLE[s.kind] || ''
  switch (s.kind) {
    case 'summary':
      return (
        <section className="rounded-2xl bg-gradient-to-br from-green-700 to-emerald-600 p-4 text-white shadow sm:p-5">
          <p className="text-[13px] font-bold opacity-80">{title}</p>
          <div className="mt-1 text-[17px] font-bold leading-relaxed">{renderProductText(s.body)}</div>
        </section>
      )
    case 'who': {
      // 「不常吃魚的人：可從植物來源補充…」→ 打勾＋粗體標籤＋淡色說明；一行一句 → 打勾清單
      const labeled = labeledItems(s.body)
      const lines = labeled ? null : lineItems(s.body)
      return (
        <Card kind="who" title={title}>
          {labeled
            ? <ul className="space-y-4">{labeled.map((it, i) => <CheckItem key={i} label={it.label} desc={it.desc} />)}</ul>
            : lines
              ? <ul className="space-y-2.5">{lines.map((l, i) => <CheckItem key={i} label={l} />)}</ul>
              : renderProductText(s.body, { list: 'check' })}
        </Card>
      )
    }
    case 'features': {
      // 「天然冷壓：保留…」一行一項 → 編號特色卡（跟「01｜標題」同樣的卡）
      const labeled = labeledItems(s.body)
      return (
        <Card kind="features" title={title}>
          {labeled
            ? <div className="space-y-3">{labeled.map((it, i) => (
                <div key={i} className="rounded-2xl bg-black/[0.035] px-4 py-3.5">
                  <p className="flex items-start gap-2.5 font-bold leading-snug text-gray-900">
                    <span className="mt-[0.1em] flex-shrink-0 rounded-md bg-green-700 px-1.5 py-0.5 text-[0.78em] tabular-nums text-white">{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0">{it.label}</span>
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{it.desc}</p>
                </div>))}</div>
            : renderProductText(s.body)}
        </Card>
      )
    }
    case 'usage':
      return (
        <Card kind="usage" title={title}>
          {timings.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {timings.map(t => <span key={t} className="rounded-full bg-green-50 px-3 py-1.5 text-[14px] font-bold text-green-800">⏰ {t}</span>)}
            </div>
          )}
          {(() => {
            // 「每日用量：1 湯匙」這種一行一項 → 表格；否則照一般段落／步驟
            const rows = specRows(s.body)
            return rows
              ? <dl className="divide-y divide-gray-100 text-[15px]">{rows.map((r, i) => (
                  <div key={i} className="flex gap-3 py-2.5"><dt className="w-24 flex-shrink-0 text-gray-500">{r.label}</dt><dd className="min-w-0 font-semibold text-gray-900">{r.value}</dd></div>))}</dl>
              : renderProductText(s.body)
          })()}
        </Card>
      )
    case 'pairing':
      return (
        <section className="rounded-2xl border-l-4 border-sky-400 bg-sky-50 p-4 sm:p-5">
          <h3 className="mb-1.5 flex items-center gap-2 font-bold text-sky-900">💡 {title}</h3>
          <div className="text-[15px] leading-relaxed text-sky-900/85">{renderProductText(s.body)}</div>
        </section>
      )
    case 'spec': {
      const rows = specRows(s.body)
      return (
        <Card kind="spec" title={title} id={specId}>
          {rows
            ? <dl className="divide-y divide-gray-100 text-[15px]">{rows.map((r, i) => (
                <div key={i} className="flex gap-3 py-2.5">
                  <dt className="w-24 flex-shrink-0 text-gray-500">{r.label}</dt>
                  <dd className="min-w-0 font-semibold text-gray-900">{r.value}</dd>
                </div>))}</dl>
            : renderProductText(s.body)}
        </Card>
      )
    }
    case 'caution':
      return (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-amber-900">⚠️ {title}</h3>
          <div className="text-[15px] leading-relaxed text-amber-900/90">
            {(() => {
              const labeled = labeledItems(s.body)
              const lines = labeled ? null : lineItems(s.body, 60)
              if (labeled) return <LabeledList items={labeled} dot="bg-amber-500" />
              if (lines) return <ul className="space-y-2">{lines.map((l, i) => (
                <li key={i} className="flex gap-2.5"><span className="mt-[0.7em] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" aria-hidden />{l}</li>))}</ul>
              return renderProductText(s.body)
            })()}
          </div>
        </section>
      )
    case 'storage':
    case 'source':
      return (
        <details className="group rounded-2xl bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-[16px] font-bold text-gray-800 sm:px-5">
            <span>{ICON[s.kind]} {title}</span>
            <span className="text-gray-400 transition-transform group-open:rotate-90" aria-hidden>▸</span>
          </summary>
          <div className="px-4 pb-4 text-[15px] leading-relaxed text-gray-700 sm:px-5">{renderProductText(s.body)}</div>
        </details>
      )
    default: {
      const labeled = labeledItems(s.body)
      return <Card kind={s.kind} title={title}>{labeled ? <LabeledList items={labeled} /> : renderProductText(s.body)}</Card>
    }
  }
}

export default function ProductDescription({ text, shortIntro, timings = [] }: { text: string; shortIntro?: string | null; timings?: string[] }) {
  const sections = splitSections(text)
  if (sections.length === 0) return null
  const hasSummary = sections.some(s => s.kind === 'summary')
  const titles = featureTitles(sections)
  const firstSpec = sections.findIndex(s => s.kind === 'spec')
  // 次要的（保存、來源）排到最後；其他照文案順序
  const ordered = [...sections.filter(s => s.kind !== 'storage' && s.kind !== 'source'), ...sections.filter(s => s.kind === 'storage' || s.kind === 'source')]
  const usageShown = sections.some(s => s.kind === 'usage')

  return (
    <div className="space-y-3">
      {/* 沒有「重點」區：一句話簡介＋特色卡的小標，自動組一塊「先看重點」 */}
      {!hasSummary && titles.length >= 2 && (
        <section className="rounded-2xl bg-gradient-to-br from-green-700 to-emerald-600 p-4 text-white shadow sm:p-5">
          <p className="text-[13px] font-bold opacity-80">先看重點</p>
          {shortIntro && <p className="mt-1 text-[17px] font-bold leading-snug">{shortIntro}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5 text-[13px] font-bold">
            {titles.slice(0, 4).map((t, i) => <span key={i} className="rounded-full bg-white/20 px-2.5 py-1">{'①②③④'[i]} {t}</span>)}
          </div>
        </section>
      )}
      {ordered.map((s, i) => <SectionView key={i} s={s} timings={s.kind === 'usage' ? timings : []} specId={sections.indexOf(s) === firstSpec ? 'spec' : undefined} />)}
      {/* 有建議服用時間、但文案裡沒有「怎麼用」區：單獨放一塊 */}
      {!usageShown && timings.length > 0 && <SectionView s={{ kind: 'usage', title: '建議服用時間', body: '' }} timings={timings} />}
    </div>
  )
}
