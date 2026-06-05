'use client'
import { useEffect, useRef, useState } from 'react'

// Strip markdown syntax for cleaner audio reading
function stripMarkdown(content: string): string {
  return content
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')           // images: ![alt](url) → ''
    .replace(/^#{1,6}\s+/gm, '')                     // headers: ## title → title
    .replace(/^>\s+/gm, '')                          // quotes: > text → text
    .replace(/^[-*]\s+/gm, '')                       // bullets: - item → item
    .replace(/\*\*(.+?)\*\*/g, '$1')                 // bold: **x** → x
    .replace(/`([^`]+)`/g, '$1')                     // code: `x` → x
    .replace(/\n{3,}/g, '\n\n')                      // collapse blank lines
    .trim()
}

// Split text into sentences for chunked TTS (avoid Chrome ~200 char limit + better progress)
function splitSentences(text: string): string[] {
  const parts = text
    .split(/([。！？\n])/g)
    .reduce<string[]>((acc, cur, i, arr) => {
      if (i % 2 === 0) {
        const punct = arr[i + 1] || ''
        const piece = (cur + punct).trim()
        if (piece) acc.push(piece)
      }
      return acc
    }, [])
  return parts.filter(s => s.length > 0)
}

// Pick the best Taiwanese male voice available; fall back gracefully
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null

  const zhTW = voices.filter(v => v.lang === 'zh-TW' || v.lang.startsWith('zh-TW'))
  const zhAny = voices.filter(v => v.lang.startsWith('zh'))

  // Known male Taiwanese voice keywords (Microsoft/Google/Apple)
  const malePref = /YunJhe|Yun-Jhe|Hsiao|Wei|Jian|Hao|Yu-Ting|HanWei|Cheng|Male/i
  // Known female voices to avoid when targeting male
  const femaleAvoid = /Hanhan|Yating|Mei-Jia|MeiJia|Ya-Ling|YaLing|Sin-Ji|Female|Xiaoyi|Xiaoxiao/i

  // 1. zh-TW with male keyword
  const tw_male = zhTW.find(v => malePref.test(v.name))
  if (tw_male) return tw_male

  // 2. zh-TW NOT obviously female
  const tw_neutral = zhTW.find(v => !femaleAvoid.test(v.name))
  if (tw_neutral) return tw_neutral

  // 3. any zh-TW voice
  if (zhTW.length > 0) return zhTW[0]

  // 4. any zh voice with male keyword
  const zh_male = zhAny.find(v => malePref.test(v.name))
  if (zh_male) return zh_male

  // 5. any zh voice not obviously female
  const zh_neutral = zhAny.find(v => !femaleAvoid.test(v.name))
  if (zh_neutral) return zh_neutral

  // 6. fallback to any Chinese voice
  return zhAny[0] || null
}

interface Props {
  title: string
  content: string
}

export default function ArticleAudioPlayer({ title, content }: Props) {
  const [supported, setSupported] = useState(true)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [rate, setRate] = useState(1.0)
  const [currentIdx, setCurrentIdx] = useState(0)

  const sentencesRef = useRef<string[]>([])
  const queueRef = useRef<SpeechSynthesisUtterance[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false)
      return
    }
    const fullText = `${title}。\n${stripMarkdown(content)}`
    sentencesRef.current = splitSentences(fullText)

    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices()
      setVoices(all)
      const best = pickBestVoice(all)
      if (best && !selectedVoice) setSelectedVoice(best)
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
      window.speechSynthesis.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content])

  const speakFrom = (startIdx: number) => {
    if (!selectedVoice) return
    window.speechSynthesis.cancel()
    queueRef.current = []

    sentencesRef.current.slice(startIdx).forEach((sent, offset) => {
      const u = new SpeechSynthesisUtterance(sent)
      u.voice = selectedVoice
      u.lang = selectedVoice.lang
      u.rate = rate
      u.pitch = 1.0
      const idx = startIdx + offset
      u.onstart = () => setCurrentIdx(idx)
      u.onend = () => {
        if (idx === sentencesRef.current.length - 1) {
          setPlaying(false)
          setPaused(false)
          setCurrentIdx(0)
        }
      }
      u.onerror = () => {
        setPlaying(false)
        setPaused(false)
      }
      queueRef.current.push(u)
      window.speechSynthesis.speak(u)
    })

    setPlaying(true)
    setPaused(false)
  }

  const handlePlay = () => {
    if (paused) {
      window.speechSynthesis.resume()
      setPaused(false)
      return
    }
    speakFrom(currentIdx)
  }

  const handlePause = () => {
    window.speechSynthesis.pause()
    setPaused(true)
  }

  const handleStop = () => {
    window.speechSynthesis.cancel()
    setPlaying(false)
    setPaused(false)
    setCurrentIdx(0)
  }

  const handleRateChange = (newRate: number) => {
    setRate(newRate)
    if (playing) {
      // Restart from current sentence with new rate
      const idx = currentIdx
      window.speechSynthesis.cancel()
      setTimeout(() => {
        const u = sentencesRef.current.slice(idx).map((sent, offset) => {
          const ut = new SpeechSynthesisUtterance(sent)
          ut.voice = selectedVoice
          ut.lang = selectedVoice?.lang || 'zh-TW'
          ut.rate = newRate
          const i = idx + offset
          ut.onstart = () => setCurrentIdx(i)
          ut.onend = () => {
            if (i === sentencesRef.current.length - 1) {
              setPlaying(false); setPaused(false); setCurrentIdx(0)
            }
          }
          return ut
        })
        u.forEach(utt => window.speechSynthesis.speak(utt))
      }, 50)
    }
  }

  const total = sentencesRef.current.length
  const progress = total > 0 ? Math.round(((currentIdx + 1) / total) * 100) : 0

  if (!supported) return null

  // Show only zh voices in selector
  const zhVoices = voices.filter(v => v.lang.startsWith('zh'))

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-100 rounded-2xl p-5 my-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white text-lg flex-shrink-0">
          🎧
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-base">語音導讀</p>
          <p className="text-xs text-gray-500">點擊播放，邊聽邊看更輕鬆</p>
        </div>
        {selectedVoice && (
          <p className="hidden sm:block text-xs text-gray-400 truncate max-w-[120px]" title={selectedVoice.name}>
            {selectedVoice.name}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {playing && (
        <div className="mb-3">
          <div className="w-full bg-amber-100 rounded-full h-1.5">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-amber-700 mt-1.5 font-medium">
            {currentIdx + 1} / {total} 段 · {progress}%
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {!playing || paused ? (
          <button
            onClick={handlePlay}
            disabled={!selectedVoice}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-bold px-5 py-3 rounded-xl text-base transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            {paused ? '繼續' : '播放'}
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-3 rounded-xl text-base transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            暫停
          </button>
        )}

        {(playing || paused) && (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-700 font-bold px-4 py-3 rounded-xl text-sm transition-colors border-2 border-gray-200"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
            停止
          </button>
        )}

        {/* Speed selector */}
        <div className="flex items-center gap-1 bg-white rounded-xl border-2 border-gray-200 p-1">
          {[0.8, 1.0, 1.25, 1.5].map(r => (
            <button
              key={r}
              onClick={() => handleRateChange(r)}
              className={`px-2.5 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                rate === r ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {r}×
            </button>
          ))}
        </div>

        {/* Voice picker (if multiple zh voices available) */}
        {zhVoices.length > 1 && (
          <select
            value={selectedVoice?.name || ''}
            onChange={e => {
              const v = voices.find(x => x.name === e.target.value)
              if (v) {
                setSelectedVoice(v)
                if (playing) {
                  handleStop()
                  setTimeout(() => speakFrom(0), 100)
                }
              }
            }}
            className="bg-white border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-amber-500"
            style={{ height: '44px' }}
          >
            {zhVoices.map(v => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3 leading-relaxed">
        💡 提示：使用 Chrome 或 Edge 瀏覽器音質最好；iPhone Safari 可使用系統內建語音
      </p>
    </div>
  )
}
