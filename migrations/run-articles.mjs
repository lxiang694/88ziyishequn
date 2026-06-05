// Node.js script to seed 10 health articles via Supabase JS SDK.
// Usage: node migrations/run-articles.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const [k, ...rest] = l.split('=')
      const v = rest.join('=').trim().replace(/^["']|["']$/g, '').replace(/\\n$/, '')
      return [k.trim(), v]
    })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ 找不到 SUPABASE_URL 或 SERVICE_KEY')
  process.exit(1)
}

console.log('🔗 連線到', SUPABASE_URL)

// Import Supabase from the project's node_modules (Windows-safe via file URL)
const supabaseEntry = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'index.mjs')
const { createClient } = await import(pathToFileURL(supabaseEntry).href)
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Check if table exists (PGRST205 = PostgREST schema cache miss, 42P01 = pg "table not found")
const { error: checkError } = await supabase.from('health_articles').select('id').limit(1)
if (checkError && (checkError.code === 'PGRST205' || checkError.code === '42P01')) {
  console.error(`
❌ 資料表 health_articles 還不存在。

請先到 Supabase Dashboard SQL Editor，貼上以下 SQL 執行（只要 10 行）：

────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_articles (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  cover_image_url TEXT,
  content TEXT NOT NULL,
  category_slug TEXT,
  reading_minutes INT DEFAULT 5,
  is_published BOOLEAN DEFAULT true,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE health_articles DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_health_articles_slug ON health_articles(slug);
CREATE INDEX IF NOT EXISTS idx_health_articles_category ON health_articles(category_slug);
CREATE INDEX IF NOT EXISTS idx_health_articles_published ON health_articles(is_published, created_at DESC);
────────────────────────────────────────────────────

執行完畢後再次執行：node migrations/run-articles.mjs
`)
  process.exit(2)
}
if (checkError) {
  console.error('❌ 查詢失敗：', checkError)
  process.exit(1)
}

console.log('✅ 資料表已存在，開始插入文章...')

// Read SQL and parse INSERT values
const sql = fs.readFileSync(path.join(__dirname, 'health_articles.sql'), 'utf8')

// Articles data — extracted directly into JS arrays to avoid SQL parsing complexity
const articles = []

// Match each VALUES tuple: ('slug', 'title', 'excerpt', 'cover', E'content', 'cat', minutes)
// Use a multi-line capture
const valueBlock = sql.match(/INSERT INTO health_articles[^;]+;/s)?.[0]
if (!valueBlock) {
  console.error('❌ 無法從 SQL 解析 INSERT')
  process.exit(1)
}

// Each tuple is wrapped: (\n'slug', 'title', 'excerpt', 'cover_url', E'content...', 'cat', N)
// Use a robust state machine to extract.
const text = valueBlock
let i = text.indexOf('VALUES')
if (i < 0) { console.error('Cannot find VALUES'); process.exit(1) }
i += 'VALUES'.length

function parseTuple(start) {
  // skip whitespace and find (
  let j = start
  while (j < text.length && text[j] !== '(') j++
  if (j >= text.length) return null
  j++ // past (
  const fields = []
  while (true) {
    // skip whitespace and comments
    while (j < text.length && /\s/.test(text[j])) j++
    if (text[j] === ')') { j++; return [fields, j] }

    // Detect E'...' string
    let isEscape = false
    if (text[j] === 'E' && text[j + 1] === "'") { isEscape = true; j++ }

    if (text[j] === "'") {
      j++ // past opening '
      let s = ''
      while (j < text.length) {
        if (text[j] === "'" && text[j + 1] === "'") { s += "'"; j += 2; continue }
        if (text[j] === "'") { j++; break }
        if (isEscape && text[j] === '\\') {
          const next = text[j + 1]
          if (next === 'n') { s += '\n'; j += 2; continue }
          if (next === 't') { s += '\t'; j += 2; continue }
          if (next === '\\') { s += '\\'; j += 2; continue }
          if (next === "'") { s += "'"; j += 2; continue }
          s += next; j += 2; continue
        }
        s += text[j]; j++
      }
      fields.push(s)
    } else {
      // numeric or null
      let s = ''
      while (j < text.length && text[j] !== ',' && text[j] !== ')') { s += text[j]; j++ }
      const trimmed = s.trim()
      if (trimmed === 'NULL' || trimmed === 'null') fields.push(null)
      else if (/^-?\d+$/.test(trimmed)) fields.push(parseInt(trimmed))
      else if (/^-?\d+\.\d+$/.test(trimmed)) fields.push(parseFloat(trimmed))
      else fields.push(trimmed)
    }
    // skip until , or )
    while (j < text.length && text[j] !== ',' && text[j] !== ')') j++
    if (text[j] === ',') j++
  }
}

let pos = i
while (pos < text.length) {
  const result = parseTuple(pos)
  if (!result) break
  const [fields, next] = result
  pos = next
  if (fields.length >= 7) {
    articles.push({
      slug: fields[0],
      title: fields[1],
      excerpt: fields[2],
      cover_image_url: fields[3],
      content: fields[4],
      category_slug: fields[5],
      reading_minutes: fields[6],
    })
  }
  // skip ',' or ';'
  while (pos < text.length && (text[pos] === ',' || /\s/.test(text[pos]))) pos++
  if (text[pos] === ';') break
}

console.log(`📝 解析出 ${articles.length} 篇文章`)
if (articles.length === 0) {
  console.error('❌ 沒解析到任何文章內容')
  process.exit(1)
}

// Use upsert by slug, so re-running won't duplicate
const { data, error } = await supabase
  .from('health_articles')
  .upsert(articles, { onConflict: 'slug' })
  .select('id, slug, title')

if (error) {
  console.error('❌ 寫入失敗：', error)
  process.exit(1)
}

console.log(`\n✅ 成功寫入 ${data.length} 篇文章：\n`)
for (const a of data) {
  console.log(`  • ${a.title}`)
  console.log(`    /health-articles/${a.slug}`)
}
console.log('\n🎉 全部完成！前往 https://healthec.vercel.app/health-articles 查看')
