import type { Metadata } from 'next'
import { careBrand } from '@/lib/careBrand'
import { CarePageHero, CareSection, CareNotice, CareList, CareBottomCTA } from '@/components/care/CareUI'

export const metadata: Metadata = {
  title: `安全、隱私與服務邊界｜${careBrand.name}`,
  description: '陪診員能做與不能做的事、院方規定的限制、個人資料處理原則，以及取消改期與異常狀況的處理方式。',
}

export default function CareSafetyPage() {
  return (
    <>
      <CarePageHero
        eyebrow="安全與隱私"
        title="服務邊界與資料保護"
        lead="這一頁說明我們不做什麼、資料怎麼處理，以及遇到狀況時如何應對。把界線先講清楚，服務才不會出現期待落差。"
      />

      <CareSection id="boundary" title="服務邊界">
        <CareNotice title="陪診員不做的事">
          <CareList items={[
            '陪診員為就醫流程協助與陪伴人員，非醫療人員。',
            '不提供醫療診斷與醫療建議，不判讀檢查或影像報告。',
            '不調整、不代管、不代領處方以外的藥物，不執行任何醫療處置。',
            '手術、麻醉、檢查等同意書依法須由本人或法定代理人簽署，陪診員不代簽。',
            '不代替病人或家屬做醫療決定；需要決定時，會先聯繫家屬確認。',
            '不介入醫病之間的溝通結論，只協助記錄與轉達流程性資訊。',
          ]} />
        </CareNotice>
      </CareSection>

      <CareSection title="院方規定">
        <CareNotice title="現場規定優先">
          <CareList items={[
            '能否陪同進入診間、檢查室或恢復室，依各醫療院所規定，以現場為準。',
            '部分院所限制陪同人數，或於特定時期調整陪病與探病規則。',
            '若現場規定使原定協助方式無法執行，陪診員會即時告知家屬並調整可行做法。',
          ]} />
        </CareNotice>
      </CareSection>

      <CareSection title="個人資料與隱私">
        <CareNotice title="蒐集最小必要、用途限於本次服務">
          <CareList items={[
            '需求評估只蒐集安排服務所需的最低必要資訊，不要求填寫病歷、診斷或用藥內容。',
            '服務過程中知悉的就醫資訊，僅用於執行本次服務與回報指定家屬。',
            '未經同意不會將個人資料提供給第三方，也不會用於行銷用途。',
            '若服務過程需要拍攝照片，會先徵得同意，並避免拍攝其他病患與病歷畫面。',
          ]} />
          <p className="text-slate-600 text-[13px]">
            正式的個人資料蒐集告知聲明與隱私權政策條文尚待補上，將於營運主體與法務內容確認後公告。
          </p>
        </CareNotice>
      </CareSection>

      <CareSection title="家屬的重大決策">
        <CareNotice title="需要決定時，一定回到家屬與醫療人員">
          <CareList items={[
            '遇到需要選擇治療方式、是否接受檢查或簽署文件時，陪診員會停下來聯繫家屬。',
            '陪診員可以協助記錄醫療人員的說明，但不會替家屬解讀或建議該怎麼選。',
            '若當下聯繫不上家屬，以院方指示與病人本人意願為準。',
          ]} />
        </CareNotice>
      </CareSection>

      <CareSection id="cancel" title="取消、改期與異常處理">
        <CareNotice title="規則待正式公告">
          <p>
            取消與改期的期限、是否收取費用，以及臨時停診、就診人身體不適、
            服務中發生突發狀況時的處理方式，會在確認服務時以書面向您說明。
          </p>
          <p className="text-slate-600 text-[13px]">
            此區塊為預留位置：正式的取消政策條文尚未確定，確認後會於此頁公告。
            在此之前，實際規則以專人於服務前確認的內容為準。
          </p>
        </CareNotice>
      </CareSection>

      <CareSection title="關於資格與保障">
        <CareNotice title="不做未經確認的聲稱">
          <p>
            本頁不聲稱任何尚未確認的專業資格、認證、保險或合作醫療院所關係。
            陪診員的訓練內容、資格條件與相關保障方案確認後，會在此頁具體列出，
            並註明適用範圍與限制。
          </p>
        </CareNotice>
      </CareSection>

      <CareBottomCTA note="對服務範圍還有疑問，可以先用 LINE 詢問，或直接送出需求評估由專人說明。" />
    </>
  )
}
