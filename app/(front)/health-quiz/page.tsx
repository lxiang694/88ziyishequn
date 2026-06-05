'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { INTRO_QUESTIONS, FOLLOWUP_QUESTIONS } from '@/lib/quizData'

type Answers = Record<string, string | string[]>

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
      <div
        className="bg-green-600 h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function HealthQuizPage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Answers>({})
  const [stepIndex, setStepIndex] = useState(0)

  // Build ordered question list dynamically based on selected concerns
  const questions = useMemo(() => {
    const concerns: string[] = Array.isArray(answers.concerns) ? answers.concerns : []
    const followups = FOLLOWUP_QUESTIONS.filter(q =>
      q.showIf?.some(slug => concerns.includes(slug))
    )
    return [...INTRO_QUESTIONS, ...followups]
  }, [answers.concerns])

  const current = questions[stepIndex]
  const isLast = stepIndex === questions.length - 1
  const totalSteps = questions.length

  const getAnswer = (qId: string) => answers[qId]

  const handleSingle = (value: string) => {
    const updated = { ...answers, [current.id]: value }
    setAnswers(updated)
    if (isLast) {
      submitQuiz(updated)
    } else {
      setStepIndex(i => i + 1)
    }
  }

  const toggleMulti = (value: string) => {
    const prev: string[] = Array.isArray(answers[current.id]) ? answers[current.id] as string[] : []
    const already = prev.includes(value)
    let next: string[]
    if (already) {
      next = prev.filter(v => v !== value)
    } else {
      if (prev.length >= 3) return
      next = [...prev, value]
    }
    setAnswers(a => ({ ...a, [current.id]: next }))
  }

  const handleNext = () => {
    if (isLast) {
      submitQuiz(answers)
    } else {
      setStepIndex(i => i + 1)
    }
  }

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex(i => i - 1)
  }

  const submitQuiz = (finalAnswers: Answers) => {
    const concerns: string[] = Array.isArray(finalAnswers.concerns)
      ? finalAnswers.concerns
      : []
    if (concerns.length === 0) {
      router.push('/health-quiz/result?cats=immune')
      return
    }
    const cats = concerns.slice(0, 3).join(',')
    router.push(`/health-quiz/result?cats=${encodeURIComponent(cats)}`)
  }

  const multiAnswer = Array.isArray(answers[current?.id]) ? answers[current.id] as string[] : []
  const canProceed = current?.type === 'multi' ? multiAnswer.length > 0 : Boolean(answers[current?.id])

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="text-xs text-gray-400 font-medium">健康風險自測</p>
            <p className="text-sm font-bold text-gray-700">步驟 {stepIndex + 1} / {totalSteps}</p>
          </div>
        </div>

        <ProgressBar current={stepIndex + 1} total={totalSteps} />

        {/* Question card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 leading-snug mb-1">{current?.text}</h2>
            {current?.subtext && (
              <p className="text-sm text-gray-500">{current.subtext}</p>
            )}
          </div>

          {/* Single choice */}
          {current?.type === 'single' && (
            <div className="space-y-3">
              {current.options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSingle(opt.value)}
                  className={`w-full text-left px-5 py-4 rounded-2xl border-2 font-semibold text-base transition-all
                    ${answers[current.id] === opt.value
                      ? 'border-green-600 bg-green-50 text-green-800'
                      : 'border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50/40'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Multi choice */}
          {current?.type === 'multi' && (
            <>
              <div className="grid grid-cols-1 gap-3">
                {current.options.map(opt => {
                  const selected = multiAnswer.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleMulti(opt.value)}
                      className={`w-full text-left px-5 py-4 rounded-2xl border-2 font-semibold text-base transition-all flex items-center gap-3
                        ${selected
                          ? 'border-green-600 bg-green-50 text-green-800'
                          : 'border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50/40'}`}
                    >
                      <span className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors
                        ${selected ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-3 text-right">
                已選 {multiAnswer.length} / 最多 3 項
              </p>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {stepIndex > 0 && (
            <button
              onClick={handleBack}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-4 rounded-2xl text-base hover:border-gray-300 transition-colors"
            >
              上一題
            </button>
          )}
          {current?.type === 'multi' && (
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="flex-1 bg-green-700 hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl text-base transition-colors"
            >
              {isLast ? '查看結果 →' : '下一題 →'}
            </button>
          )}
        </div>

        {/* Medical disclaimer */}
        <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
          本測驗結果僅供參考，所有保健品補充請先諮詢您的主治醫師
        </p>
      </div>
    </div>
  )
}
