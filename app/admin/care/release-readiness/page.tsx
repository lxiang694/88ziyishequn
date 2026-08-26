'use client'
import { useEffect, useState } from 'react'
import { READINESS_STATE_LABELS } from '@/lib/care/operations/labels'

interface Check { key: string; label: string; state: string; detail: string; manual: boolean }
interface Data {
  checks: Check[]
  summary: { ready: number; blocked: number; notApplicable: number; manualBlocked: number; overall: string }
  migrations_applied: boolean
}

export default function ReleaseReadinessPage() {
  const [d, setD] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/care/release-readiness').then(r => r.json())
      .then(r => { r.success ? setD(r.data) : setError(r.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])

  const chip = (state: string) => state === 'ready'
    ? 'bg-emerald-100 text-emerald-800'
    : state === 'blocked' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'

  const auto = d?.checks.filter(c => !c.manual) || []
  const manual = d?.checks.filter(c => c.manual) || []

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">🚦 上線檢核</h1>
      <p className="text-sm text-gray-500 mb-4">
        每一項都從真實設定與資料算出來。這一頁**沒有**手動打勾的功能——
        能打勾的檢核表只會讓人安心地上線，然後在正式環境才發現條款還是空的。
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-red-800 text-sm mb-1">載入失敗</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {loading && <div className="bg-white rounded-xl border p-8 text-center text-gray-500">檢查中…</div>}

      {d && (
        <>
          <div className={`rounded-xl border p-4 mb-5 ${
            d.summary.overall === 'ready' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`font-bold mb-1 ${d.summary.overall === 'ready' ? 'text-emerald-800' : 'text-amber-900'}`}>
              {d.summary.overall === 'ready' ? '✅ 全部就緒' : `⚠️ 還有 ${d.summary.blocked} 項待處理`}
            </p>
            <p className={`text-sm ${d.summary.overall === 'ready' ? 'text-emerald-700' : 'text-amber-800'}`}>
              已就緒 {d.summary.ready} 項・待處理 {d.summary.blocked} 項
              （其中 {d.summary.manualBlocked} 項需要人去做決定，不是寫程式能解決的）
            </p>
          </div>

          <h2 className="font-bold text-gray-800 mb-2">系統檢查</h2>
          <div className="bg-white rounded-xl border overflow-hidden mb-6">
            {auto.map(c => (
              <div key={c.key} className="flex items-start justify-between gap-3 p-4 border-b last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 text-sm">{c.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.detail}</p>
                </div>
                <span className={`text-xs font-semibold rounded px-2 py-1 flex-shrink-0 ${chip(c.state)}`}>
                  {READINESS_STATE_LABELS[c.state] || c.state}
                </span>
              </div>
            ))}
          </div>

          <h2 className="font-bold text-gray-800 mb-2">人工待決</h2>
          <p className="text-xs text-gray-500 mb-2">
            這些系統無從判斷，需要營運、法務、財務或照護專業確認後才算完成。
          </p>
          <div className="bg-white rounded-xl border overflow-hidden">
            {manual.map(c => (
              <div key={c.key} className="flex items-start justify-between gap-3 p-4 border-b last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 text-sm">{c.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.detail}</p>
                </div>
                <span className={`text-xs font-semibold rounded px-2 py-1 flex-shrink-0 ${chip(c.state)}`}>
                  {READINESS_STATE_LABELS[c.state] || c.state}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
