// ISI（Insomnia Severity Index）失眠嚴重度指數
// Morin CM et al. Sleep. 2011. 國際失眠研究標準量表

export interface ISIQuestion {
  id: string
  text: string
  subtext?: string
  options: { label: string; value: number }[]
}

const SEVERITY_OPTIONS = [
  { label: '無', value: 0 },
  { label: '輕', value: 1 },
  { label: '中等', value: 2 },
  { label: '重', value: 3 },
  { label: '極重', value: 4 },
]

const SATISFACTION_OPTIONS = [
  { label: '非常滿意', value: 0 },
  { label: '滿意', value: 1 },
  { label: '一般', value: 2 },
  { label: '不滿意', value: 3 },
  { label: '非常不滿意', value: 4 },
]

const FREQUENCY_OPTIONS = [
  { label: '完全沒有', value: 0 },
  { label: '有一點', value: 1 },
  { label: '中等', value: 2 },
  { label: '很多', value: 3 },
  { label: '非常多', value: 4 },
]

export const ISI_QUESTIONS: ISIQuestion[] = [
  {
    id: 'q1',
    text: '入睡困難的程度',
    subtext: '指躺到床上後，多久才能真的睡著',
    options: SEVERITY_OPTIONS,
  },
  {
    id: 'q2',
    text: '維持睡眠的困難程度',
    subtext: '半夜醒來後，是否難以再入睡',
    options: SEVERITY_OPTIONS,
  },
  {
    id: 'q3',
    text: '早醒問題的嚴重度',
    subtext: '早上比預期時間更早醒來、且無法再睡',
    options: SEVERITY_OPTIONS,
  },
  {
    id: 'q4',
    text: '您對目前睡眠模式的滿意度',
    options: SATISFACTION_OPTIONS,
  },
  {
    id: 'q5',
    text: '睡眠問題對白天功能的影響',
    subtext: '如疲勞、注意力下降、情緒不佳、工作效率降低等',
    options: FREQUENCY_OPTIONS,
  },
  {
    id: 'q6',
    text: '他人是否注意到您的睡眠問題影響到生活品質',
    subtext: '家人、朋友、同事的觀察',
    options: FREQUENCY_OPTIONS,
  },
  {
    id: 'q7',
    text: '您對目前睡眠問題的擔憂或痛苦程度',
    options: FREQUENCY_OPTIONS,
  },
]

export interface SeverityLevel {
  range: [number, number]
  level: 'green' | 'yellow' | 'orange' | 'red'
  emoji: string
  label: string
  shortDesc: string
  longDesc: string
  bgColor: string
  borderColor: string
  textColor: string
  accentColor: string
}

export const SEVERITY_LEVELS: SeverityLevel[] = [
  {
    range: [0, 7],
    level: 'green',
    emoji: '🟢',
    label: '睡眠狀況良好',
    shortDesc: '無臨床顯著的失眠問題',
    longDesc: '您的睡眠目前處於健康範圍。雖然偶爾可能會有不順利的夜晚，但整體並未影響日常生活。建議繼續維持目前的作息與生活習慣。',
    bgColor: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-900',
    accentColor: 'text-green-700',
  },
  {
    range: [8, 14],
    level: 'yellow',
    emoji: '🟡',
    label: '亞臨床失眠',
    shortDesc: '睡眠存在輕度問題，建議開始調整',
    longDesc: '您的睡眠已經出現一些值得關注的訊號，雖然還沒嚴重到失眠症的程度，但若不處理可能會逐漸惡化。建議從生活習慣開始調整，4 週後重測看改善程度。',
    bgColor: 'from-yellow-50 to-amber-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-900',
    accentColor: 'text-yellow-700',
  },
  {
    range: [15, 21],
    level: 'orange',
    emoji: '🟠',
    label: '中度臨床失眠',
    shortDesc: '睡眠問題正在影響生活，需要系統改善',
    longDesc: '您的睡眠狀況已達中度失眠程度，正在影響您的日常生活與健康。建議系統性執行 6 大改善策略，並考慮諮詢醫師。若 4 週後改善不明顯，請尋求專業協助。',
    bgColor: 'from-orange-50 to-amber-100',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-900',
    accentColor: 'text-orange-700',
  },
  {
    range: [22, 28],
    level: 'red',
    emoji: '🔴',
    label: '重度臨床失眠',
    shortDesc: '建議盡快尋求專業協助',
    longDesc: '您的失眠狀況已達重度，這已經是一個需要醫療專業介入的階段。強烈建議您預約睡眠專科或精神科門診評估，同時搭配生活習慣調整。請不要硬撐——失眠是可治療的。',
    bgColor: 'from-red-50 to-rose-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-900',
    accentColor: 'text-red-700',
  },
]

