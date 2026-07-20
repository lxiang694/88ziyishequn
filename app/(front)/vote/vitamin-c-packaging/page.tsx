'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'

const POLL_ID = 'vitamin_c_packaging_2026'
const VOTED_KEY = `voted_${POLL_ID}`
const VOTER_KEY = 'voter_key'

const OPTIONS = [
  { key: 'A', label: '設計 A', desc: '暖色系・生活情境風', image: '/vote/vitamin-c-design-a.jpg' },
  { key: 'B', label: '設計 B', desc: '綠色系・清新柑橘風', image: '/vote/vitamin-c-design-b.jpg' },
]

function getVoterKey(): string {
  let key = localStorage.getItem(VOTER_KEY)
  if (!key) {
    key = crypto.randomUUID()
    localStorage.setItem(VOTER_KEY, key)
  }
  return key
}

export default function VitaminCPackagingVotePage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [myVote, setMyVote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    setMyVote(localStorage.getItem(VOTED_KEY))
    fetch(`/api/votes/${POLL_ID}`).then(r => r.json()).then(d => {
      if (d.success) { setCounts(d.data.counts); setTotal(d.data.total) }
      setLoading(false)
    })
  }, [])

  const vote = async (optionKey: string) => {
    if (voting) return
    setVoting(true)
    try {
      const voter_key = getVoterKey()
      const res = await fetch(`/api/votes/${POLL_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option_key: optionKey, voter_key }),
      })
      const d = await res.json()
      if (d.success) {
        setCounts(d.data.counts)
        setTotal(d.data.total)
        setMyVote(optionKey)
        localStorage.setItem(VOTED_KEY, optionKey)
        toast.success('感謝您的投票！')
      } else {
        toast.error(d.error || '投票失敗，請稍後再試')
      }
    } catch {
      toast.error('網路錯誤，請稍後再試')
    } finally {
      setVoting(false)
    }
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('連結已複製，快分享給朋友一起投票吧！')
    } catch {
      toast.error('複製失敗')
    }
  }

  const pct = (key: string) => (total > 0 ? Math.round(((counts[key] || 0) / total) * 100) : 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">📣 新包裝票選中！</h1>
        <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
          咀嚼維生素C 即將推出新包裝，我們設計了兩款不同風格，想聽聽大家的意見！<br />
          點選你更喜歡的一款，投票結果即時公開給大家看 👇
        </p>
        <button onClick={handleShare} className="mt-3 text-sm text-green-700 font-bold hover:underline">
          🔗 複製連結分享給朋友
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">載入中...</div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-6">
            {OPTIONS.map(opt => (
              <div key={opt.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="relative aspect-[4/3] bg-gray-50">
                  <Image src={opt.image} alt={opt.label} fill className="object-contain" sizes="(max-width: 640px) 100vw, 50vw" />
                </div>
                <div className="p-4">
                  <p className="font-bold text-gray-800 text-lg">{opt.label}</p>
                  <p className="text-gray-400 text-sm mb-3">{opt.desc}</p>
                  <button
                    onClick={() => vote(opt.key)}
                    disabled={voting}
                    className={`w-full py-3 rounded-xl font-bold transition-colors disabled:opacity-50 ${
                      myVote === opt.key
                        ? 'bg-green-700 text-white'
                        : 'border-2 border-green-600 text-green-700 hover:bg-green-50'
                    }`}
                  >
                    {myVote === opt.key ? `✓ 已投給${opt.label}` : `投給${opt.label}`}
                  </button>
                  <div className="mt-3">
                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                      <span className="font-bold text-gray-700">{pct(opt.key)}%</span>
                      <span>{counts[opt.key] || 0} 票</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${pct(opt.key)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-400 text-sm mt-6">
            目前共 {total} 票{myVote ? '・您可以隨時改投其他設計' : ''}
          </p>
        </>
      )}
    </div>
  )
}
