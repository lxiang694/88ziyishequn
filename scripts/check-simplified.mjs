#!/usr/bin/env node
/**
 * 簡體字 / 中國用語檢查
 *
 *   node scripts/check-simplified.mjs         掃描原始碼（app/ components/ lib/）
 *   node scripts/check-simplified.mjs --db    另外掃描 Supabase products 資料表，產出報告
 *
 * 偵測分三層：
 *   L1 error   簡體專用字（單字元轉換後改變，且不在歧義清單）
 *   L2 warning 兩體通用的歧義字（正體本身合法，需人工判讀）
 *   L3 warning 中國慣用語詞庫 + 陸版異體用字
 *
 * 有任何 error → exit(1)
 *
 * 註：偵測用的是 s2twp（台灣正體＋用語）而非 s2t。s2t 會把「床→牀」「群→羣」
 *     判成需要轉換，那些其實是正確的台灣用字，會造成大量誤判。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as OpenCC from 'opencc-js'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── 轉換器 ─────────────────────────────────────────────
/** 簡體 → 台灣正體（含台灣慣用語）。同時用於偵測與建議。 */
const toTW = OpenCC.Converter({ from: 'cn', to: 'twp' })

// ── 設定 ───────────────────────────────────────────────
const SCAN_DIRS = ['app', 'components', 'lib']
const SCAN_EXTS = new Set(['.tsx', '.ts', '.json'])
const EXCLUDE_DIRS = new Set(['node_modules', '.next', '.git', 'public/fonts'])

/**
 * L2：兩體通用的歧義字，正體本身合法 → 只記 warning
 *
 * 第一行為原始指定清單；第二行為實測補齊——這些字在正體中合法
 * （漏「斗」、「游」離型、「游」泳、營收「占」比），但同時是某繁體字的簡化形，
 * 字元級轉換會誤判成簡體字，若不列入會產生假錯誤。
 * 註：别（別）、价（價）等純簡體字**不**列入，維持 error。
 */
const AMBIGUOUS = new Set([
  ...'后里面干松台制只系表云姜谷板划歷征沖種蔔咸醜御',
  ...'占斗游于余采咨郁准伙',
])

const termsPath = path.join(__dirname, 'cn-terms.json')
const dict = JSON.parse(fs.readFileSync(termsPath, 'utf8'))
const CN_TERMS = dict.terms || {}
const CN_VARIANTS = dict.variants || {}

const isCJK = ch => /[㐀-䶿一-鿿豈-﫿]/.test(ch)

// ── 掃描核心 ───────────────────────────────────────────
/**
 * 掃描一段文字，回傳命中清單。
 * @param {string} text 待掃描文字
 * @param {number} base 此段文字在原檔中的起始 offset（用於算行號）
 */
function scanText(text, base = 0) {
  const hits = []

  // L1 / L2：逐字元轉換
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (!isCJK(ch)) continue
    const conv = toTW(ch)
    if (conv === ch) continue
    const ambiguous = AMBIGUOUS.has(ch)
    hits.push({
      pos: base + i,
      char: ch,
      suggest: conv,
      level: ambiguous ? 'warning' : 'error',
      rule: ambiguous ? 'L2' : 'L1',
      note: ambiguous ? '兩體通用字，需人工判讀' : '簡體專用字',
    })
  }

  // L2 補充：歧義字即使 OpenCC 未轉換也提示（例如「面」在「頁面/麵條」語意不同）
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (!AMBIGUOUS.has(ch)) continue
    if (hits.some(h => h.pos === base + i)) continue // 已由上面記錄
    hits.push({
      pos: base + i,
      char: ch,
      suggest: '',
      level: 'warning',
      rule: 'L2',
      note: '兩體通用字，需人工判讀',
    })
  }

  // L3a：陸版異體用字
  for (const [bad, good] of Object.entries(CN_VARIANTS)) {
    let from = 0
    for (;;) {
      const i = text.indexOf(bad, from)
      if (i === -1) break
      hits.push({
        pos: base + i,
        char: bad,
        suggest: good,
        level: 'warning',
        rule: 'L3',
        note: '陸版 / 異體用字',
      })
      from = i + bad.length
    }
  }

  // L3b：中國慣用語
  for (const [term, advice] of Object.entries(CN_TERMS)) {
    let from = 0
    for (;;) {
      const i = text.indexOf(term, from)
      if (i === -1) break
      hits.push({
        pos: base + i,
        char: term,
        suggest: advice,
        level: 'warning',
        rule: 'L3',
        note: '中國慣用語',
      })
      from = i + term.length
    }
  }

  return hits
}

