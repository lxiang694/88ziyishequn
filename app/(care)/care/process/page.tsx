import type { Metadata } from 'next'
import { careBrand } from '@/lib/careBrand'
import { CarePageHero, CareSection, CareCard, CareNotice, CareList, CareBottomCTA } from '@/components/care/CareUI'

export const metadata: Metadata = {
  title: `服務如何進行｜${careBrand.name}`,
  description: '從需求確認、服務前對焦、院內流程協助，到固定節點回報家屬與服務小結，完整說明陪同就醫的每一段流程。',
}

const PHASES = [
  {
    phase: '服務前',
    lead: '把當天要做的事講清楚，避免現場才發現做不到。',
    items: [
      '確認就醫情境、日期、院所、科別與預估時間。',
      '確認行動協助需求：可自行行走、助行器或需輪椅。',
      '確認交通方式，以及是否需要到府接送等額外協助。',
      '確認完整費用與超時規則，雙方同意後才安排。',
      '確認家屬希望在哪些節點收到回報、由誰接收。',
    ],
  },
  {
    phase: '服務中',
    lead: '陪診員處理的是流程與資訊，不介入醫療判斷。',
    items: [
      '約定地點會合，確認就診人狀況後開始協助。',
      '協助報到與院內動線帶路，減少走錯樓層或漏站。',
      '候診陪伴，協助與櫃檯或行政窗口溝通流程問題。',
      '協助流程銜接：檢查、批價、領藥等行政環節。',
      '記錄院方交代的後續事項，例如報告時間與回診安排。',
      '依約定節點回報家屬進度。',
    ],
  },
  {
    phase: '服務後',
    lead: '把當天發生的事整理成家屬看得懂的內容。',
    items: [
      '整理當次流程小結，說明完成了哪些環節。',
      '列出需要家屬確認或決定的事項。',
      '提醒後續行政安排，例如報告領取與下次回診時間。',
    ],
  },
]

const REPORT_POINTS = [
  { t: '到院／會合', d: '確認已與就診人會合，開始協助當日流程。' },
  { t: '流程進度', d: '完成某個階段時回報目前位置與大致等待狀況。' },
  { t: '需家屬確認事項', d: '遇到需要家屬決定的行政安排時，先詢問再進行。' },
  { t: '服務結束小結', d: '當天流程完成後，整理重點與後續提醒。' },
]

export default function CareProcessPage() {
  return (
    <>
      <CarePageHero
        eyebrow="服務如何進行"
        title="服務前、服務中、服務後"
        lead="陪診處理的是就醫流程的銜接與資訊的交接。以下說明每個階段實際會做什麼，以及家屬會在什麼時候收到訊息。"
      />

      <CareSection>
        <div className="space-y-3">
          {PHASES.map(p => (
            <CareCard key={p.phase}>
              <p className="font-bold text-emerald-800 text-lg mb-1">{p.phase}</p>
              <p className="text-slate-600 text-[15px] leading-relaxed mb-3">{p.lead}</p>
              <CareList items={p.items} />
            </CareCard>
          ))}
        </div>
      </CareSection>

      <CareSection id="report" title="家屬如何收到回報"
        lead="回報節點在服務前一起確認：太頻繁會打擾，太少又會有資訊落差。">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REPORT_POINTS.map(r => (
            <CareCard key={r.t} className="bg-slate-50">
              <p className="font-bold text-slate-900 text-[15px] mb-1">{r.t}</p>
              <p className="text-slate-700 text-[15px] leading-relaxed">{r.d}</p>
            </CareCard>
          ))}
        </div>
        <p className="text-slate-600 text-[13px] leading-relaxed mt-3">
          回報內容以流程進度與院方交代的行政事項為主。涉及診斷、檢查結果判讀或用藥調整的問題，
          仍須由醫療人員說明，陪診員不會代為解釋。
        </p>
      </CareSection>

      <CareSection title="現場可能遇到的限制">
        <CareNotice title="依院方規定為準">
          <CareList items={[
            '能否進入診間、檢查室或恢復室，各醫療院所規定不同，以現場規定為準。',
            '部分院所對陪同人數有限制，或於特定時期調整陪病規則。',
            '陪診員不會要求院方通融，也不會做出超出院方允許範圍的承諾。',
          ]} />
        </CareNotice>
      </CareSection>

      <CareBottomCTA />
    </>
  )
}
