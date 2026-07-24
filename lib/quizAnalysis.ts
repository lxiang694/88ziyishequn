import {
  DIRECTION_INFO, DETAIL_ADVICE, LIFESTYLE_DIRECTIONS, AGE_DIRECTIONS, AGE_LABEL,
  DIRECTION_PLAN, DirectionPlan,
} from './quizData'

export type QuizAnswers = Record<string, string | string[]>

export interface QuizDirection {
  slug: string
  name: string
  icon: string
  advice: string        // 基礎方向建議
  detailAdvice?: string // 依子症狀細化的建議
  ingredients: string
  primary: boolean       // 是否為使用者主動勾選的困擾（true）或系統延伸建議（false）
  plan?: DirectionPlan   // 個人化方案：飲食/生活/營養素/時間/來源
}

export interface QuizAnalysis {
  age: string
  gender: string
  cats: string[]              // 產品推薦用的方向（含延伸），已排序、去重、上限 4
  primaryCats: string[]
  directions: QuizDirection[]
  summary: string
  lifestyle: string[]
}

const MAX_CATS = 4

function asArray(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string' && v) return [v]
  return []
}

// 找出這個方向對應的 followup 子症狀答案（例如 bone-joint → bone_detail）
const CONCERN_DETAIL_KEY: Record<string, string> = {
  'bone-joint': 'bone_detail',
  cardiovascular: 'cardio_detail',
  digestive: 'digestive_detail',
  'sleep-relax': 'sleep_detail',
  'eye-care': 'eye_detail',
  immune: 'immune_detail',
}

export function buildAnalysis(answers: QuizAnswers): QuizAnalysis {
  const age = (answers.age as string) || ''
  const gender = (answers.gender as string) || ''
  const primaryCats = asArray(answers.concerns).slice(0, 3)
  const lifestyle = asArray(answers.lifestyle).filter(l => l !== 'none')

  // 延伸方向：生活習慣 + 年齡
  const derived: string[] = []
  for (const l of lifestyle) for (const d of (LIFESTYLE_DIRECTIONS[l] || [])) derived.push(d)
  for (const d of (AGE_DIRECTIONS[age] || [])) derived.push(d)

  // 合併：主動困擾優先，接著延伸（去重、上限）
  const ordered: string[] = []
  const push = (slug: string) => { if (DIRECTION_INFO[slug] && !ordered.includes(slug)) ordered.push(slug) }
  primaryCats.forEach(push)
  derived.forEach(push)
  const cats = (ordered.length ? ordered : ['immune']).slice(0, MAX_CATS)

  const directions: QuizDirection[] = cats.map(slug => {
    const info = DIRECTION_INFO[slug]
    const detailVal = answers[CONCERN_DETAIL_KEY[slug]] as string | undefined
    return {
      slug,
      name: info.name,
      icon: info.icon,
      advice: info.advice,
      detailAdvice: detailVal ? DETAIL_ADVICE[detailVal] : undefined,
      ingredients: info.ingredients,
      primary: primaryCats.includes(slug),
      plan: DIRECTION_PLAN[slug],
    }
  })

  // 個人化摘要
  const parts: string[] = []
  if (age) parts.push(`${AGE_LABEL[age] || age}`)
  if (gender === 'female') parts.push('女性')
  else if (gender === 'male') parts.push('男性')
  const who = parts.length ? `根據您（${parts.join('・')}）` : '根據您'
  const primaryNames = directions.filter(d => d.primary).map(d => d.name)
  const derivedNames = directions.filter(d => !d.primary).map(d => d.name)

  let summary = who + '的填答，'
  if (primaryNames.length) summary += `我們針對您關注的「${primaryNames.join('、')}」`
  else summary += '我們'
  summary += '整理了以下保健重點'
  if (derivedNames.length) summary += `，並依您的年齡與生活習慣，額外建議留意「${derivedNames.join('、')}」`
  summary += '。'

  return { age, gender, cats, primaryCats, directions, summary, lifestyle }
}

// 從 URL 參數還原分析（優先 base64 的 a；否則退回舊的 cats=）
export function analysisFromParams(params: { a?: string; cats?: string }): QuizAnalysis {
  if (params.a) {
    try {
      const json = typeof window === 'undefined'
        ? Buffer.from(params.a, 'base64').toString('utf8')
        : decodeURIComponent(escape(atob(params.a)))
      return buildAnalysis(JSON.parse(json))
    } catch {
      // fall through
    }
  }
  const cats = (params.cats || 'immune').split(',').filter(Boolean)
  return buildAnalysis({ concerns: cats })
}

// 供 client 端把 answers 編碼進 URL
export function encodeAnswers(answers: QuizAnswers): string {
  const json = JSON.stringify(answers)
  if (typeof window === 'undefined') return Buffer.from(json, 'utf8').toString('base64')
  return btoa(unescape(encodeURIComponent(json)))
}
