// 後台統計共用：台灣時區（UTC+8）日期範圍工具

const TW_OFFSET = 8 * 60 * 60 * 1000

export interface DateRange {
  start: string // UTC ISO
  end: string   // UTC ISO
}

// 將台灣日期字串 YYYY-MM-DD 轉為當天起 / 迄的 UTC ISO
function twDayToUTC(dateStr: string, isEnd: boolean): string {
  const time = isEnd ? 'T23:59:59' : 'T00:00:00'
  const twDate = new Date(dateStr + time + '+08:00')
  return twDate.toISOString()
}

// 取得「今天」的台灣日期字串
export function todayTWDate(): string {
  return new Date(Date.now() + TW_OFFSET).toISOString().slice(0, 10)
}

// 將 UTC 時間戳轉為台灣日期字串 YYYY-MM-DD（用於依日分組）
export function toTWDate(utcDateStr: string): string {
  return new Date(new Date(utcDateStr).getTime() + TW_OFFSET).toISOString().slice(0, 10)
}

export function getTWDateRange(dateRange: string, startDate = '', endDate = ''): DateRange {
  const nowTW = new Date(Date.now() + TW_OFFSET)
  const todayTW = nowTW.toISOString().slice(0, 10)

  switch (dateRange) {
    case 'today':
      return { start: twDayToUTC(todayTW, false), end: twDayToUTC(todayTW, true) }
    case 'yesterday': {
      const yd = new Date(nowTW)
      yd.setDate(yd.getDate() - 1)
      const ydStr = yd.toISOString().slice(0, 10)
      return { start: twDayToUTC(ydStr, false), end: twDayToUTC(ydStr, true) }
    }
    case '7days': {
      const d7 = new Date(nowTW)
      d7.setDate(d7.getDate() - 6)
      return { start: twDayToUTC(d7.toISOString().slice(0, 10), false), end: twDayToUTC(todayTW, true) }
    }
    case '30days': {
      const d30 = new Date(nowTW)
      d30.setDate(d30.getDate() - 29)
      return { start: twDayToUTC(d30.toISOString().slice(0, 10), false), end: twDayToUTC(todayTW, true) }
    }
    case 'month': {
      const monthStart = todayTW.slice(0, 7) + '-01'
      return { start: twDayToUTC(monthStart, false), end: twDayToUTC(todayTW, true) }
    }
    case 'custom':
      if (startDate && endDate) {
        return { start: twDayToUTC(startDate, false), end: twDayToUTC(endDate, true) }
      }
      return { start: twDayToUTC(todayTW, false), end: twDayToUTC(todayTW, true) }
    default:
      return { start: twDayToUTC(todayTW, false), end: twDayToUTC(todayTW, true) }
  }
}

// 依台灣日期產生連續日期清單（含頭尾），用於補齊趨勢圖空白日
export function listTWDays(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const d = new Date(startDate + 'T00:00:00+08:00')
  const end = new Date(endDate + 'T00:00:00+08:00')
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}
