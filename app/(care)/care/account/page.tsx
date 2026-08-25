import type { Metadata } from 'next'
import Link from 'next/link'
import { careBrand, CARE_CTA } from '@/lib/careBrand'
import { CarePageHero, CareSection, CareCard, CareNotice, CareList, CareBottomCTA } from '@/components/care/CareUI'

export const metadata: Metadata = {
  title: `預約查詢與家屬入口｜${careBrand.name}`,
  description: '查詢預約狀態與服務進度的方式，以及家屬專屬入口的開放規劃。',
}

/**
 * Sprint A 只做安全的入口頁。
 *
 * 刻意不提供「輸入預約編號即可查詢」的表單：那等同於可被列舉的公開查詢，
 * 會讓任何人猜編號就看到他人的就醫資訊。正式的查詢功能必須綁定身分驗證，
 * 留待後續 Sprint 以驗證後的家屬入口實作。
 */
export default function CareAccountPage() {
  return (
    <>
      <CarePageHero
        eyebrow="預約查詢"
        title="查詢預約與服務進度"
        lead="目前預約狀態與服務進度由專人直接與您聯繫。家屬專屬的線上入口正在準備中。"
      />

      <CareSection title="現在如何查詢">
        <CareCard>
          <CareList items={[
            '送出需求評估後，專人會主動與您聯繫確認，不需要自行查詢。',
            '已排定服務的預約，服務當天會依約定節點回報進度。',
            '想確認狀態時，請透過 LINE 聯繫並提供聯絡人姓名與就醫日期。',
          ]} />
          <div className="mt-4">
            <a href={CARE_CTA.secondary.href} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl bg-emerald-700 text-white font-bold text-base hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
              {CARE_CTA.secondary.label}
            </a>
          </div>
        </CareCard>
      </CareSection>

      <CareSection title="家屬線上入口">
        <CareNotice title="準備中">
          <p>
            家屬登入後可查看服務進度與歷次小結的線上入口，正在準備中。
            開放後會需要驗證身分才能查看，確保就醫資訊只有指定家屬看得到。
          </p>
          <p className="text-slate-600 text-[13px]">
            我們刻意不提供「輸入編號就能查詢」的公開查詢頁：那樣的設計會讓不相干的人
            猜到編號就看見他人的就醫資訊。
          </p>
        </CareNotice>
      </CareSection>

      <CareSection id="feedback" title="意見回饋">
        <CareCard>
          <p className="text-slate-700 text-[15px] leading-relaxed mb-4">
            服務過程有任何需要改進的地方，歡迎直接告訴我們。目前透過 LINE 收集回饋，
            線上回饋表單會與家屬入口一起開放。
          </p>
          <a href={CARE_CTA.secondary.href} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl border-2 border-emerald-700 text-emerald-800 font-bold text-base hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            以 LINE 提供意見
          </a>
        </CareCard>
      </CareSection>

      <CareSection>
        <p className="text-slate-700 text-[15px] leading-relaxed">
          還沒送出需求？先從{' '}
          <Link href="/care/assessment"
            className="text-emerald-800 font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded">
            需求初步評估
          </Link>
          {' '}開始。
        </p>
      </CareSection>

      <CareBottomCTA />
    </>
  )
}
