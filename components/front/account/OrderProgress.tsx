import type { Stage } from '@/lib/memberOrders'

/** 訂單進度條：已下單 → 處理中 → 已出貨 → 已到店（團購：已跟團 → 已出貨 → 已完成） */
export default function OrderProgress({ stage }: { stage: Stage }) {
  if (stage.cancelled) return <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">這筆訂單已取消</p>
  return (
    <div>
      <ol className="flex items-start" aria-label="訂單進度">
        {stage.steps.map((label, i) => {
          const reached = i <= stage.current
          const now = i === stage.current
          return (
            <li key={label} className="relative flex flex-1 flex-col items-center text-center" aria-current={now ? 'step' : undefined}>
              {i > 0 && <span className={`absolute right-1/2 top-[11px] h-[3px] w-full -translate-y-1/2 ${i <= stage.current ? 'bg-green-600' : 'bg-gray-200'}`} aria-hidden />}
              <span className={`relative z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] font-bold ${reached ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'} ${now ? 'ring-4 ring-green-100' : ''}`}>
                {reached && !now ? '✓' : i + 1}
              </span>
              <span className={`mt-1.5 text-[12px] leading-tight ${now ? 'font-bold text-green-800' : reached ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
            </li>
          )
        })}
      </ol>
      <p className={`mt-2.5 rounded-xl px-3 py-2 text-[13px] leading-relaxed ${stage.done ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700'}`}>{stage.hint}</p>
    </div>
  )
}
