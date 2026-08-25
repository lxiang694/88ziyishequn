'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Overview {
  pending_review: number; in_review: number; needs_more_information: number; declined: number
  quote_draft: number; awaiting_quote_confirmation: number
  awaiting_payment: number; ready_to_match: number; cancelled: number
}

/**
 * 陪診營運總覽。
 * 只顯示本輪真實存在的計數 —— 沒有營收、轉換率或服務人次。
 */
const CARDS: { key: keyof Overview; label: string; href: string; tone: string }[] = [
  { key: 'pending_review', label: '待初評', href: '/admin/care/intakes?status=submitted', tone: 'bg-amber-50 border-amber-200 text-amber-900' },
  { key: 'in_review', label: '審查中', href: '/admin/care/intakes?status=in_review', tone: 'bg-blue-50 border-blue-200 text-blue-900' },
  { key: 'needs_more_information', label: '需補資料', href: '/admin/care/intakes?status=needs_more_information', tone: 'bg-orange-50 border-orange-200 text-orange-900' },
  { key: 'quote_draft', label: '待發送報價', href: '/admin/care/quotes?status=draft', tone: 'bg-slate-50 border-slate-200 text-slate-900' },
  { key: 'awaiting_quote_confirmation', label: '等待家屬確認', href: '/admin/care/cases?status=awaiting_quote_confirmation', tone: 'bg-blue-50 border-blue-200 text-blue-900' },
  { key: 'awaiting_payment', label: '等待付款確認', href: '/admin/care/cases?status=awaiting_payment', tone: 'bg-orange-50 border-orange-200 text-orange-900' },
  { key: 'ready_to_match', label: '準備媒合', href: '/admin/care/cases?status=ready_to_match', tone: 'bg-green-50 border-green-200 text-green-900' },
  { key: 'cancelled', label: '已取消', href: '/admin/care/cases?status=cancelled', tone: 'bg-gray-50 border-gray-200 text-gray-800' },
]

export default function CareOperationsOverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/care/overview')
      .then(r => r.json())
      .then(d => { d.success ? setData(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])

  const total = data ? (Object.values(data) as number[]).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-800">🩺 陪診營運總覽</h1>
        <p className="text-gray-600 text-sm mt-0.5">
          初步需求 → 人工初評 → 報價草稿 → 家屬確認 → 等待付款／準備媒合
        </p>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-600">載入中…</div>
      ) : error ? (
        <div className="card p-8 text-center">
          <p className="text-red-600 font-bold text-lg mb-2">⚠️ {error}</p>
          <p className="text-gray-700 text-[15px] leading-relaxed">
            若訊息提到資料表不存在，請先到 Supabase SQL Editor 執行{' '}
            <code className="px-1.5 py-0.5 bg-gray-100 rounded">migrations/care_operations_schema.sql</code>
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {CARDS.map(c => (
              <Link key={c.key} href={c.href}
                className={`rounded-2xl border-2 p-4 transition-colors hover:brightness-95 ${c.tone}`}>
                <p className="text-3xl font-bold">{data?.[c.key] ?? 0}</p>
                <p className="text-[15px] font-semibold mt-1">{c.label}</p>
              </Link>
            ))}
          </div>

          {total === 0 && (
            <div className="card p-8 text-center">
              <p className="text-lg font-semibold text-gray-800 mb-1">目前還沒有任何陪診需求</p>
              <p className="text-gray-700 text-[15px] leading-relaxed">
                客戶在 <code className="px-1.5 py-0.5 bg-gray-100 rounded">/care/assessment</code> 送出需求評估後，
                就會出現在「需求初評」。
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { href: '/admin/care/intakes', label: '📝 需求初評', desc: '審查、要求補件、婉拒或轉為案件' },
              { href: '/admin/care/cases', label: '📁 陪診案件', desc: '案件狀態、報價摘要與人工收款確認' },
              { href: '/admin/care/quotes', label: '🧾 報價管理', desc: '建立草稿、發送、確認或作廢' },
            ].map(l => (
              <Link key={l.href} href={l.href} className="card p-5 hover:border-green-400 border-2 border-transparent">
                <p className="font-bold text-gray-800 text-base">{l.label}</p>
                <p className="text-gray-600 text-sm mt-1 leading-relaxed">{l.desc}</p>
              </Link>
            ))}
          </div>

          <p className="text-gray-600 text-[13px] leading-relaxed mt-5">
            本頁不顯示營收、轉換率或服務人次；本輪也未串接任何付款或金流，
            「等待付款確認」需由客服人工確認後推進。
          </p>
        </>
      )}
    </div>
  )
}
