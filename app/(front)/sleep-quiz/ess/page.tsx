'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ESS_QUESTIONS, ESS_OPTIONS } from '@/lib/sleepQuizData'

export default function ESSQuizPage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [snoring, setSnoring] = useState<boolean | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const allAnswered = ESS_QUESTIONS.every(q => answers[q.id] !== undefined)

  const handleSubmit = () => {
    if (!allAnswered) return
    setSubmitted(true)
    const score = Object.values(answers).reduce((s, v) => s + v, 0)
    try {
      localStorage.setItem('ess_last_score', String(score))
      localStorage.setItem('ess_last_snoring', snoring ? '1' : '0')
    } catch {}
    router.push(`/sleep-quiz/ess/result?score=${score}&snoring=${snoring ? '1' : '0'}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 via-blue-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-20">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/sleep-quiz" className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs text-gray-400 font-medium">ESS 愛潑沃斯嗜睡量表</p>
            <p className="text-sm font-bold text-gray-700">8 個情境快速篩查</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-2">在以下情境，您打瞌睡的可能性？</h2>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">
            不是問您過去有沒有打過，而是<strong>如果遇到這種情況，會不會想睡</strong>。即使最近沒經歷過，也請想像一下。
          </p>

          <div className="space-y-5">
            {ESS_QUESTIONS.map((q, i) => (
              <div key={q.id}>
                <p className="font-bold text-gray-800 text-sm mb-2 flex items-start gap-2">
                  <span className="w-6 h-6 bg-cyan-100 text-cyan-700 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="flex-1">{q.text}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-8">
                  {ESS_OPTIONS.map(opt => {
                    const sel = answers[q.id] === opt.value
                    return (
                      <button key={opt.value} onClick={() => setAnswers(a => ({ ...a, [q.id]: opt.value }))}
                        className={`px-2 py-2 rounded-xl border-2 text-xs sm:text-sm font-semibold transition-all
                          ${sel ? 'border-cyan-600 bg-cyan-50 text-cyan-900' : 'border-gray-200 text-gray-600 hover:border-cyan-300'}`}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OSA screening */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-5">
          <p className="font-bold text-gray-800 text-base mb-3 flex items-center gap-2">
            <span className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center text-base">⚠️</span>
            重要篩查問題
          </p>
          <p className="font-bold text-gray-800 text-sm mb-3 leading-relaxed">
            您身邊的人是否觀察到您「打鼾很響」、「睡夢中突然不喘氣，停幾秒後才大口喘一下」？
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setSnoring(true)}
              className={`px-4 py-3 rounded-xl border-2 font-bold transition-all
                ${snoring === true ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-gray-200 text-gray-600 hover:border-amber-300'}`}>
              是，有
            </button>
            <button onClick={() => setSnoring(false)}
              className={`px-4 py-3 rounded-xl border-2 font-bold transition-all
                ${snoring === false ? 'border-green-500 bg-green-50 text-green-900' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
              沒有 / 不確定
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3 leading-relaxed">
            💡 此問題用於篩查阻塞性睡眠呼吸中止症（OSA）— 一個常被忽略但會增加心血管疾病風險的疾病
          </p>
        </div>

        <button onClick={handleSubmit} disabled={!allAnswered || snoring === null || submitted}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white font-bold text-lg py-4 rounded-2xl transition-all shadow-lg shadow-cyan-200">
          {submitted ? '計算中...' : !allAnswered ? `還有 ${ESS_QUESTIONS.length - Object.keys(answers).length} 題未答` : snoring === null ? '請完成上方篩查問題' : '查看結果 →'}
        </button>
      </div>
    </div>
  )
}