/** 取前後各 15 字上下文 */
function contextOf(fullText, pos, len = 1) {
  const start = Math.max(0, pos - 15)
  const end = Math.min(fullText.length, pos + len + 15)
  return fullText.slice(start, end).replace(/\s+/g, ' ').trim()
}

// ── 原始碼掃描 ─────────────────────────────────────────
function walkFiles(dir, out = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    const rel = path.relative(ROOT, full)
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name) || EXCLUDE_DIRS.has(rel)) continue
      walkFiles(full, out)
    } else if (SCAN_EXTS.has(path.extname(e.name))) {
      if (/(package-lock|pnpm-lock|yarn\.lock)/.test(e.name)) continue
      out.push(full)
    }
  }
  return out
}

/** 用 TS AST 只取字串字面值與 JSX 文字節點，排除識別字與 import 路徑 */
function collectLiteralNodes(sourceFile) {
  const nodes = []
  const visit = node => {
    // 排除 import / export 的模組路徑
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      node.forEachChild(c => {
        if (c !== node.moduleSpecifier) visit(c)
      })
      return
    }
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      nodes.push(node)
    }
    node.forEachChild(visit)
  }
  visit(sourceFile)
  return nodes
}

function scanSourceFile(file) {
  const rel = path.relative(ROOT, file)
  const text = fs.readFileSync(file, 'utf8')
  const findings = []

  const push = (hit, lineNo) => {
    findings.push({
      location: rel,
      field: '',
      line: lineNo,
      ...hit,
      context: contextOf(text, hit.pos, String(hit.char).length),
    })
  }

  if (file.endsWith('.json')) {
    // JSON：只掃字串字面值（含 key，CJK key 同樣值得檢查）
    const re = /"(?:[^"\\]|\\.)*"/g
    let m
    while ((m = re.exec(text)) !== null) {
      for (const hit of scanText(m[0], m.index)) {
        const lineNo = text.slice(0, hit.pos).split('\n').length
        push(hit, lineNo)
      }
    }
    return findings
  }

  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  for (const node of collectLiteralNodes(sourceFile)) {
    const start = node.getStart(sourceFile)
    for (const hit of scanText(node.getText(sourceFile), start)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(hit.pos)
      push(hit, line + 1)
    }
  }
  return findings
}

// ── DB 掃描 ────────────────────────────────────────────
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  }
}

async function scanDb() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('✗ DB 掃描需要 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY')
    process.exit(2)
  }
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const tables = [
    { name: 'products', label: '商品' },
    { name: 'product_variants', label: '商品規格' },
  ]

  const rows = []
  for (const t of tables) {
    const { data, error } = await supabase.from(t.name).select('*')
    if (error) {
      if (error.code === '42P01') continue // 表不存在
      console.error(`✗ 讀取 ${t.name} 失敗：${error.message}`)
      process.exit(2)
    }
    for (const row of data || []) {
      // 掃描所有文字欄位
      for (const [field, value] of Object.entries(row)) {
        if (typeof value !== 'string' || !value.trim()) continue
        const hits = scanText(value)
        if (hits.length === 0) continue
        rows.push({
          table: t.name,
          label: t.label,
          id: row.id,
          title: row.product_name || row.variant_name || `#${row.id}`,
          field,
          value,
          suggestion: toTW(value),
          hits,
        })
      }
    }
  }
  return rows
}

