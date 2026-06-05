'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  PSQI_DISTURBANCES, PSQI_FREQ, PSQI_QUALITY, PSQI_SEVERITY,
  calculatePSQI, type PSQIAnswers,
} from '@/lib/sleepQuizData'

const QUESTIONS_PER_STEP = 4

export default function PSQIQuizPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<PSQIAnswers>({
    bedtime: '23:00',
    sleepLatency: 15,
    wakeTime: '07:00',
    actualSleep: 7,
    disturbances: {},
    quality: 0,
    hypnotic: 0,
    daytimeDysfunction: 0,
    energyDifficulty: 0,
  })
  const [submitting, setSubmitting] = useState(false)

  const setField = <K extends keyof PSQIAnswers>(k: K, v: PSQIAnswers[K]) =>
    setData(d => ({ ...d, [k]: v }))

  const setDisturbance = (id: string, v: number) =>
    setData(d => ({ ...d, disturbances: { ...d.disturbances, [id]: v } }))

  const handleSubmit = () => {
    setSubmitting(true)
    const scores = calculatePSQI(data)
    try {
      localStorage.setItem('psqi_last_score', String(scores.total))
      localStorage.setItem('psqi_last_data', JSON.stringify({ data, scores, date: new Date().toISOString() }))
    } catch {}
    router.push(`/sleep-quiz/psqi/result?score=${scores.total}&eff=${scores.efficiencyPercent}`)
  }

  // 4-step layout
  // Step 0: Sleep time and efficiency (Q1-Q4)
  // Step 1: Sleep disturbances Q5 a-e
  // Step 2: Sleep disturbances Q5 f-j
  // Step 3: Overall (Q6-Q9)
  const totalSteps = 4
  const progress = Math.round(((step + 1) / totalSteps) * 100)

  const canProceed = (() => {
    if (step === 0) return data.bedtime && data.wakeTime && data.actualSleep > 0
    if (step === 1) return ['q5a', 'q5b', 'q5c', 'q5d', 'q5e'].every(id => data.disturbances[id] !== undefined)
    if (step === 2) return ['q5f', 'q5g', 'q5h', 'q5i', 'q5j'].every(id => data.disturbances[id] !== undefined)
    if (step === 3) return true
    return false
  })()

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-indigo-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-32">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/sleep-quiz" className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs text-gray-400 font-medium">PSQI 完整睡眠評估</p>
            <p className="text-sm font-bold text-gray-700">第 {step + 1} 步 / 共 {totalSteps} 步</p>
          </div>
        </div>

        <div className="w-full bg-purple-100 rounded-full h-2 mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
          <p className="text-xs text-purple-600 font-bold mb-2 tracking-wider">過去 1 個月的整體情況</p>

          {/* Step 0: 睡眠時間與效率 */}
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">睡眠時間與效率</h2>

              <div>
                <label className="form-label">您通常上床睡覺的時間</label>
                <input type="time" className="form-input" value={data.bedtime} onChange={e => setField('bedtime', e.target.value)} />
              </div>

              <div>
                <label className="form-label">從上床到入睡通常需要多少分鐘</label>
                <input type="number" min={0} max={300} className="form-input" value={data.sleepLatency}
                  onChange={e => setField('sleepLatency', parseInt(e.target.value) || 0)} />
                <p className="text-xs text-gray-400 mt-1">輸入分鐘數，例如 30</p>
              </div>

              <div>
                <label className="form-label">早晨通常幾點起床</label>
                <input type="time" className="form-input" value={data.wakeTime} onChange={e => setField('wakeTime', e.target.value)} />
              </div>

              <div>
                <label className="form-label">每晚實際睡著的時間是多少小時</label>
                <input type="number" min={0} max={14} step={0.5} className="form-input" value={data.actualSleep}
                  onChange={e => setField('actualSleep', parseFloat(e.target.value) || 0)} />
                <p className="text-xs text-gray-400 mt-1">不是躺床的時間，而是真正睡著的時間，例如 6.5</p>
              </div>
            </div>
          )}

          {/* Step 1: Q5 a-e */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">睡眠障礙頻率（1/2）</h2>
              <p className="text-sm text-gray-500 mb-5">過去 1 個月，您是否因為下列情況而睡眠不佳？</p>
              <div className="space-y-5">
                {PSQI_DISTURBANCES.slice(0, 5).map(d => (
                  <div key={d.id}>
                    <p className="font-bold text-gray-800 text-sm mb-2">{d.text}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PSQI_FREQ.map(opt => {
                        const sel = data.disturbances[d.id] === opt.value
                        return (
                          <button key={opt.value} onClick={() => setDisturbance(d.id, opt.value)}
                            className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                              ${sel ? 'border-purple-600 bg-purple-50 text-purple-900' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Q5 f-j */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">睡眠障礙頻率（2/2）</h2>
              <p className="text-sm text-gray-500 mb-5">過去 1 個月，您是否因為下列情況而睡眠不佳？</p>
              <div className="space-y-5">
                {PSQI_DISTURBANCES.slice(5).map(d => (
                  <div key={d.id}>
                    <p className="font-bold text-gray-800 text-sm mb-2">{d.text}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PSQI_FREQ.map(opt => {
                        const sel = data.disturbances[d.id] === opt.value
                        return (
                          <button key={opt.value} onClick={() => setDisturbance(d.id, opt.value)}
                            className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                              ${sel ? 'border-purple-600 bg-purple-50 text-purple-900' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Q6-Q9 */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">整體評估</h2>

              <div>
                <p className="font-bold text-gray-800 text-sm mb-2">您認為自己的睡眠品質？</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PSQI_QUALITY.map(opt => {
                    const sel = data.quality === opt.value
                    return (
                      <button key={opt.value} onClick={() => setField('quality', opt.value)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                          ${sel ? 'border-purple-600 bg-purple-50 text-purple-900' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="font-bold text-gray-800 text-sm mb-2">使用安眠 / 助眠藥物的頻率？</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PSQI_FREQ.map(opt => {
                    const sel = data.hypnotic === opt.value
                    return (
                      <button key={opt.value} onClick={() => setField('hypnotic', opt.value)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                          ${sel ? 'border-purple-600 bg-purple-50 text-purple-900' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="font-bold text-gray-800 text-sm mb-2">在開車、吃飯或社交時感到困倦的頻率？</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PSQI_FREQ.map(opt => {
                    const sel = data.daytimeDysfunction === opt.value
                    return (
                      <button key={opt.value} onClick={() => setField('daytimeDysfunction', opt.value)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                          ${sel ? 'border-purple-600 bg-purple-50 text-purple-900' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="font-bold text-gray-800 text-sm mb-2">感到做事情精力不足的程度？</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PSQI_SEVERITY.map(opt => {
                    const sel = data.energyDifficulty === opt.value
                    return (
                      <button key={opt.value} onClick={() => setField('energyDifficulty', opt.value)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                          ${sel ? 'border-purple-600 bg-purple-50 text-purple-900' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl hover:border-gray-300 transition-colors">
              上一步
            </button>
          )}
          {step < totalSteps - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-2xl transition-all">
              下一步 →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-2xl transition-all">
              {submitting ? '計算中...' : '查看結果 →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