export function getSeverity(score: number): SeverityLevel {
  return SEVERITY_LEVELS.find(s => score >= s.range[0] && score <= s.range[1]) || SEVERITY_LEVELS[0]
}

// 6 大改善策略（取自《高質量睡眠手冊》）
export interface SleepStrategy {
  id: string
  title: string
  oneliner: string
  steps: string[]
  forLevels: ('green' | 'yellow' | 'orange' | 'red')[]
}

export const SLEEP_STRATEGIES: SleepStrategy[] = [
  {
    id: 'rhythm',
    title: '規律作息 + 光照對比度',
    oneliner: '固定起床時間 + 早上見強光',
    steps: [
      '每天固定時間起床（包括週末，誤差 ±30 分鐘內）',
      '起床後 30 分鐘內接觸自然光 10-15 分鐘',
      '中午多走出戶外，下班前少 3C 時間',
      '睡前 2 小時把家裡主燈調暗，手機開夜間模式',
    ],
    forLevels: ['green', 'yellow', 'orange', 'red'],
  },
  {
    id: 'environment',
    title: '臥室環境優化',
    oneliner: '把臥室改造成睡眠艙',
    steps: [
      '溫度 18-20°C：睡前 1 小時開啟冷氣降溫 2-3 度',
      '濕度 50-60%：太乾呼吸難受、太濕散熱困難',
      '光照 < 1 lux：使用遮光窗簾或眼罩',
      '臥室只做兩件事：睡覺 + 親密關係，不工作不滑手機',
    ],
    forLevels: ['yellow', 'orange', 'red'],
  },
  {
    id: 'daytime',
    title: '日間行為調整',
    oneliner: '一整天都在為今晚的睡眠做準備',
    steps: [
      '中午 12 點後不喝咖啡、茶、可樂',
      '每天 30 分鐘以上中等強度運動（健走、慢跑、游泳）',
      '睡前 3 小時不大餐、不飲酒',
      '午睡控制在 20 分鐘內，下午 3 點後不午睡',
    ],
    forLevels: ['yellow', 'orange', 'red'],
  },
  {
    id: 'ritual',
    title: '睡前 1 小時協議',
    oneliner: '讓身體聽懂該睡了的訊號',
    steps: [
      'T-60 分鐘：關掉主燈、開啟暖光夜燈，把手機放下',
      'T-45 分鐘：溫水泡腳（40°C，10-15 分鐘）',
      'T-30 分鐘：做安靜低刺激的事（紙質書、寫感恩日記）',
      'T-10 分鐘：上床做一次呼吸練習',
    ],
    forLevels: ['yellow', 'orange', 'red'],
  },
  {
    id: 'stress',
    title: '壓力管理（4-7-8 呼吸法）',
    oneliner: '從「努力睡著」到「允許入睡」',
    steps: [
      '4 秒：用鼻子吸氣',
      '7 秒：屏住呼吸',
      '8 秒：用嘴緩慢呼氣（發出輕輕的「呼」聲）',
      '重複 4 個循環即可',
    ],
    forLevels: ['yellow', 'orange', 'red'],
  },
  {
    id: 'cbti',
    title: 'CBT-I 認知行為療法',
    oneliner: '失眠一線治療，效果優於安眠藥',
    steps: [
      '只有真的睏了才上床',
      '床只做兩件事：睡眠 + 親密關係',
      '20 分鐘規則：躺下 20 分鐘還沒睡著就起床離開臥室',
      '無論前一晚睡多少，固定時間起床',
    ],
    forLevels: ['orange', 'red'],
  },
]

