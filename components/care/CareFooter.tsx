import Link from 'next/link'
import { careBrand, CARE_FOOTER_GROUPS } from '@/lib/careBrand'

/**
 * 陪診品牌專屬頁尾。
 * 商城連結只能出現在最底部、低顯著度的位置，不得進入主選單或主要 CTA。
 */
export default function CareFooter() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 mt-16">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <p className="font-bold text-slate-900 text-lg">{careBrand.name}</p>
          <p className="text-slate-600 text-[15px] leading-relaxed mt-1 max-w-xl">
            {careBrand.tagline}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {CARE_FOOTER_GROUPS.map(g => (
            <nav key={g.title} aria-label={g.title}>
              <p className="font-bold text-slate-900 text-[15px] mb-2">{g.title}</p>
              <ul className="space-y-1">
                {g.links.map(l => (
                  <li key={l.href + l.label}>
                    <Link href={l.href}
                      className="inline-flex items-center min-h-[48px] text-slate-600 hover:text-emerald-800 text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-t border-slate-200 mt-8 pt-6">
          <p className="text-slate-600 text-[13px] leading-relaxed max-w-2xl">
            陪診員為就醫流程協助與陪伴人員，非醫療人員；不提供醫療診斷、不調整用藥，
            也不代替病人或家屬簽署文件或做醫療決定。實際可協助範圍依各醫療院所現場規定。
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <p className="text-slate-500 text-[13px]">
              © {new Date().getFullYear()} {careBrand.legalEntity || careBrand.name}
            </p>
            {/* 低顯著度的商城回鏈——刻意放在最底部 */}
            <Link href={careBrand.mall.href}
              className="text-slate-400 hover:text-slate-600 text-[13px] underline underline-offset-2 inline-flex items-center min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded">
              {careBrand.mall.label}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
