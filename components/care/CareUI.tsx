import type { ReactNode } from 'react'
import Link from 'next/link'
import { CARE_CTA } from '@/lib/careBrand'

/** /care 各內頁共用的頁首區塊，保持版面一致 */
export function CarePageHero({ eyebrow, title, lead }: {
  eyebrow: string; title: string; lead?: string
}) {
  return (
    <section className="bg-slate-50 border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        <p className="text-emerald-800 font-semibold text-[15px] mb-2">{eyebrow}</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-relaxed">{title}</h1>
        {lead && <p className="text-slate-700 text-base leading-relaxed mt-3">{lead}</p>}
      </div>
    </section>
  )
}

export function CareSection({ id, title, lead, children }: {
  id?: string; title?: string; lead?: string; children: ReactNode
}) {
  return (
    <section id={id} className="max-w-3xl mx-auto px-4 py-8 scroll-mt-24">
      {title && <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{title}</h2>}
      {lead && <p className="text-slate-700 text-base leading-relaxed mb-4">{lead}</p>}
      {children}
    </section>
  )
}

export function CareCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 ${className}`}>{children}</div>
  )
}

/** 服務邊界／注意事項用的沉穩提示塊，不使用促銷色 */
export function CareNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
      <p className="font-bold text-slate-900 text-base mb-2">{title}</p>
      <div className="text-slate-700 text-[15px] leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

export function CareList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex items-start gap-2 text-slate-700 text-[15px] leading-relaxed">
          <span className="text-emerald-700 flex-shrink-0 mt-1" aria-hidden="true">·</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

/** 每一頁頁底重複提供的兩個行動 */
export function CareBottomCTA({ note }: { note?: string }) {
  return (
    <section className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
        <p className="font-bold text-slate-900 text-lg mb-1">還不確定適合哪一種？</p>
        <p className="text-slate-700 text-[15px] leading-relaxed mb-5">
          {note || '先做需求評估，由專人確認服務適配性與完整費用；此時尚未成立預約。'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={CARE_CTA.primary.href}
            className="min-h-[48px] px-6 flex items-center justify-center rounded-xl bg-emerald-700 text-white font-bold text-base hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
            {CARE_CTA.primary.label}
          </Link>
          <a href={CARE_CTA.secondary.href} target="_blank" rel="noopener noreferrer"
            className="min-h-[48px] px-6 flex items-center justify-center rounded-xl border-2 border-emerald-700 text-emerald-800 font-bold text-base hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            {CARE_CTA.secondary.label}
          </a>
        </div>
      </div>
    </section>
  )
}
