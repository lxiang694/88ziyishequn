import type { Metadata } from 'next'
import { getPublicCareServices } from '@/lib/care/service'
import { formatPrice } from '@/lib/utils'
import { careBrand } from '@/lib/careBrand'
import { CarePageHero, CareSection, CareCard, CareNotice, CareList, CareBottomCTA } from '@/components/care/CareUI'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `方案與費用｜${careBrand.name}`,
  description: '依就醫情境區分的陪同時數與協助範圍。交通、停車、掛號與醫療費用不含在內，完整費用一律由專人於服務前確認。',
}

interface Service {
  code: string
  name: string
  hours_label: string | null
  price: number
  summary: string | null
  suitable: string | null
  features: string[] | null
}

export default async function CareServicesPage() {
  // 唯讀取用既有的公開方案資料，本輪不新增也不修改任何欄位。
  // 走 Service 而非直接查 Supabase：component 不直接讀寫核心資料。
  // 刻意不顯示 member_price：會員價屬於商城語言，不應出現在陪診品牌前台。
  const services = (await getPublicCareServices()) as unknown as Service[]

  return (
    <>
      <CarePageHero
        eyebrow="方案與費用"
        title="依就醫情境選擇陪同範圍"
        lead="以下為服務類型與參考費用。實際費用會依院所、時段與實際需要的協助範圍調整，一律在服務前由專人確認後才開始。"
      />

      <CareSection>
        {services.length === 0 ? (
          <CareCard>
            <p className="font-bold text-slate-900 text-base mb-1">費用由專人確認</p>
            <p className="text-slate-700 text-[15px] leading-relaxed">
              請先送出需求評估，我們會依就醫情境與院所提供完整費用說明。
            </p>
          </CareCard>
        ) : (
          <div className="space-y-3">
            {services.map(s => (
              <CareCard key={s.code}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-900 text-lg leading-snug">{s.name}</h2>
                    {s.hours_label && (
                      <p className="text-slate-600 text-[15px] mt-0.5">{s.hours_label}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-slate-500 text-[13px]">參考費用</p>
                    <p className="text-slate-900 font-bold text-xl">{formatPrice(s.price)}</p>
                  </div>
                </div>

                {s.summary && (
                  <p className="text-slate-700 text-[15px] leading-relaxed mb-3">{s.summary}</p>
                )}

                {Array.isArray(s.features) && s.features.length > 0 && (
                  <CareList items={s.features} />
                )}

                {s.suitable && (
                  <p className="text-slate-700 text-[15px] leading-relaxed bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-3">
                    <strong className="text-slate-900">適合：</strong>{s.suitable}
                  </p>
                )}
              </CareCard>
            ))}
          </div>
        )}
      </CareSection>

      <CareSection title="費用怎麼算">
        <CareNotice title="以下項目不含在參考費用內，需另行確認">
          <CareList items={[
            '交通費與停車費：依實際里程與院所停車規則計算。',
            '掛號費、部分負擔與所有醫療相關費用：由就診人自付。',
            '超時：實際看診與檢查時間可能超出預估，超時規則於服務前一併說明。',
            '到府接送、代排隊等額外協助：屬加購項目，費用另計。',
          ]} />
          <p className="font-semibold text-slate-900">
            完整費用一律在服務開始前確認清楚，不會在服務中臨時追加未談過的項目。
          </p>
        </CareNotice>
      </CareSection>

      <CareSection title="關於服務範圍">
        <CareNotice title="陪診員不做的事">
          <CareList items={[
            '不提供醫療診斷、不判讀檢查報告、不給用藥建議。',
            '不代簽手術、麻醉或檢查同意書。',
            '不代替病人或家屬做醫療決定。',
          ]} />
        </CareNotice>
      </CareSection>

      <CareBottomCTA note="送出需求評估後，專人會依您的情境提供完整費用說明；此時尚未成立預約。" />
    </>
  )
}
