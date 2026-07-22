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
  maxSelect?: number // multi 題最多可選數（預設 3）
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
    id: 'gender',
    step: 2,
    text: '請問您的生理性別？',
    subtext: '用於提供更貼切的保健建議',
    type: 'single',
    options: [
      { label: '女性', value: 'female' },
      { label: '男性', value: 'male' },
      { label: '不方便透露', value: 'na' },
    ],
  },
  {
    id: 'concerns',
    step: 3,
    text: '您最近最困擾的健康問題是？',
    subtext: '可選擇 1–3 項',
    type: 'multi',
    maxSelect: 3,
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

// 生活習慣（放在所有問題最後）— 用於補強推薦方向與建議
export const FINAL_QUESTIONS: QuizQuestion[] = [
  {
    id: 'lifestyle',
    step: 90,
    text: '以下哪些符合您目前的生活狀況？',
    subtext: '可複選，幫助我們更精準推薦（最多 4 項）',
    type: 'multi',
    maxSelect: 4,
    options: [
      { label: '🌙 常熬夜 / 睡不好', value: 'latenight' },
      { label: '🍔 外食多 / 飲食不均衡', value: 'diet' },
      { label: '💻 長時間看螢幕 / 3C 族', value: 'screen' },
      { label: '🏃 很少運動', value: 'sedentary' },
      { label: '🚬 有抽菸或飲酒習慣', value: 'smoke_drink' },
      { label: '😣 經常感到壓力大', value: 'stress' },
      { label: '✅ 以上皆無', value: 'none' },
    ],
  },
]

// 生活習慣 → 額外建議的保健方向
export const LIFESTYLE_DIRECTIONS: Record<string, string[]> = {
  latenight: ['sleep-relax', 'immune'],
  diet: ['digestive', 'immune'],
  screen: ['eye-care'],
  sedentary: ['cardiovascular', 'bone-joint'],
  smoke_drink: ['cardiovascular', 'immune'],
  stress: ['sleep-relax', 'immune'],
}

// 年齡層 → 常見需加強的保健方向
export const AGE_DIRECTIONS: Record<string, string[]> = {
  '18-40': ['immune', 'digestive'],
  '41-60': ['cardiovascular', 'bone-joint'],
  '60+': ['bone-joint', 'cardiovascular', 'eye-care'],
}

export const AGE_LABEL: Record<string, string> = {
  '18-40': '18–40 歲',
  '41-60': '41–60 歲',
  '60+': '60 歲以上',
}

// 各子症狀（followup 答案）對應的具體加強建議
export const DETAIL_ADVICE: Record<string, string> = {
  stiff: '關節偶爾僵硬，建議補充葡萄糖胺與軟骨素，搭配適度活動維持關節靈活。',
  pain: '經常關節疼痛，建議加強葡萄糖胺、軟骨素與薑黃（抗發炎），並留意過度負重。',
  bone_density: '骨質疏鬆保養，建議補足鈣質與維生素D，並適度負重運動與曬太陽。',
  blood_pressure: '血壓偏高，建議補充 Omega-3 與鎂，並控制鈉攝取、規律量測血壓。',
  cholesterol: '血脂/膽固醇偏高，建議補充紅麴、Omega-3，並減少精緻與油炸飲食。',
  circulation: '心臟保健與血液循環，建議補充輔酶Q10、Omega-3 與納豆激酶。',
  constipation: '便秘/排便不順，建議補充膳食纖維與益生菌，並多喝水、增加蔬果。',
  bloating: '消化不良/脹氣，建議補充消化酵素與益生菌，並細嚼慢嚥、少產氣食物。',
  microbiome: '腸道菌叢保養，建議補充益生菌+益生元（合生元），維持腸道好菌。',
  insomnia: '難以入睡，建議補充 GABA、鎂、酸棗仁，並固定作息、睡前遠離 3C。',
  unrefreshed: '睡醒仍疲倦，建議補充 B群與鎂，並留意睡眠深度與呼吸品質。',
  daytime: '白天精神不濟，建議補充 B群與鐵（尤其女性），並注意水分與規律運動。',
  dry: '眼睛乾澀，建議補充 Omega-3 與葉黃素，並注意用眼休息與環境濕度。',
  blur: '視力模糊/退化，建議補充葉黃素、玉米黃素與花青素，定期檢查視力。',
  screen: '長時間用眼，建議補充葉黃素+玉米黃素（黃金比例）與花青素，每 30 分鐘休息。',
  cold: '容易感冒，建議補充維生素C、鋅與益生菌，並充足睡眠、勤洗手。',
  allergy: '過敏困擾，建議補充益生菌與維生素D，並留意過敏原與環境清潔。',
  resistance: '抵抗力下降，建議補充維生素C、鋅、β-葡聚糖，並規律運動、均衡飲食。',
}

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
