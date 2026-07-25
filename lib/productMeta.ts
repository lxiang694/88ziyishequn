// 商品「情境化」欄位共用定義（後台與前台共用）

// 建議服用時間 — 快速勾選標籤（可複選）
export const TIMING_OPTIONS: { value: string; label: string }[] = [
  { value: 'morning', label: '早上' },
  { value: 'with_meal', label: '隨餐' },
  { value: 'before_meal', label: '餐前' },
  { value: 'empty_stomach', label: '空腹' },
  { value: 'between_meals', label: '兩餐之間' },
  { value: 'before_bed', label: '睡前' },
]

const TIMING_MAP: Record<string, string> = Object.fromEntries(TIMING_OPTIONS.map(o => [o.value, o.label]))

// 以逗號分隔的 value 字串 → 顯示用中文標籤陣列
export function timingLabels(csv?: string | null): string[] {
  if (!csv) return []
  return csv.split(',').map(s => s.trim()).filter(Boolean).map(v => TIMING_MAP[v] || v)
}
