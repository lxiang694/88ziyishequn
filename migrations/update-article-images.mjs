// Update article cover images with authentic, lifestyle-style photos.
// Hand-picked Unsplash photos that match each article topic and have a documentary/real-life feel.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => {
      const [k, ...rest] = l.split('=')
      return [k.trim(), rest.join('=').trim().replace(/^["']|["']$/g, '').replace(/\\n$/, '')]
    })
)

const supabaseEntry = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'index.mjs')
const { createClient } = await import(pathToFileURL(supabaseEntry).href)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// Carefully selected photos: documentary/lifestyle feel, mature audience, authentic vibe
const updates = [
  {
    slug: 'bone-joint-degeneration',
    cover_image_url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&q=80',
    note: '森林步道行走 — 有自然光、不擺拍',
  },
  {
    slug: 'cardiovascular-three-highs',
    cover_image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=1200&q=80',
    note: '夫妻一起準備健康餐 — 居家溫暖場景',
  },
  {
    slug: 'digestive-constipation',
    cover_image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=1200&q=80',
    note: '切開的奇異果 — 早晨光線、生活感',
  },
  {
    slug: 'sleep-quality-improvement',
    cover_image_url: 'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=1200&q=80',
    note: '安靜的臥室 — 真實居家氛圍',
  },
  {
    slug: 'eye-care-aging',
    cover_image_url: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=1200&q=80',
    note: '眼科檢查現場 — 真實診所場景',
  },
  {
    slug: 'immune-system-boost',
    cover_image_url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80',
    note: '彩色蔬果 — 自然光、不過度修飾',
  },
  {
    slug: 'menopause-care',
    cover_image_url: 'https://images.unsplash.com/photo-1573496773905-f5b17e717f05?w=1200&q=80',
    note: '中年女性側臉 — 沉思感、有歲月痕跡',
  },
  {
    slug: 'mens-midlife-health',
    cover_image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80',
    note: '中年男性肖像 — 真實、有故事感',
  },
  {
    slug: 'metabolism-weight-management',
    cover_image_url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80',
    note: '路面跑步鞋特寫 — 一般人運動、不誇張',
  },
  {
    slug: 'brain-health-dementia-prevention',
    cover_image_url: 'https://images.unsplash.com/photo-1559650656-5d1d361ad10e?w=1200&q=80',
    note: '長者下棋 — 生活化、健腦活動',
  },
]

console.log(`📷 開始更新 ${updates.length} 篇文章封面圖...\n`)

let success = 0
for (const u of updates) {
  const { error } = await supabase
    .from('health_articles')
    .update({ cover_image_url: u.cover_image_url })
    .eq('slug', u.slug)
  if (error) {
    console.log(`❌ ${u.slug}: ${error.message}`)
  } else {
    console.log(`✅ ${u.slug}`)
    console.log(`   ${u.note}`)
    success++
  }
}

console.log(`\n🎉 完成！成功更新 ${success}/${updates.length} 篇`)
