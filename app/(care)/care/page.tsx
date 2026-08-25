import type { Metadata } from 'next'
import Link from 'next/link'
import { careBrand, CARE_CTA, CARE_SCENARIOS } from '@/lib/careBrand'
import { CareSection, CareCard, CareNotice, CareList, CareBottomCTA } from '@/components/care/CareUI'

export const metadata: Metadata = {
  title: `${careBrand.name}｜陪同就醫、流程協助與家屬回報`,
  description: careBrand.positioning,
}

const PAIN_POINTS = [
  {
    t: '院內動線複雜',
    d: '報到、檢查室、批價、領藥分散在不同樓層與窗口，一個人跑容易走錯或漏掉其中一站。',
  },
  {
    t: '看診資訊難記',
    d: '看診時間短、資訊量大，離開診間後常常想不起醫師交代過哪些事。',
  },
  {
    t: '後續安排容易遺漏',
    d: '領藥說明、檢查報告要看哪一科、下次回診時間，這些流程性的資訊最容易漏接。',
  },
  {
    t: '家屬無法到場',
    d: '子女在外地或請不到假，臨時回診找不到人陪，也不知道當天實際狀況。',
  },
]

const FLOW = [
  {
    phase: '服務前',
    items: [
      '確認就診情境、日期、院所與行動協助需求',
      '確認當天流程重點與家屬希望被告知的事項',
      '完整費用與可協助範圍先講清楚再開始',
    ],
  },
  {
    phase: '服務中',
    items: [
      '協助報到、院內動線帶路與候診陪伴',
      '協助流程銜接（檢查、批價、領藥等行政流程）',
      '記錄流程重點與院方交代的後續事項',
      '在約定好的節點回報家屬進度',
    ],
  },
  {
    phase: '服務後',
    items: [
      '整理當次流程小結與需家屬確認的事項',
      '提醒後續行政安排，例如報告時間與下次回診',
    ],
  },
]

const FAMILY_UPDATES = [
  { t: '到院／會合', d: '已與就診人會合，開始協助當日流程。' },
  { t: '流程進度', d: '完成報到，目前於檢查區等待，預估還需一段時間。' },
  { t: '需家屬確認事項', d: '院方提到需要另約後續時段，想先與您確認方便的日期。' },
  { t: '服務結束小結', d: '今日流程已完成，重點與後續提醒整理如下。' },
]

export default function CareHomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-emerald-50 to-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
          <p className="text-emerald-800 font-semibold text-[15px] mb-3">{careBrand.name}</p>
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 leading-relaxed mb-4">
            {careBrand.tagline}
          </h1>
          <p className="text-slate-700 text-base sm:text-lg leading-relaxed mb-7">
            {careBrand.positioning}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={CARE_CTA.primary.href}
              className="min-h-[48px] px-6 flex items-center justify-center rounded-xl bg-emerald-700 text-white font-bold text-base hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
              {CARE_CTA.primary.label}
            </Link>
            <a href={CARE_CTA.secondary.href} target="_blank" rel="noopener noreferrer"
              className="min-h-[48px] px-6 flex items-center justify-center rounded-xl border-2 border-emerald-700 text-emerald-800 font-bold text-base hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              {CARE_CTA.secondary.label}
            </a>
          </div>
          <p className="text-slate-600 text-[13px] mt-4">
            送出評估不等於完成預約，也不需要先付款。
          </p>
        </div>
      </section>

      {/* 痛點 */}
      <CareSection title="這些情況，最常見" lead="陪診處理的是「流程」與「資訊」的斷點，不是醫療本身。">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PAIN_POINTS.map(p => (
            <CareCard key={p.t}>
              <p className="font-bold text-slate-900 text-base mb-1">{p.t}</p>
              <p className="text-slate-700 text-[15px] leading-relaxed">{p.d}</p>
            </CareCard>
          ))}
        </div>
      </CareSection>

      {/* 需求分流 */}
      <CareSection title="您的情況比較接近哪一種？"
        lead="選一個最接近的，評估表會依情境調整問題；不確定也可以直接選最後一項。">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CARE_SCENARIOS.map(s => (
            <Link key={s.value} href={`/care/assessment?scenario=${s.value}`}
              className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              <p className="font-bold text-slate-900 text-base mb-1">{s.label}</p>
              <p className="text-slate-700 text-[15px] leading-relaxed mb-3">{s.desc}</p>
              <span className="text-emerald-800 font-semibold text-[15px] group-hover:underline">
                以此情境開始評估
              </span>
            </Link>
          ))}
        </div>
      </CareSection>

      {/* 流程 */}
      <CareSection title="服務如何進行">
        <div className="space-y-3">
          {FLOW.map(f => (
            <CareCard key={f.phase}>
              <p className="font-bold text-emerald-800 text-base mb-2">{f.phase}</p>
              <CareList items={f.items} />
            </CareCard>
          ))}
        </div>
        <p className="text-slate-600 text-[13px] leading-relaxed mt-3">
          能否進入診間、檢查室或恢復室，依各醫療院所現場規定為準，陪診員不會做出超出院方允許範圍的承諾。
        </p>
      </CareSection>

      {/* 家屬收到什麼 */}
      <CareSection id="family" title="家屬會收到什麼"
        lead="以下為訊息形式示意，不含任何真實個案資訊。">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FAMILY_UPDATES.map(u => (
            <CareCard key={u.t} className="bg-slate-50">
              <p className="font-bold text-slate-900 text-[15px] mb-1">{u.t}</p>
              <p className="text-slate-700 text-[15px] leading-relaxed">「{u.d}」</p>
            </CareCard>
          ))}
        </div>
        <p className="text-slate-600 text-[13px] mt-3">
          回報節點與方式在服務前一起確認，避免打擾也避免資訊落差。
        </p>
      </CareSection>

      {/* 服務邊界 */}
      <CareSection title="我們不做的事">
        <CareNotice title="服務邊界">
          <CareList items={[
            '陪診員非醫療人員，不提供醫療診斷、不判讀報告、不給用藥建議。',
            '不調整、不代管藥物，也不執行任何醫療處置。',
            '手術、麻醉、檢查等同意書依法須由本人或法定代理人簽署，陪診員不代簽。',
            '不代替病人或家屬做重大醫療決定。',
          ]} />
          <p>
            <Link href="/care/safety"
              className="text-emerald-800 font-semibold underline underline-offset-2 inline-flex items-center min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded">
              完整的安全、隱私與服務邊界說明
            </Link>
          </p>
        </CareNotice>
      </CareSection>

      <CareBottomCTA />
    </>
  )
}
