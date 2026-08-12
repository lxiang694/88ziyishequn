'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface EventItem {
  slug: string
  title: string
  address: string | null
  event_time: string | null
  is_active: boolean
  registration_closed: boolean
  registration_count: number
}

export default function EventsListPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(d => {
      if (d.success) setEvents(d.data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-700 via-emerald-600 to-teal-600 px-6 py-9 sm:px-10 sm:py-11 mb-6 text-white shadow-lg shadow-green-200/50">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -left-10 -bottom-12 w-44 h-44 bg-white/5 rounded-full" />
        <div className="relative text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight mb-1.5">
            88自醫社群・線下健康見面會
          </h1>
          <p className="text-white/90 text-sm leading-relaxed">
            不同時間、不同地點陸續開放報名<br className="sm:hidden" />選擇適合您的場次，面對面交流健康問題
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-600">載入中...</div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-600">目前尚無活動場次，敬請期待</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => {
            const open = ev.is_active && !ev.registration_closed
            if (open) {
              return (
                <Link key={ev.slug} href={`/events/${ev.slug}`}
                  className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-green-300 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-2xl">📍</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">開放報名中</span>
                        {ev.registration_count > 0 && (
                          <span className="text-[13px] text-gray-600">已 {ev.registration_count} 人報名</span>
                        )}
                      </div>
                      <p className="font-bold text-gray-800 text-base leading-relaxed">{ev.title}</p>
                      {ev.event_time && <p className="text-gray-500 text-sm mt-1">🕒 {ev.event_time}</p>}
                      {ev.address && <p className="text-gray-500 text-sm">📍 {ev.address}</p>}
                    </div>
                    <div className="flex-shrink-0 text-green-600 font-bold group-hover:translate-x-0.5 transition-transform">→</div>
                  </div>
                </Link>
              )
            }
            // 已結束（活動開始前 2 小時自動關閉）或尚未開放，一律灰色且不可點擊
            const closed = ev.is_active && ev.registration_closed
            return (
              <div key={ev.slug}
                className="block bg-gray-50 rounded-2xl border border-gray-100 p-5 cursor-not-allowed select-none text-gray-600"
                aria-disabled="true">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-2xl grayscale">📍</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{closed ? '報名已結束' : '尚未開放'}</span>
                    </div>
                    <p className="font-bold text-gray-500 text-base leading-relaxed">{ev.title}</p>
                    {ev.event_time && <p className="text-gray-600 text-sm mt-1">🕒 {ev.event_time}</p>}
                    {ev.address && <p className="text-gray-600 text-sm">📍 {ev.address}</p>}
                  </div>
                  <div className="flex-shrink-0 text-gray-300 text-[13px] font-bold whitespace-nowrap">{closed ? '已截止' : '敬請期待'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
