'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { DAILY_HABITS } from '@/lib/sleepQuizData'
import SocialShareButtons from '@/components/front/SocialShareButtons'
import LoginPrompt from '@/components/front/LoginPrompt'

const SITE_URL = 'https://healthec.vercel.app'

const STORAGE_KEY = 'sleep_tracker_v1'

interface TrackerState {
  startDate: string  // YYYY-MM-DD (local)
  data: Record<string, Record<string, boolean>>  // [date]: { [habitId]: bool }
}

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

function dateAt(startISO: string, dayOffset: number) {
  const [y, m, d] = startISO.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + dayOffset)
  const tz = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tz).toISOString().slice(0, 10)
}

function formatShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${m}/${d}`
}

export default function SleepTrackerPage() {
  const [state, setState] = useState<TrackerState | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setState(JSON.parse(raw))
    } catch {}
    setLoaded(true)
  }, [])

  // Save to localStorage when state changes
  useEffect(() => {
    if (!loaded) return
    try {
      if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state, loaded])

  const today = todayISO()

  const startTracking = () => {
    setState({ startDate: today, data: {} })
  }

  const restart = () => {
    if (confirm('確定要重新開始 21 天計畫？目前的進度會被清除。')) {
      setState({ startDate: today, data: {} })
    }
  }

  const toggle = (date: string, habitId: string) => {
    setState(s => {
      if (!s) return s
      const dayData = s.data[date] || {}
      return {
        ...s,
        data: { ...s.data, [date]: { ...dayData, [habitId]: !dayData[habitId] } },
      }
    })
  }

  // Compute stats
  const stats = useMemo(() => {
    if (!state) return null
    const days21 = Array.from({ length: 21 }, (_, i) => dateAt(state.startDate, i))
    const todayIdx = days21.indexOf(today)
    const currentDay = todayIdx >= 0 ? todayIdx : days21.findIndex(d => d > today) - 1

    let totalChecks = 0
    let totalPossible = 0
    let perfectDays = 0
    let currentStreak = 0
    let bestStreak = 0
    let runningStreak = 0

    days21.forEach((d, i) => {
      if (d > today) return
      const dayData = state.data[d] || {}
      const checked = DAILY_HABITS.filter(h => dayData[h.id]).length
      totalChecks += checked
      totalPossible += DAILY_HABITS.length
      if (checked === DAILY_HABITS.length) {
        perfectDays++
        runningStreak++
        if (runningStreak > bestStreak) bestStreak = runningStreak
      } else if (checked > 0) {
        // partial: don't break streak but don't extend "perfect" streak
        runningStreak = 0
      } else {
        runningStreak = 0
      }
    })

    // current streak counts from today/yesterday backwards
    for (let i = currentDay; i >= 0; i--) {
      const d = days21[i]
      const dayData = state.data[d] || {}
      const checked = DAILY_HABITS.filter(h => dayData[h.id]).length
      if (checked === DAILY_HABITS.length) currentStreak++
      else break
    }

    const completionRate = totalPossible > 0 ? Math.round((totalChecks / totalPossible) * 100) : 0
    return { days21, currentDay, totalChecks, totalPossible, perfectDays, currentStreak, bestStreak, completionRate }
  }, [state, today])

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">載入中...</div>
  }

  // ========== Empty state — show intro ==========
  if (!state) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-teal-50 to-white">
        <div className="max-w-2xl mx-auto px-4 py-10">

          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-1.5 rounded-full text-sm font-bold mb-5">
              📅 21 天習慣養成
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-3">
              21 天，<br className="sm:hidden" />重塑您的睡眠
            </h1>
            <p className="text-gray-600 text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
              每天打卡 <strong className="text-emerald-700">8 個睡眠關鍵習慣</strong>，
              累積 21 天，您的睡眠品質會出現可量化的改變
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
            <p className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
              ✨ 您將要追蹤的 8 個習慣
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DAILY_HABITS.map(h => (
                <div key={h.id} className="flex items-start gap-3 p-3 bg-emerald-50/60 rounded-xl">
                  <span className="text-2xl flex-shrink-0">{h.icon}</span>
                  <p className="text-sm text-gray-700 leading-relaxed font-medium">{h.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
            <p className="text-base font-bold text-gray-700 mb-3">使用方式</p>
            <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
              <li>· 每天睡前打開這頁，回顧今天做到了哪幾項</li>
              <li>· 不必追求完美，<strong>有進步比 100% 完成更重要</strong></li>
              <li>· 進度只儲存在<strong>您這台裝置的瀏覽器</strong>，不上傳雲端</li>
              <li>· 21 天後建議重新測 PSQI / ISI，看分數變化</li>
            </ul>
          </div>

          <button
            onClick={startTracking}
            className="block w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-lg py-4 rounded-2xl text-center shadow-lg shadow-emerald-200 transition-all hover:scale-[1.01]"
          >
            從今天開始 21 天計畫 →
          </button>

          <p className="text-center text-[13px] text-gray-600 mt-6 leading-relaxed">
            開始日期：{today.replace(/-/g, '/')}
          </p>
        </div>
      </div>
    )
  }

  // ========== Active tracker ==========
  const days21 = stats?.days21 || []
  const currentDayIdx = stats?.currentDay ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-teal-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/sleep-quiz" className="text-gray-600 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div className="flex-1">
            <p className="text-[13px] text-gray-600 font-medium">21 天睡眠習慣計畫</p>
            <p className="text-sm font-bold text-gray-700">第 {Math.max(1, currentDayIdx + 1)} 天 / 共 21 天</p>
          </div>
          <button onClick={restart}
            className="text-[13px] text-gray-600 hover:text-red-500 transition-colors">重新開始</button>
        </div>

        {/* Stats card */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl p-5 text-white mb-5 shadow-lg shadow-emerald-100">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-3xl font-bold">{stats?.completionRate}%</p>
              <p className="text-[13px] text-emerald-100 mt-0.5">總完成率</p>
            </div>
            <div className="border-x border-white/20">
              <p className="text-3xl font-bold">{stats?.currentStreak}</p>
              <p className="text-[13px] text-emerald-100 mt-0.5">連續完美日</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{stats?.perfectDays}</p>
              <p className="text-[13px] text-emerald-100 mt-0.5">累計滿分日</p>
            </div>
          </div>
        </div>

        {/* Today's checklist (highlighted) */}
        {currentDayIdx >= 0 && currentDayIdx < 21 && (
          <div className="bg-white rounded-3xl shadow-md border-2 border-emerald-300 p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-800 text-lg">📌 今日打卡（{formatShort(today)}）</p>
              <span className="text-[13px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold">
                {DAILY_HABITS.filter(h => state.data[today]?.[h.id]).length} / {DAILY_HABITS.length}
              </span>
            </div>
            <div className="space-y-2">
              {DAILY_HABITS.map(h => {
                const checked = state.data[today]?.[h.id] || false
                return (
                  <button key={h.id} onClick={() => toggle(today, h.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all
                      ${checked
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/30'}`}>
                    <span className={`w-7 h-7 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-colors
                      ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                      {checked && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </span>
                    <span className="text-2xl flex-shrink-0">{h.icon}</span>
                    <span className={`flex-1 text-left text-sm font-medium leading-snug
                      ${checked ? 'text-emerald-800' : 'text-gray-700'}`}>
                      {h.text}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 21-day grid view */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-5 overflow-x-auto">
          <p className="font-bold text-gray-700 text-base mb-4">📊 21 天總覽</p>
          <div className="min-w-[640px]">
            {/* Date row */}
            <div className="grid grid-cols-[140px_repeat(21,1fr)] gap-1 mb-2">
              <div></div>
              {days21.map((d, i) => {
                const isToday = d === today
                const isFuture = d > today
                return (
                  <div key={d} className={`text-center text-[13px] font-bold py-1
                    ${isToday ? 'text-emerald-700' : isFuture ? 'text-gray-300' : 'text-gray-600'}`}>
                    {isToday ? '今' : i + 1}
                  </div>
                )
              })}
            </div>
            {/* Habit rows */}
            {DAILY_HABITS.map(h => (
              <div key={h.id} className="grid grid-cols-[140px_repeat(21,1fr)] gap-1 mb-1">
                <div className="flex items-center gap-1.5 text-[13px] text-gray-700 font-medium">
                  <span>{h.icon}</span>
                  <span className="truncate">{h.shortText}</span>
                </div>
                {days21.map(d => {
                  const checked = state.data[d]?.[h.id] || false
                  const isFuture = d > today
                  return (
                    <button key={d} onClick={() => !isFuture && toggle(d, h.id)} disabled={isFuture}
                      className={`aspect-square rounded transition-colors min-w-[20px]
                        ${checked ? 'bg-emerald-500 hover:bg-emerald-600' :
                          isFuture ? 'bg-gray-50' :
                          'bg-gray-100 hover:bg-emerald-100'}`}
                      title={`${d} - ${h.text}`}>
                      {checked && (
                        <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <p className="text-[13px] text-gray-600 mt-3 text-center">點擊任一格可手動勾選 / 取消（過去日子也可補勾）</p>
        </div>

        {/* Encouragement */}
        {(stats?.currentStreak || 0) >= 3 && (
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-center">
            <p className="text-2xl mb-1">🔥</p>
            <p className="font-bold text-amber-900 text-base">連續 {stats?.currentStreak} 天滿分達成！</p>
            <p className="text-sm text-amber-700 mt-1">習慣正在養成中，繼續保持</p>
          </div>
        )}

        {currentDayIdx >= 20 && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl p-5 mb-5 text-center">
            <p className="text-3xl mb-2">🎉</p>
            <p className="font-bold text-purple-900 text-lg mb-2">恭喜完成 21 天計畫！</p>
            <p className="text-sm text-purple-700 mb-4 leading-relaxed">
              現在是回去重測 PSQI / ISI 的好時機，<br />看看您的睡眠分數變化了多少
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/sleep-quiz/psqi" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                重測 PSQI
              </Link>
              <Link href="/sleep-quiz/start" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                重測 ISI
              </Link>
            </div>
          </div>
        )}

        {/* Login prompt — compact version since tracker page is dense */}
        <LoginPrompt
          theme="emerald"
          compact
          title="加入會員享更多服務"
          message="訂單追蹤、結帳自動填表、再買一次"
          next="/sleep-tracker"
        />

        {/* Social share — invite friends to do their own 21 days */}
        <SocialShareButtons
          url={`${SITE_URL}/sleep-tracker`}
          title="21 天睡眠習慣養成計畫"
          heading="找朋友一起堅持 21 天"
          subtext="互相打氣、養成習慣"
          theme="green"
        />

        {/* Footer note */}
        <p className="text-center text-[13px] text-gray-600 leading-relaxed">
          💾 您的進度只儲存在這台裝置的瀏覽器，不會上傳雲端<br />
          清除瀏覽器資料會讓進度消失，請定期截圖留存
        </p>
      </div>
    </div>
  )
}