// 適合睡眠的營養素（按證據等級）
export interface SleepNutrient {
  name: string
  evidence: 'A' | 'B' | 'C'
  mechanism: string
  forLevels: ('yellow' | 'orange' | 'red')[]
}

// ===========================================================
// PSQI（Pittsburgh Sleep Quality Index）匹茲堡睡眠品質指數
// 19 題、7 個成份、總分 0-21
// ===========================================================

export interface PSQIFreqOption {
  label: string
  value: number
}

export const PSQI_FREQ: PSQIFreqOption[] = [
  { label: '從未', value: 0 },
  { label: '少於 1 次/週', value: 1 },
  { label: '1-2 次/週', value: 2 },
  { label: '3 次或以上/週', value: 3 },
]

export const PSQI_QUALITY: PSQIFreqOption[] = [
  { label: '很好', value: 0 },
  { label: '較好', value: 1 },
  { label: '較差', value: 2 },
  { label: '很差', value: 3 },
]

export const PSQI_SEVERITY: PSQIFreqOption[] = [
  { label: '沒有', value: 0 },
  { label: '輕微', value: 1 },
  { label: '中等', value: 2 },
  { label: '嚴重', value: 3 },
]

// PSQI Q5 sleep disturbances (10 sub-questions)
export const PSQI_DISTURBANCES = [
  { id: 'q5a', text: '入睡困難（30 分鐘內無法入睡）' },
  { id: 'q5b', text: '夜間易醒或早醒' },
  { id: 'q5c', text: '夜間需起床去廁所' },
  { id: 'q5d', text: '呼吸不暢' },
  { id: 'q5e', text: '咳嗽或打鼾過響' },
  { id: 'q5f', text: '感覺冷' },
  { id: 'q5g', text: '感覺熱' },
  { id: 'q5h', text: '做噩夢' },
  { id: 'q5i', text: '疼痛不適' },
  { id: 'q5j', text: '其他影響睡眠的事情' },
]

export interface PSQIAnswers {
  bedtime: string         // HH:MM
  sleepLatency: number    // minutes (Q2)
  wakeTime: string        // HH:MM
  actualSleep: number     // hours (Q4)
  disturbances: Record<string, number>  // q5a-q5j
  quality: number         // Q6
  hypnotic: number        // Q7 use of sleep meds
  daytimeDysfunction: number  // Q8
  energyDifficulty: number    // Q9
}

export interface PSQIComponentScores {
  A_quality: number
  B_latency: number
  C_duration: number
  D_efficiency: number
  E_disturbance: number
  F_hypnotic: number
  G_daytime: number
  total: number
  efficiencyPercent: number
}