function writeDbReport(rows) {
  const dir = path.join(ROOT, 'reports')
  fs.mkdirSync(dir, { recursive: true })
  const out = [
    '# Supabase 簡體字 / 中國用語掃描報告',
    '',
    `產出時間：${new Date().toISOString()}`,
    '',
    '> ⚠️ 本報告**不會自動寫回資料庫**。「建議正體版本」為 OpenCC s2twp 產生的初稿，',
    '> 請人工確認後再於後台修改（部分商品名可能刻意保留原文）。',
    '',
  ]

  const errRows = rows.filter(r => r.hits.some(h => h.level === 'error'))
  const warnOnly = rows.filter(r => !r.hits.some(h => h.level === 'error'))

  out.push(`## 統計`, '')
  out.push(`- 有 **error（簡體專用字）** 的欄位：${errRows.length} 筆`)
  out.push(`- 僅有 warning 的欄位：${warnOnly.length} 筆`, '')

  const section = (title, list) => {
    if (list.length === 0) return
    out.push(`## ${title}`, '')
    for (const r of list) {
      const errs = r.hits.filter(h => h.level === 'error')
      const warns = r.hits.filter(h => h.level === 'warning')
      out.push(`### ${r.label} #${r.id}｜${r.title}`)
      out.push('')
      out.push(`- 欄位：\`${r.field}\``)
      if (errs.length) {
        const uniq = [...new Set(errs.map(h => `${h.char}→${h.suggest}`))]
        out.push(`- ❌ 簡體字：${uniq.join('、')}`)
      }
      if (warns.length) {
        const uniq = [...new Set(warns.map(h => (h.suggest ? `${h.char}→${h.suggest}` : h.char)))]
        out.push(`- ⚠️ 待判讀：${uniq.join('、')}`)
      }
      out.push('')
      out.push('**現況：**')
      out.push('```')
      out.push(r.value)
      out.push('```')
      out.push('**建議正體版本（初稿，請人工確認）：**')
      out.push('```')
      out.push(r.suggestion)
      out.push('```')
      out.push('')
    }
  }

  section('需要修正（含簡體專用字）', errRows)
  section('待人工判讀（僅 warning）', warnOnly)

  const file = path.join(dir, 'simplified-db.md')
  fs.writeFileSync(file, out.join('\n'), 'utf8')
  return file
}

// ── 輸出 ───────────────────────────────────────────────
function report(findings) {
  const errors = findings.filter(f => f.level === 'error')
  const warnings = findings.filter(f => f.level === 'warning')

  const print = (list, icon) => {
    for (const f of list) {
      const loc = f.field ? `${f.location} [${f.field}]` : f.location
      const sug = f.suggest ? ` → 建議「${f.suggest}」` : ''
      console.log(
        `${icon} ${loc}:${f.line}  [${f.rule}] 「${f.char}」${sug}\n     ${f.note}｜…${f.context}…`,
      )
    }
  }

  if (errors.length) {
    console.log('\n══ ❌ ERROR：簡體專用字（必須修正）══\n')
    print(errors, '  ❌')
  }
  if (warnings.length) {
    console.log('\n══ ⚠️  WARNING：需人工判讀 ══\n')
    // 依規則與字元分組，避免洗版
    const byKey = new Map()
    for (const w of warnings) {
      const k = `${w.rule}｜${w.char}`
      if (!byKey.has(k)) byKey.set(k, [])
      byKey.get(k).push(w)
    }
    for (const [k, list] of [...byKey.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const s = list[0].suggest ? ` → 建議「${list[0].suggest}」` : ''
      console.log(`  ⚠️  [${k}]${s}  共 ${list.length} 處`)
      for (const f of list.slice(0, 5)) {
        const loc = f.field ? `${f.location} [${f.field}]` : f.location
        console.log(`        ${loc}:${f.line}  …${f.context}…`)
      }
      if (list.length > 5) console.log(`        …其餘 ${list.length - 5} 處`)
    }
  }

  console.log(`\n── 統計 ──`)
  console.log(`  error   ${errors.length}`)
  console.log(`  warning ${warnings.length}`)
  return errors.length
}

// ── 主流程 ─────────────────────────────────────────────
async function main() {
  const withDb = process.argv.includes('--db')

  console.log('▶ 掃描原始碼…')
  const files = SCAN_DIRS.flatMap(d => walkFiles(path.join(ROOT, d)))
  const findings = files.flatMap(scanSourceFile)
  console.log(`  已掃描 ${files.length} 個檔案`)

  let errorCount = report(findings)

  if (withDb) {
    console.log('\n▶ 掃描 Supabase products 資料…')
    const rows = await scanDb()
    const file = writeDbReport(rows)
    const dbErrors = rows.filter(r => r.hits.some(h => h.level === 'error')).length
    console.log(`  ${rows.length} 個欄位有命中，其中 ${dbErrors} 個含簡體專用字`)
    console.log(`  報告已寫入：${path.relative(ROOT, file)}`)
    console.log('  （資料庫不會被自動修改，請人工確認後於後台套用）')
  }

  if (errorCount > 0) {
    console.log('\n✗ 發現簡體專用字，請修正後再建置。')
    process.exit(1)
  }
  console.log('\n✓ 原始碼無簡體專用字。')
}

main().catch(err => {
  console.error(err)
  process.exit(2)
})
