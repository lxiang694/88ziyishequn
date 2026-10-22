'use client'
import { useState } from 'react'
import type { SourceKey, SourceStat } from '@/lib/trafficSource'

export type TrafficSourcesData = {
  total_visits: number
  sources: SourceStat[]
  other_sites: { name: string; visits: number }[]
  campaigns: { source: string; medium: string; campaign: string; visits: number }[]
  utm_ready: boolean
}

const STYLE: Record<SourceKey, { icon: string; bar: string }> = {
  google: { icon: '🔍', bar: 'bg-blue-500' },
  yahoo: { icon: '🟣', bar: 'bg-purple-500' },
  search: { icon: '🔎', bar: 'bg-slate-500' },
  facebook: { icon: '📘', bar: 'bg-blue-700' },
  instagram: { icon: '📸', bar: 'bg-pink-500' },
  line: { icon: '💬', bar: 'bg-green-500' },
  threads: { icon: '🧵', bar: 'bg-gray-800' },
  youtube: { icon: '▶️', bar: 'bg-red-500' },
  other: { icon: '🌐', bar: 'bg-amber-500' },
  direct: { icon: '⌨️', bar: 'bg-gray-400' },
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`

/** 後台流量監控的「流量來源」區塊 */
export default function TrafficSources({ data }: { data?: TrafficSourcesData }) {
  const [open, setOpen] = useState<SourceKey | null>(null)
  if (!data) return null

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-800">流量來源</h2>
        <p className="text-[13px] text-gray-500">共 {data.total_visits.toLocaleString()} 次造訪・同一人 30 分鐘內只算一次</p>
      </div>

      {data.sources.length === 0 ? (
        <p className="py-8 text-center text-gray-600">此時間範圍內沒有流量資料</p>
      ) : (
        <ul className="space-y-1">
          {data.sources.map(s => {
            const expanded = open === s.key
            return (
              <li key={s.key}>
                <button type="button" onClick={() => setOpen(expanded ? null : s.key)} aria-expanded={expanded}
                  className="-mx-2 w-[calc(100%+1rem)] rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="w-6 flex-shrink-0 text-center text-lg" aria-hidden>{STYLE[s.key].icon}</span>
                    <span className="min-w-0 flex-1 truncate font-bold text-gray-900">{s.label}</span>
                    <span className="flex-shrink-0 text-right tabular-nums">
                      <span className="font-bold text-gray-900">{s.visits.toLocaleString()}</span>
                      <span className="ml-1 text-[12px] text-gray-500">次</span>
                    </span>
                    <span className="w-14 flex-shrink-0 text-right text-sm font-semibold text-gray-600 tabular-nums">{pct(s.share)}</span>
                    <span className={`w-4 flex-shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden>›</span>
                  </div>
                  <div className="ml-9 mt-1.5 mr-[4.5rem] h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${STYLE[s.key].bar}`} style={{ width: `${Math.max(s.share * 100, 1)}%` }} />
                  </div>
                </button>
                {expanded && (
                  <div className="mb-2 ml-9 rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                    <p className="mb-1.5 text-[12px] font-semibold text-gray-500">{s.visitors.toLocaleString()} 位訪客・最常進入的頁面</p>
                    <ul className="space-y-1">
                      {s.landings.map(l => (
                        <li key={l.path} className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 break-all font-mono text-[13px] text-gray-700">{l.path}</span>
                          <span className="flex-shrink-0 font-semibold text-gray-600 tabular-nums">{l.visits}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {data.other_sites.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-1.5 text-sm font-bold text-gray-500">其他網站明細</h3>
          <ul className="flex flex-wrap gap-2">
            {data.other_sites.map(o => (
              <li key={o.name} className="rounded-full bg-amber-50 px-3 py-1 text-[13px] text-amber-900">
                {o.name}<span className="ml-1.5 font-bold tabular-nums">{o.visits}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <h3 className="mb-1.5 text-sm font-bold text-gray-500">分享連結標記（utm）</h3>
        {!data.utm_ready ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] leading-relaxed text-amber-900">
            執行 <code className="font-mono">migrations/traffic_sources.sql</code> 後，帶標記的連結（例如 ?utm_source=line）會在這裡列出每一則貼文帶來多少人。
          </p>
        ) : data.campaigns.length === 0 ? (
          <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] leading-relaxed text-gray-600">
            分享到 LINE 時在連結後加上標記，就能看出是哪一則貼文帶來的，例如：
            <code className="mt-1 block break-all font-mono text-gray-800">https://www.88ziyishequn.com/group-buy?utm_source=line&amp;utm_medium=group&amp;utm_campaign=十月團</code>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['來源', '管道', '活動', '造訪'].map(h => <th key={h} className="px-3 py-2 text-left font-bold text-gray-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.campaigns.map(c => (
                  <tr key={`${c.source}|${c.medium}|${c.campaign}`}>
                    <td className="px-3 py-2 font-semibold text-gray-800">{c.source}</td>
                    <td className="px-3 py-2 text-gray-600">{c.medium || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.campaign || '—'}</td>
                    <td className="px-3 py-2 font-bold text-gray-900 tabular-nums">{c.visits}</td>
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
