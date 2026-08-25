/**
 * 陪診子品牌設定 —— 單一來源
 *
 * 所有 /care 頁面與元件的品牌名稱、標語、導覽、聯絡方式一律從這裡匯入，
 * 不得在頁面中寫死。要換品牌名或調整選單，只改這個檔案。
 *
 * 注意：這裡不重複定義商城（健康優選）的品牌資訊，兩者刻意分開。
 */

/**
 * LINE 諮詢連結。
 *
 * 優先讀取環境變數 NEXT_PUBLIC_CARE_LINE_URL（陪診專用帳號）。
 * 未設定時沿用「目前 /care 頁面上已經在使用」的官方 LINE 帳號，
 * 這不是虛構的連結，而是既有營運中的帳號；但它與商城客服共用，
 * 正式上線前應改為陪診專用帳號（見交付說明）。
 */
const FALLBACK_LINE_URL = 'https://line.me/ti/p/yw13134'
const ENV_LINE_URL = process.env.NEXT_PUBLIC_CARE_LINE_URL || ''

export const careBrand = {
  /** 暫定品牌名稱，正式名稱確認後只改這一行 */
  name: '陪診安心服務',
  /** 導覽列上的短標，避免手機版換行 */
  shortName: '陪診安心',
  tagline: '家人不在現場，重要就醫流程也有人可靠陪同',
  /** 品牌定位敘述，SEO description 與 Hero 共用 */
  positioning:
    '協助報到、院內動線、候診、流程銜接與重點記錄；服務前確認需求與費用，服務中依約回報家屬。陪診員不提供醫療判斷，也不代替病人或家屬做醫療決定。',
  lineUrl: ENV_LINE_URL || FALLBACK_LINE_URL,
  /** true 代表目前用的是共用帳號，尚未設定陪診專用的 NEXT_PUBLIC_CARE_LINE_URL */
  lineIsShared: !ENV_LINE_URL,
  /**
   * 營運主體名稱尚未確認，暫以品牌名顯示。
   * 確認後填入正式登記名稱（見交付說明）。
   */
  legalEntity: '',
  /** 回商城的低顯著度連結，只允許出現在頁尾最底部 */
  mall: { label: '返回健康優選', href: '/' },
} as const

/** 主要行動：整站只有這兩個，避免注意力分散 */
export const CARE_CTA = {
  primary: { label: '先做需求評估', href: '/care/assessment' },
  secondary: { label: 'LINE 諮詢', href: careBrand.lineUrl },
} as const

/** Header 導覽（桌面與手機共用，不得混入商城連結） */
export const CARE_NAV = [
  { label: '服務如何進行', href: '/care/process' },
  { label: '方案與費用', href: '/care/services' },
  { label: '安全與隱私', href: '/care/safety' },
  { label: '常見問題', href: '/care/faq' },
  { label: '預約查詢', href: '/care/account' },
] as const

/** Footer 三組連結 */
export const CARE_FOOTER_GROUPS = [
  {
    title: '開始服務',
    links: [
      { label: '需求評估', href: '/care/assessment' },
      { label: '方案與費用', href: '/care/services' },
      { label: '服務如何進行', href: '/care/process' },
      { label: '預約查詢', href: '/care/account' },
    ],
  },
  {
    title: '家屬安心',
    links: [
      { label: '家屬回報說明', href: '/care/process#report' },
      { label: '常見問題', href: '/care/faq' },
      { label: '就醫準備指南', href: '/care/faq#prepare' },
    ],
  },
  {
    title: '信任與規範',
    links: [
      { label: '服務邊界', href: '/care/safety#boundary' },
      { label: '安全與隱私', href: '/care/safety' },
      { label: '取消與改期', href: '/care/safety#cancel' },
      { label: '意見回饋', href: '/care/account#feedback' },
    ],
  },
] as const

/**
 * 需求分流情境。
 * value 會以 query 參數 ?scenario= 帶到 /care/assessment，
 * 讀取端必須用 isCareScenario() 白名單驗證，不可直接信任網址內容。
 */
export const CARE_SCENARIOS = [
  {
    value: 'clinic',
    label: '一般門診／拿慢箋',
    desc: '固定回診、領慢性處方箋，時間較短、流程單純',
  },
  {
    value: 'exam',
    label: '門診加檢查',
    desc: '看診當天還要抽血、影像或其他檢查，需要跨樓層移動',
  },
  {
    value: 'fullday',
    label: '多科別或全日',
    desc: '同一天看多科、健檢，或整天都在院內等待',
  },
  {
    value: 'postop',
    label: '術後／麻醉離院',
    desc: '無痛檢查或日間手術後，依院方規定需有人陪同離院',
  },
  {
    value: 'unsure',
    label: '不確定需要什麼',
    desc: '先描述狀況，由專人協助判斷合適的服務方式',
  },
] as const

export type CareScenario = (typeof CARE_SCENARIOS)[number]['value']

/** query 參數白名單驗證：非白名單一律當作未指定 */
export function isCareScenario(v: string | null | undefined): v is CareScenario {
  return !!v && CARE_SCENARIOS.some(s => s.value === v)
}

export function careScenarioLabel(v: string | null | undefined): string {
  return CARE_SCENARIOS.find(s => s.value === v)?.label || ''
}
