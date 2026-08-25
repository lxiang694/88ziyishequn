import type { Metadata } from 'next'
import Link from 'next/link'
import { careBrand } from '@/lib/careBrand'
import { CarePageHero, CareSection, CareCard, CareBottomCTA } from '@/components/care/CareUI'

export const metadata: Metadata = {
  title: `常見問題｜${careBrand.name}`,
  description: '什麼情境適合陪診、陪診員能做與不能做什麼、家屬如何收到回報、交通協助與陪同的差別，以及術後離院的注意事項。',
}

const FAQS: { q: string; a: string[]; id?: string }[] = [
  {
    q: '什麼情境適合使用陪診？',
    a: [
      '需要有人協助處理就醫當天的流程與資訊時最適合：例如固定回診拿慢箋、看診當天還要做檢查、同一天要跑多個科別，或術後依院方規定需要有人陪同離院。',
      '如果就診人需要的是醫療照護、護理處置或長時間居家照顧，那屬於不同性質的服務，陪診無法取代。',
    ],
  },
  {
    q: '陪診員能做什麼、不能做什麼？',
    a: [
      '能做的是流程協助：協助報到、院內動線帶路、候診陪伴、協助流程銜接（檢查、批價、領藥等行政環節），以及記錄院方交代的後續事項並回報家屬。',
      '不能做的是醫療相關判斷：不提供診斷與醫療建議、不判讀報告、不調整用藥、不執行醫療處置、不代簽同意書，也不代替病人或家屬做醫療決定。',
    ],
  },
  {
    q: '家屬如何收到回報？',
    a: [
      '回報節點在服務前一起確認，通常包含到院會合、流程進度、需要家屬確認的事項，以及服務結束後的小結。',
      '回報內容以流程進度與行政事項為主。涉及診斷、檢查結果或用藥的問題，仍須由醫療人員說明。',
    ],
  },
  {
    q: '交通協助和陪同是同一件事嗎？',
    a: [
      '不是。陪同指的是在院內全程協助流程；交通協助是額外的接送安排，屬於加購項目，費用另計。',
      '只選陪同時，會約在院內或院門口會合。需要到府接送時請在需求評估中註明，由專人確認可行方式與費用。',
    ],
  },
  {
    q: '術後或麻醉離院需要注意什麼？',
    a: [
      '無痛檢查或日間手術後，院方通常規定必須有人陪同離院，且當天不建議自行騎車或開車。',
      '這類服務的時間較不固定，會依恢復狀況調整。實際能否進入恢復室、何時可以離院，都以院方判斷為準。',
      '陪診員可以協助辦理離院的行政流程與安全返家安排，但不會參與任何醫療判斷。',
    ],
  },
  {
    q: '長照資源和自費陪診要怎麼理解？',
    a: [
      '長照相關資源有各自的申請條件與服務範圍，通常需要經過評估程序，適合有持續性照顧需求的情況。',
      '自費陪診則是單次、按需求安排，適合臨時就醫、家屬無法到場的狀況，不需要事先取得資格。',
      '兩者性質不同，可以並存。若不確定哪一種比較符合需求，可以先描述狀況，由專人協助判斷。',
    ],
  },
  {
    id: 'prepare',
    q: '就醫當天要準備什麼？',
    a: [
      '基本文件：健保卡、身分證明、慢性處方箋或回診單，以及正在服用的藥物清單或藥袋。',
      '行動輔具：習慣使用的助行器或輪椅；若需院方借用輪椅，請先於需求評估中告知。',
      '聯絡安排：確認當天可即時聯繫的家屬，以及希望在哪些節點收到回報。',
      '這份清單為一般性的行政準備提醒，不包含任何醫療指示；若對檢查前的禁食、停藥等事項有疑問，請直接詢問醫療人員。',
    ],
  },
]

export default function CareFaqPage() {
  return (
    <>
      <CarePageHero
        eyebrow="常見問題"
        title="開始之前，先確認這些"
        lead="以下是最常被問到的問題。若您的情況不在其中，也可以直接送出需求評估，由專人與您確認。"
      />

      <CareSection>
        <div className="space-y-3">
          {FAQS.map(f => (
            <CareCard key={f.q} className={f.id ? 'scroll-mt-24' : ''}>
              <div id={f.id} className="scroll-mt-24">
                <h2 className="font-bold text-slate-900 text-lg leading-snug mb-2">{f.q}</h2>
                <div className="space-y-2">
                  {f.a.map((p, i) => (
                    <p key={i} className="text-slate-700 text-[15px] leading-relaxed">{p}</p>
                  ))}
                </div>
              </div>
            </CareCard>
          ))}
        </div>
      </CareSection>

      <CareSection>
        <p className="text-slate-700 text-[15px] leading-relaxed">
          服務邊界與資料處理的完整說明，請見{' '}
          <Link href="/care/safety"
            className="text-emerald-800 font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded">
            安全、隱私與服務邊界
          </Link>
          。
        </p>
      </CareSection>

      <CareBottomCTA />
    </>
  )
}
