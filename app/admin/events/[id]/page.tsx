'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'

const COMPANION_LABEL: Record<number, string> = { 0: '無', 1: '1人', 2: '2人', 3: '3人', 4: '4人', 5: '5人' }

export default function AdminEventDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [event, setEvent] = useState<any>(null)
  const [registrations, setRegistrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/events/${id}`).then(r => r.json()).then(d => {
      if (d.success) { setEvent(d.data.event); setRegistrations(d.data.registrations) }
      setLoading(false)
    })
  }, [id])

  const totalPeople = registrations.reduce((s, r) => s + 1 + (r.companions || 0), 0)

  const handleExport = () => {
    if (registrations.length === 0) { toast.error('沒有資料可匯出'); return }
    const header = ['姓名', '手機', '同行人數', '想討論的話題', '報名時間']
    const lines = [header, ...registrations.map(r => [
      r.name, r.phone, COMPANION_LABEL[r.companions] ?? r.companions, r.topic || '', formatDateTime(r.created_at),
    ])].map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event?.title || '活動'}_報名名單.csv`
    a.click()
    URL.revokeObjectURL(url)
    fetch('/api/admin/audit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export_event_registrations', detail: `下載「${event?.title || ''}」報名名單 ${registrations.length} 筆` }),
    }).catch(() => {})
  }

  if (loading) return <div className="py-16 text-center text-gray-600">載入中...</div>
  if (!event) return <div className="py-16 text-center text-gray-600">找不到此活動</div>

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link href="/admin/events" className="hover:text-green-700">社群活動</Link>
        <span>›</span>
        <span className="text-gray-700">{event.title}</span>
      </nav>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{event.title}</h1>
          <p className="text-gray-600 text-sm mt-0.5">
            共 {registrations.length} 筆報名・含同行預估 {totalPeople} 人
          </p>
        </div>
        <button onClick={handleExport} className="text-sm font-bold text-green-700 border-2 border-green-200 hover:bg-green-50 rounded-xl px-4 py-2 transition-colors">
          ⬇ 匯出名單 CSV
        </button>
      </div>

      <div className="card overflow-hidden">
        {registrations.length === 0 ? (
          <div className="py-16 text-center text-gray-600">還沒有人報名</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['姓名', '手機', '同行人數', '想討論的話題', '報名時間'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-bold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registrations.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{r.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">{r.phone}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{COMPANION_LABEL[r.companions] ?? r.companions}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-md">{r.topic || <span className="text-gray-300">未填寫</span>}</td>
                    <td className="px-4 py-3 text-gray-600 text-[13px] whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
