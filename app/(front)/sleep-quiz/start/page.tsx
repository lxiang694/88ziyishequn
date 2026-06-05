'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ISI_QUESTIONS } from '@/lib/sleepQuizData'

export default function SleepQuizStart() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [stepIndex, setStepIndex] = useState(0)

  const total = ISI_QUESTIONS.length
  const current = ISI_QUESTIONS[stepIndex]
  const isLast = stepIndex === total - 1
  const currentValue = answers[current.id]

  const handleSelect = (value: number) => {
    const updated = { ...answers, [current.id]: value }
    setAnswers(updated)
    if (isLast) {
      // calculate total score and navigate to result
      const score = Object.values(updated).reduce((s, v) => s + v, 0)
      // Save to localStorage so user can re-share/revisit
      try {
        localStorage.setItem('isi_last_score', String(score))
        localStorage.setItem('isi_last_date', new Date().toISOString())
      } catch {}
      router.push(`/sleep-quiz/result?score=${score}`)
    } else {
      // small delay so user sees their selection register
      setTimeout(() => setStepIndex(i => i + 1), 200)
    }
  }

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex(i => i - 1)
  }

  const progress = Math.round(((stepIndex + 1) / total) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-blue-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/sleep-quiz" className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="text-xs text-gray-400 font-medium">睡眠健康自測</p>
            <p className="text-sm font-bold text-gray-700">第 {stepIndex + 1} 題 / 共 {total} 題</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-indigo-100 rounded-full h-2 mb-8 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Question card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
          <p className="text-xs text-gray-400 font-bold mb-2 tracking-wider">過去 2 週中</p>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-2">
            {current.text}
          </h2>
          {current.subtext && (
            <p className="text-sm text-gray-500 leading-relaxed mb-5">{current.subtext}</p>
          )}

          {/* Options */}
          <div className="space-y-3 mt-5">
            {current.options.map(opt => {
              const selected = currentValue === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full px-5 py-4 rounded-2xl border-2 font-semibold text-base transition-all flex items-center gap-3
                    ${selected
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 scale-[0.99]'
                      : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/40'}`}
                >
                  <span className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors
                    ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                    {selected && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 text-left">{opt.label}</span>
                  <span className="text-xs text-gray-400 font-mono">{opt.value} 分</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Back button */}
        {stepIndex > 0 && (
          <button
            onClick={handleBack}
            className="w-full border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-2xl text-base hover:border-gray-300 transition-colors"
          >
            ← 上一題
          </button>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          選擇後會自動進入下一題
        </p>
      </div>
    </div>
  )
}
