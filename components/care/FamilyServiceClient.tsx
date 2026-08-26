'use client'
import { useEffect, useState } from 'react'
import FamilyClosurePanel from './FamilyClosurePanel'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { CARE_CTA } from '@/lib/careBrand'
import { EVENT_LABELS, labelOf } from '@/lib/care/fulfilment/labels'

/**
 * 家屬端服務頁。
 *
 * 授權模型：必須是已登入的會員，且該筆服務對這個帳號有一列未撤回的授權。
 * 網址可以被猜到，但沒有授權就只會看到「找不到」——後端一律回 404，
 * 不會透露這筆服務是否存在。
 *
 * 這裡只顯示已發布的小結與已開放的進度，不含內部服務紀錄、
 * 異常事件詳情、陪診員身分或任何金額。
 */
interface View {
  booking: { booking_no: string; status: string; service_name: string | null; service_date: string; hospital: string | null; patient_name: string }
  scopes: { view_service_summary: boolean; receive_service_notification: boolean }
  events: { event_type: string; family_note: string | null; occurred_at: string }[]
  summary: {
    version_number: number; published_at: string | null
    service_window_text: string | null; completed_steps_text: string | null
    family_actions_text: string | null; next_arrangement_text: string | null
    handover_status_text: string | null
  } | null
}

export default function FamilyServiceClient({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<'loading' | 'anon' | 'denied' | 'ok' | 'error'>('loading')
  const [view, setView] = useState<View | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) { if (!cancelled) setState('anon'); return }

        const res = await fetch(`/api/family/service/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 404 || res.status === 403) { if (!cancelled) setState('denied'); return }
        const d = await res.json()
        if (!d.success) { if (!cancelled) setState('error'); return }
        if (!cancelled) { setView(d.data); setState('ok') }
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [bookingId])

  const Frame = ({ children }: { children: React.ReactNode }) => (
    <div className="max-w-2xl mx-auto px-4 py-12">{children}</div>
  )

  if (state === 'loading') return <Frame><p className="text-slate-600 text-center">載入中…</p></Frame>

  if (state === 'anon') return (
    <Frame>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-2">請先登入</h1>
        <p className="text-slate-700 text-[15px] leading-relaxed mb-5">
          服務進度只開放給被指定的家屬查看，需要先登入才能確認身分。
        </p>
        <Link href="/login"
          className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl bg-emerald-700 text-white font-bold">
          前往登入
        </Link>
      </div>
    </Frame>
  )

  if (state === 'denied') return (
    <Frame>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-2">找不到這筆服務</h1>
        <p className="text-slate-700 text-[15px] leading-relaxed mb-5">
          可能是網址有誤，或這個帳號尚未被指定為可查看的家屬。
          如需開通，請透過 LINE 與我們聯繫。
        </p>
        <a href={CARE_CTA.secondary.href} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl border-2 border-emerald-700 text-emerald-800 font-bold">
          {CARE_CTA.secondary.label}
        </a>
      </div>
    </Frame>
  )

  if (state === 'error' || !view) return (
    <Frame><p className="text-red-700 text-center font-semibold">載入失敗，請稍後再試。</p></Frame>
  )

  const b = view.booking

  return (
    <Frame>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <p className="text-emerald-800 font-semibold text-[13px]">服務進度</p>
        <h1 className="text-xl font-bold text-slate-900 mt-1">{b.service_date}・{b.service_name}</h1>
        <p className="text-slate-600 text-[15px] mt-1">{b.hospital}｜就診人：{b.patient_name}</p>
        <p className="text-slate-500 text-[13px] mt-1 font-mono">{b.booking_no}</p>
      </div>

      {view.scopes.receive_service_notification && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
          <h2 className="font-bold text-slate-900 text-base mb-3">當日進度</h2>
          {view.events.length === 0 ? (
            <p className="text-slate-600 text-[15px]">目前還沒有進度更新。</p>
          ) : (
            <ol className="space-y-3">
              {view.events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="w-2 h-2 rounded-full bg-emerald-600 mt-2.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-900 text-[15px]">
                      {labelOf(EVENT_LABELS, e.event_type)}
                      <span className="text-slate-500 font-normal ml-2">{e.occurred_at?.slice(11, 16)}</span>
                    </p>
                    {e.family_note && <p className="text-slate-700 text-[15px] leading-relaxed">{e.family_note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {view.scopes.view_service_summary && (
        view.summary ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="font-bold text-slate-900 text-base">服務小結</h2>
              <span className="text-slate-500 text-[13px]">
                第 {view.summary.version_number} 版・{view.summary.published_at?.slice(0, 10)}
              </span>
            </div>
            <dl className="space-y-3">
              {([
                ['服務時間', view.summary.service_window_text],
                ['已完成流程', view.summary.completed_steps_text],
                ['需您確認的事項', view.summary.family_actions_text],
                ['下次安排', view.summary.next_arrangement_text],
                ['交接狀態', view.summary.handover_status_text],
              ] as const).filter(([, v]) => !!v).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-slate-500 text-[13px] font-semibold">{k}</dt>
                  <dd className="text-slate-800 text-[15px] leading-relaxed">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
            <h2 className="font-bold text-slate-900 text-base mb-1">服務小結</h2>
            <p className="text-slate-700 text-[15px] leading-relaxed">
              小結會在服務結束、內部核對完成後發布，屆時這裡就會出現。
            </p>
          </div>
        )
      )}

      {/* Sprint E：通知、回饋與意見；每個 API 都會再驗一次單筆授權 */}
      <div className="mb-5">
        <FamilyClosurePanel bookingId={Number(bookingId)} />
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <p className="text-slate-700 text-[15px] leading-relaxed">
          這份紀錄只描述<strong>就醫當天的流程</strong>，不是醫療紀錄，也不包含診斷、檢查結果或用藥說明。
          任何與病情、報告或用藥有關的問題，請直接向醫療人員確認。
        </p>
        <p className="text-slate-600 text-[13px] leading-relaxed mt-2">
          有疑問或需要調整可查看的家屬，請透過 LINE 與我們聯繫。
        </p>
      </div>
    </Frame>
  )
}