export function calculatePSQI(a: PSQIAnswers): PSQIComponentScores {
  // A. 主觀睡眠品質 = Q6
  const A = a.quality

  // B. 入睡時間 = Q2 mapped + Q5a, then mapped 0/1/2/3
  const q2Score = a.sleepLatency <= 15 ? 0
    : a.sleepLatency <= 30 ? 1
    : a.sleepLatency <= 60 ? 2 : 3
  const q5aScore = a.disturbances.q5a || 0
  const bSum = q2Score + q5aScore
  const B = bSum === 0 ? 0 : bSum <= 2 ? 1 : bSum <= 4 ? 2 : 3

  // C. 睡眠時間
  const C = a.actualSleep > 7 ? 0 : a.actualSleep >= 6 ? 1 : a.actualSleep >= 5 ? 2 : 3

  // D. 睡眠效率 = (actual / time-in-bed) × 100%
  const minutesInBed = (() => {
    try {
      const [bH, bM] = a.bedtime.split(':').map(Number)
      const [wH, wM] = a.wakeTime.split(':').map(Number)
      let bedMin = bH * 60 + bM
      let wakeMin = wH * 60 + wM
      if (wakeMin <= bedMin) wakeMin += 24 * 60   // crosses midnight
      return wakeMin - bedMin
    } catch { return 0 }
  })()
  const efficiencyPercent = minutesInBed > 0
    ? (a.actualSleep * 60 / minutesInBed) * 100
    : 0
  const D = efficiencyPercent >= 85 ? 0 : efficiencyPercent >= 75 ? 1 : efficiencyPercent >= 65 ? 2 : 3

  // E. 睡眠障礙 = sum of Q5b-j
  const disturbanceSum = ['q5b', 'q5c', 'q5d', 'q5e', 'q5f', 'q5g', 'q5h', 'q5i', 'q5j']
    .reduce((s, id) => s + (a.disturbances[id] || 0), 0)
  const E = disturbanceSum === 0 ? 0 : disturbanceSum <= 9 ? 1 : disturbanceSum <= 18 ? 2 : 3

  // F. 催眠藥物 = Q7
  const F = a.hypnotic

  // G. 日間功能障礙 = Q8 + Q9
  const gSum = a.daytimeDysfunction + a.energyDifficulty
  const G = gSum === 0 ? 0 : gSum <= 2 ? 1 : gSum <= 4 ? 2 : 3

  return {
    A_quality: A, B_latency: B, C_duration: C, D_efficiency: D,
    E_disturbance: E, F_hypnotic: F, G_daytime: G,
    total: A + B + C + D + E + F + G,
    efficiencyPercent: Math.round(efficiencyPercent),
  }
}

export interface PSQILevel {
  range: [number, number]
  emoji: string
  label: string
  desc: string
  color: string
}

export const PSQI_LEVELS: PSQILevel[] = [
  { range: [0, 5], emoji: '🟢', label: '優秀', desc: '睡眠品質良好，請保持現有作息', color: 'green' },
  { range: [6, 10], emoji: '🟡', label: '尚可', desc: '睡眠存在輕度問題，建議從 6 大策略選 3 條開始執行', color: 'yellow' },
  { range: [11, 15], emoji: '🟠', label: '較差', desc: '中度睡眠問題，建議系統執行改善策略 4 週後重測', color: 'orange' },
  { range: [16, 21], emoji: '🔴', label: '很差', desc: '嚴重睡眠問題，建議考慮專業睡眠評估', color: 'red' },
]

export function getPSQILevel(score: number): PSQILevel {
  return PSQI_LEVELS.find(l => score >= l.range[0] && score <= l.range[1]) || PSQI_LEVELS[0]
}

// ===========================================================
// ESS（Epworth Sleepiness Scale）愛潑沃斯嗜睡量表
// 8 題、總分 0-24、特別篩查日間嗜睡與睡眠呼吸中止症
// ===========================================================

export const ESS_QUESTIONS = [
  { id: 'e1', text: '坐著閱讀書報時' },
  { id: 'e2', text: '看電視時' },
  { id: 'e3', text: '在公共場所靜坐時（如劇院、會議）' },
  { id: 'e4', text: '乘車超過 1 小時時（作為乘客）' },
  { id: 'e5', text: '下午躺下休息時' },
  { id: 'e6', text: '坐著與人交談時' },
  { id: 'e7', text: '午餐（不飲酒）後安靜地坐著時' },
  { id: 'e8', text: '開車時遇到塞車或紅燈停下幾分鐘時' },
]

export const ESS_OPTIONS = [
  { label: '從未', value: 0 },
  { label: '很少（偶爾）', value: 1 },
  { label: '一半可能', value: 2 },
  { label: '很可能', value: 3 },
]

export interface ESSLevel {
  range: [number, number]
  emoji: string
  label: string
  desc: string
  warning?: string
  color: string
}

