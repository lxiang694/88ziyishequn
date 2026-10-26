/**
 * 星星評分（只顯示用）。支援小數，例如 4.6 會畫出 4 顆半多一點。
 * 用兩層星星疊起來，上層裁切寬度 —— 不用圖片、不用字型。
 */
const STAR = 'M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8L10 1.6z'

export function Stars({ value, size = 16, className = '' }: { value: number; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100
  const gap = size * 0.12
  // 上層被裁切時寬度不能跟著縮，不然星星會被擠扁、看起來變成七八顆
  const row = (color: string) => (
    <span className="flex" style={{ gap, width: size * 5 + gap * 4 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden className={`flex-shrink-0 ${color}`}>
          <path d={STAR} fill="currentColor" />
        </svg>
      ))}
    </span>
  )
  return (
    <span className={`relative inline-flex flex-shrink-0 ${className}`} role="img" aria-label={`${value} 顆星（滿分 5 顆）`}>
      {row('text-gray-200')}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>{row('text-amber-400')}</span>
    </span>
  )
}

/** 寫評價時點選的大星星 */
export function StarInput({ value, onChange, size = 40 }: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="評分">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} 顆星`}
          onClick={() => onChange(n)}
          className="rounded-lg p-0.5 transition-transform active:scale-90">
          <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden
            className={n <= value ? 'text-amber-400' : 'text-gray-200'}>
            <path d={STAR} fill="currentColor" />
          </svg>
        </button>
      ))}
    </div>
  )
}
