export interface QuizOption {
  label: string
  value: string
  directions?: string[]
}

export interface QuizQuestion {
  id: string
  step: number
  text: string
  subtext?: string
  type: 'single' | 'multi'
  options: QuizOption[]
  showIf?: string[]  // only show this question if any of these concern slugs were selected
}

export const INTRO_QUESTIONS: QuizQuestion[] = [
  {
    id: 'age',
    step: 1,
    text: '請問您的年齡層？',
    type: 'single',
    options: [
      { label: '18 – 40 歲', value: '18-40' },
      { label: '41 – 60 歲', value: '41-60' },
      { label: '60 歲以上', value: '60+' },
    ],
  },
  {
    id: 'concerns',
    step: 2,
    text: '您最近最困擾的健康問題是？',
    subtext: '可選擇 1–3 項',
    type: 'multi',
    options: [
      { label: '🦴 骨骼關節疼痛', value: 'bone-joint', directions: ['bone-joint'] },
      { label: '❤️ 心血管 / 血壓', value: 'cardiovascular', directions: ['cardiovascular'] },
      { label: '🫁 腸胃消化不適', value: 'digestive', directions: ['digestive'] },
      { label: '😴 睡眠差 / 易疲勞', value: 'sleep-relax', directions: ['sleep-relax'] },
      { label: '👁️ 眼睛不適 / 視力', value: 'eye-care', directions: ['eye-care'] },
      { label: '🛡️ 免疫力偏弱', value: 'immune', directions: ['immune'] },
    ],
  },
]

export const FOLLOWUP_QUESTIONS: QuizQuestion[] = [
  {
    id: 'bone_detail',
    step: 3,
    showIf: ['bone-joint'],
    text: '您的骨骼關節困擾主要是？',
    type: 'single',
    options: [
      { label: '關節偶爾僵硬', value: 'stiff' },
      { label: '經常關節疼痛', value: 'pain' },
      { label: '骨質疏鬆保養', value: 'bone_density' },
    ],
  },
  {
    id: 'cardio_detail',
    step: 3,
    showIf: ['cardiovascular'],
    text: '您的心血管困擾主要是？',
    type: 'single',
    options: [
      { label: '血壓偏高', value: 'blood_pressure' },
      { label: '血脂偏高 / 膽固醇', value: 'cholesterol' },
      { label: '心臟保健 / 血液循環', value: 'circulation' },
    ],
  },
  {
    id: 'digestive_detail',
    step: 3,
    showIf: ['digestive'],
    text: '您的腸胃問題主要是？',
    type: 'single',
    options: [
      { label: '便秘 / 排便不順', value: 'constipation' },
      { label: '消化不良 / 脹氣', value: 'bloating' },
      { label: '腸道菌叢 / 腸道健康', value: 'microbiome' },
    ],
  },
  {
    id: 'sleep_detail',
    step: 3,
    showIf: ['sleep-relax'],
    text: '您的睡眠或疲勞狀況？',
    type: 'single',
    options: [
      { label: '難以入睡', value: 'insomnia' },
      { label: '睡醒仍感疲倦', value: 'unrefreshed' },
      { label: '白天容易精神不濟', value: 'daytime' },
    ],
  },
  {
    id: 'eye_detail',
    step: 3,
    showIf: ['eye-care'],
    text: '您的眼睛困擾主要是？',
    type: 'single',
    options: [
      { label: '眼睛乾澀 / 刺激', value: 'dry' },
      { label: '視力模糊 / 退化', value: 'blur' },
      { label: '長時間用眼 / 螢幕族', value: 'screen' },
    ],
  },
  {
    id: 'immune_detail',
    step: 3,
    showIf: ['immune'],
    text: '您的免疫困擾主要是？',
    type: 'single',
    options: [
      { label: '容易感冒', value: 'cold' },
      { label: '過敏困擾', value: 'allergy' },
      { label: '整體抵抗力下降', value: 'resistance' },
    ],
  },
]

export interface DirectionInfo {
  name: string
  icon: string
  advice: string
  ingredients: string
}

export const DIRECTION_INFO: Record<string, DirectionInfo> = {
  'bone-joint': {
    name: '骨骼關節',
    icon: '🦴',
    advice: '針對您的骨骼關節困擾，建議補充含有葡萄糖胺、軟骨素、鈣質或薑黃的保健品，有助於維護關節靈活度與骨骼健康。',
    ingredients: '葡萄糖胺、軟骨素、鈣、維生素D、薑黃',
  },
  cardiovascular: {
    name: '心血管保健',
    icon: '❤️',
    advice: '針對您的心血管需求，建議補充 Omega-3 魚油、輔酶Q10、大蒜精等，有助於維持正常血壓與心血管功能。',
    ingredients: 'Omega-3、輔酶Q10、大蒜精、紅麴',
  },
  digestive: {
    name: '腸胃消化',
    icon: '🫁',
    advice: '針對您的腸胃問題，建議補充益生菌、膳食纖維、消化酵素等，有助於促進腸道蠕動與消化健康。',
    ingredients: '益生菌、益生元、消化酵素、膳食纖維',
  },
  'sleep-relax': {
    name: '睡眠疲勞',
    icon: '😴',
    advice: '針對您的睡眠與疲勞困擾，建議補充 GABA、色胺酸、鎂、B群等，有助於提升睡眠品質與日間精力。',
    ingredients: 'GABA、鎂、B群、色胺酸、酸棗仁',
  },
  'eye-care': {
    name: '眼睛視力',
    icon: '👁️',
    advice: '針對您的眼睛困擾，建議補充葉黃素、玉米黃素、花青素、維生素A等，有助於保護眼睛、減緩視力退化。',
    ingredients: '葉黃素、玉米黃素、花青素、維生素A',
  },
  immune: {
    name: '免疫力',
    icon: '🛡️',
    advice: '針對您的免疫需求，建議補充維生素C、鋅、益生菌、蜂膠等，有助於強化免疫系統與抗氧化防護。',
    ingredients: '維生素C、鋅、蜂膠、β-葡聚糖',
  },
}