export const ESS_LEVELS: ESSLevel[] = [
  { range: [0, 7], emoji: '🟢', label: '正常', desc: '日間嗜睡程度在正常範圍內', color: 'green' },
  { range: [8, 9], emoji: '🟡', label: '輕度日間嗜睡', desc: '稍有日間嗜睡，建議檢視睡眠時數與品質', color: 'yellow' },
  {
    range: [10, 15], emoji: '🟠', label: '中度日間嗜睡',
    desc: '建議排查睡眠呼吸障礙', color: 'orange',
    warning: '若您身邊的人觀察到您「打鼾很響」或「呼吸暫停」，這兩個信號疊加時，阻塞性睡眠呼吸中止症（OSA）的可能性就非常高了，建議盡快做多導睡眠監測（PSG）。',
  },
  {
    range: [16, 24], emoji: '🔴', label: '重度日間嗜睡',
    desc: '強烈建議就醫', color: 'red',
    warning: '日間嗜睡已達嚴重程度，可能涉及 OSA、發作性睡病等疾病。請優先預約睡眠專科門診。',
  },
]

export function getESSLevel(score: number): ESSLevel {
  return ESS_LEVELS.find(l => score >= l.range[0] && score <= l.range[1]) || ESS_LEVELS[0]
}

// ===========================================================
// 21 天習慣養成 — 每日打卡清單
// ===========================================================

export interface DailyHabit {
  id: string
  icon: string
  text: string
  shortText: string
}

export const DAILY_HABITS: DailyHabit[] = [
  { id: 'h1', icon: '☀️', text: '起床後 30 分鐘內接觸自然光', shortText: '晨光' },
  { id: 'h2', icon: '☕', text: '中午 12 點後不喝咖啡', shortText: '午後不咖啡' },
  { id: 'h3', icon: '🏃', text: '今天有 30 分鐘以上運動', shortText: '30 分鐘運動' },
  { id: 'h4', icon: '🍽️', text: '睡前 3 小時內沒有大餐 / 飲酒', shortText: '不夜食' },
  { id: 'h5', icon: '📵', text: '睡前 1 小時放下手機', shortText: '放下手機' },
  { id: 'h6', icon: '🧘', text: '睡前做了放鬆活動（泡腳 / 冥想 / 呼吸）', shortText: '放鬆活動' },
  { id: 'h7', icon: '🛌', text: '固定時間上床 / 起床', shortText: '固定作息' },
  { id: 'h8', icon: '🏠', text: '臥室只做睡眠（沒在床上工作 / 刷手機）', shortText: '臥室淨化' },
]

// ===========================================================
// 適合睡眠的營養素（按證據等級）
// ===========================================================

export const SLEEP_NUTRIENTS: SleepNutrient[] = [
  {
    name: '鎂（甘氨酸鎂 / 蘇糖酸鎂）',
    evidence: 'B',
    mechanism: '參與 GABA 能系統、抗應激；如果你便秘，優先選這個',
    forLevels: ['yellow', 'orange', 'red'],
  },
  {
    name: 'GABA（γ-氨基丁酸）',
    evidence: 'B',
    mechanism: '抑制性神經遞質，幫助身體放鬆',
    forLevels: ['yellow', 'orange'],
  },
  {
    name: '酸棗仁',
    evidence: 'B',
    mechanism: '傳統安神中藥，含皂苷、黃酮，已收錄於《中國藥典》',
    forLevels: ['yellow', 'orange', 'red'],
  },
  {
    name: 'L-茶氨酸',
    evidence: 'B',
    mechanism: '增強 α 腦波、抗焦慮，來自綠茶，副作用極小',
    forLevels: ['yellow', 'orange'],
  },
  {
    name: 'B 群（特別是 B6）',
    evidence: 'B',
    mechanism: '幫助色氨酸轉化為褪黑激素，穩定神經',
    forLevels: ['yellow', 'orange', 'red'],
  },
]
