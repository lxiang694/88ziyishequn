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

// ── 個人化保健方案：飲食、生活、營養素搭配（主/輔）、服用時間、來源 ──
export interface NutrientItem { name: string; note?: string }
export interface DirectionPlan {
  diet: string
  lifestyle: string
  nutrients: NutrientItem[]
  timing: string
  source: string
}

export const DIRECTION_PLAN: Record<string, DirectionPlan> = {
  'bone-joint': {
    diet: '多攝取高鈣食物（乳製品、深綠色蔬菜、小魚乾、豆製品），搭配足夠優質蛋白維持肌肉；減少過量咖啡因與高鹽飲食，以免加速鈣質流失。',
    lifestyle: '規律負重運動（快走、阻力訓練）能刺激骨質；適度曬太陽幫助身體自行合成維生素D；避免久坐與關節過度負重。',
    nutrients: [
      { name: '鈣', note: '主力，單次吸收有限，建議分早晚兩次' },
      { name: '維生素D3', note: '幫助鈣質吸收（脂溶性）' },
      { name: '維生素K2', note: '協同：引導鈣沉積到骨骼' },
      { name: '葡萄糖胺、軟骨素', note: '關節保養' },
      { name: '薑黃', note: '關節舒緩，配黑胡椒/油脂吸收較好' },
    ],
    timing: '鈣隨餐、分兩次；維生素D3、薑黃等脂溶性成分建議隨含油脂的正餐一起食用。',
    source: '鈣分碳酸鈣（需隨餐、靠胃酸幫助）與檸檬酸鈣（空腹也可，腸胃敏感者較適合）；維生素以 D3 優於 D2。',
  },
  cardiovascular: {
    diet: '參考地中海飲食：多蔬果、全穀、堅果與深海魚；減少精緻糖、油炸與反式脂肪，並控制鈉（鹽）攝取。',
    lifestyle: '每週累積約 150 分鐘中等強度有氧、戒菸限酒、控制體重與壓力，並定期量測血壓與血脂。',
    nutrients: [
      { name: 'Omega-3（EPA/DHA）', note: '主力，維持血脂與循環' },
      { name: '輔酶Q10', note: '心肌能量；服用降血脂藥者常見流失' },
      { name: '紅麴', note: '維持膽固醇代謝' },
      { name: '鎂', note: '與血壓、心血管相關' },
    ],
    timing: 'Omega-3、Q10 為脂溶性，隨餐吸收較佳；紅麴多建議睡前。',
    source: '魚油看 EPA/DHA 濃度與純化（去除重金屬）；Q10 以還原型（ubiquinol）吸收較佳。⚠️ 紅麴不可與降血脂藥併用，正在服藥者請先諮詢醫師。',
  },
  digestive: {
    diet: '增加膳食纖維（蔬果、全穀、豆類）與足夠水分；適量發酵食物（優格、泡菜、味噌）補充好菌；細嚼慢嚥，減少刺激與易產氣食物。',
    lifestyle: '規律作息與用餐時間、適度運動促進腸道蠕動；學習紓壓——腸胃和情緒高度相關。',
    nutrients: [
      { name: '益生菌', note: '主力，多菌株、足夠菌數' },
      { name: '益生元 / 膳食纖維', note: '協同：餵養好菌（合生元效果更好）' },
      { name: '消化酵素', note: '脹氣、消化不良時隨餐' },
    ],
    timing: '益生菌多建議空腹或睡前（避開胃酸高峰）；消化酵素隨餐；補纖維要配足量水分。',
    source: '益生菌看菌株標示、菌數（CFU）以及是否耐胃酸／包埋技術。',
  },
  'sleep-relax': {
    diet: '晚餐清淡、睡前避免咖啡因與酒精；適量色胺酸食物（牛奶、香蕉、堅果）幫助放鬆。',
    lifestyle: '固定作息、睡前 1 小時遠離 3C 與強光、白天曬太陽或運動穩定生理時鐘，並建立睡前放鬆儀式。',
    nutrients: [
      { name: '鎂', note: '主力，放鬆神經與肌肉' },
      { name: 'GABA、色胺酸、酸棗仁', note: '幫助放鬆入眠' },
      { name: 'B 群', note: '能量代謝與日間精神（建議白天）' },
    ],
    timing: '鎂、GABA、酸棗仁睡前 30–60 分鐘；B 群白天隨餐，避免晚上提神影響睡眠。',
    source: '鎂以甘胺酸鎂、檸檬酸鎂吸收佳且較不刺激腸胃（氧化鎂吸收差、易軟便）。',
  },
  'eye-care': {
    diet: '多攝取深綠與黃橙色蔬果（菠菜、玉米、南瓜）與深海魚；控制長時間近距離用眼。',
    lifestyle: '採 20-20-20 原則（每 20 分鐘看遠 20 秒）、注意環境光線與濕度、調整螢幕亮度與藍光。',
    nutrients: [
      { name: '葉黃素＋玉米黃素', note: '主力，建議黃金比例約 10:2' },
      { name: 'Omega-3', note: '協同：淚液品質、乾眼' },
      { name: '花青素（山桑子/黑醋栗）', note: '舒緩用眼疲勞' },
      { name: '維生素A / β-胡蘿蔔素', note: '一般眼睛保養' },
    ],
    timing: '葉黃素、Omega-3 為脂溶性，隨含油脂餐食一起吃吸收較好；建議連續補充 2–3 個月觀察。',
    source: '葉黃素分游離型與酯化型（游離型吸收較快）；魚油注意純化與濃度。',
  },
  immune: {
    diet: '均衡攝取多色蔬果（維生素C、植化素）與優質蛋白；適量發酵食物養腸道（免疫約七成在腸道）；減少精緻糖。',
    lifestyle: '充足睡眠、規律運動、學習紓壓、勤洗手；避免過勞與長期熬夜。',
    nutrients: [
      { name: '維生素C', note: '主力，水溶性、分次補充' },
      { name: '鋅', note: '免疫關鍵礦物質' },
      { name: '維生素D', note: '免疫調節' },
      { name: '益生菌、β-葡聚糖、蜂膠', note: '協同強化' },
    ],
    timing: '維生素C 水溶性、分次隨餐；維生素D 脂溶性隨餐；鋅避免與大量鈣/鐵同時補充（會互相競爭吸收）。',
    source: '維生素C 可選緩釋型減少腸胃刺激；維生素以 D3 優於 D2。',
  },
}
