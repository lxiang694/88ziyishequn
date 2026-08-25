'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Overview {
  records_submitted: number; records_returned: number; records_reviewed: number
  summaries_draft: number; summaries_published: number; summaries_withdrawn: number
  incidents_open: number; incidents_resolved: number
  lines_pending: number; lines_approved: number
}

const CARDS: { k: keyof Overview; label: string; href: string; tone: string }[] = [
  { k: 'records_submitted', label: '待核對服務紀錄', href: '/admin/care/records?status=submitted', tone: 'bg-amber-50 border-amber-200 text-amber-900' },
  { k: 'records_returned', label: '已退回補正', href: '/admin/care/records?status=returned_for_revision', tone: 'bg-orange-50 border-orange-200 text-orange-900' },
  { k: 'summaries_draft', label: '待審核小結', href: '/admin/care/summaries?status=in_review', tone: 'bg-amber-50 border-amber-200 text-amber-900' },
  { k: 'summaries_published', label: '已發布小結', href: '/admin/care/summaries?status=published', tone: 'bg-green-50 border-green-200 text-green-900' },
  { k: 'incidents_open', label: '待處理異常', href: '/admin/care/incidents?status=open', tone: 'bg-red-50 border-red-200 text-red-900' },
  { k: 'incidents_resolved', label: '已處理異常', href: '/admin/care/incidents?status=resolved', tone: 'bg-blue-50 border-blue-200 text-blue-900' },
]

export default function ServiceControlPage() {
  const [d, setD] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/care/service-control').then(r => r.json())
      .then(x => { x.success ? setD(x.data) : setError(x.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])

  const total = d ? Object.values(d).reduce((a, b) => a + (b as number), 0) : 0

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">🩺 服務控制台</h1>
      <p className="text-gray-600 text-sm mb-5">
        服務履約的待辦總覽。金額相關請見「結算明細與批次」，需另外的財務權限。
      </p>

      {loading ? <div className="card p-10 text-center text-gray-600">載入中…</div>
        : error ? (
          <div className="card p-8 text-center">
            <p className="text-red-600 font-bold text-lg mb-2">⚠️ {error}</p>
            <p className="text-gray-700 text-[15px]">
              若提到資料表不存在，請先執行{' '}
              <code className="px-1.5 py-0.5 bg-gray-100 rounded">migrations/care_fulfilment_schema.sql</code>
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {CARDS.map(c => (
                <Link key={c.k} href={c.href} className={`rounded-2xl border-2 p-4 hover:brightness-95 ${c.tone}`}>
                  <p className="text-3xl font-bold">{d?.[c.k] ?? 0}</p>
                  <p className="text-[15px] font-semibold mt-1">{c.label}</p>
                </Link>
              ))}
            </div>

            {total === 0 && (
              <div className="card p-8 text-center">
                <p className="text-lg font-semibold text-gray-800 mb-1">目前沒有待處理的履約事項</p>
                <p className="text-gray-700 text-[15px] leading-relaxed">
                  陪診員在服務當天於自己的工單記錄流程節點並送出服務紀錄後，就會出現在這裡。
                </p>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <p className="font-bold text-slate-900 text-base mb-2">這個系統不做的事</p>
              <ul className="text-slate-700 text-[15px] leading-relaxed space-y-1">
                <li>· 不是病歷系統：服務紀錄與小結都不記錄診斷、處方、劑量或治療建議。</li>
                <li>· 不是急救系統：現場緊急狀況請依院方流程與服務 SOP 處理，異常事件只做營運記錄與升級。</li>
                <li>· 沒有自動通知：系統不會自行發送 LINE／簡訊／Email，通知一律由人工聯繫。</li>
              </ul>
            </div>
          </>
        )}
    </div>
  )
}
