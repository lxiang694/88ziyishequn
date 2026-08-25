#!/usr/bin/env node
/**
 * 陪診品牌前台驗收檢查（Sprint A）
 *
 * 這個專案沒有安裝任何測試框架（package.json 無 test script，
 * 也沒有 jest／vitest 相依），因此驗收以靜態檢查腳本實作，
 * 與既有的 scripts/check-simplified.mjs 同一套做法：純 node、零相依、可進 CI。
 *
 * 檢查項目：
 *  1. /care 使用 CareSiteShell，而非商城的 FrontShell
 *  2. /care 的 Header/Footer 與頁面不含購物車、商品／保健品等商城元素
 *  3. 舊陪診路由已設定導向，且不會循環、不會導向外部網址
 *  4. 手機行動列只掛在陪診外殼上，不會出現在商城
 *  5. 七條 /care 路由都存在，且每頁都有自己的 metadata
 *  6. 品牌名稱只定義一次（集中在 lib/careBrand.ts）
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CARE_APP = 'app/(care)'
const CARE_COMPONENTS = 'components/care'
const BRAND_FILE = 'lib/careBrand.ts'

let failures = 0
let passes = 0

function ok(msg) { passes++; console.log(`  ✓ ${msg}`) }
function fail(msg, detail) {
  failures++
  console.log(`  ✗ ${msg}`)
  if (detail) console.log(`      ${detail}`)
}

function read(p) {
  const full = join(ROOT, p)
  return existsSync(full) ? readFileSync(full, 'utf8') : null
}

/**
 * 移除註解後再比對。
 * 註解會說明「這裡不可以出現購物車」之類的規則，本身不是違規內容；
 * 若不剝掉會把說明文字誤判成殘留的商城元素。
 */
function stripComments(src) {
  return src
    // 區塊註解，含 JSX 的 {/* ... */}
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // 行註解；(?<!:) 避免砍掉 https:// 之類的網址
    .replace(/(?<!:)\/\/.*$/gm, '')
}

function walk(dir, out = []) {
  const full = join(ROOT, dir)
  if (!existsSync(full)) return out
  for (const name of readdirSync(full)) {
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(rel)
  }
  return out
}

// ── 1. 外殼 ────────────────────────────────────────────────
console.log('\n1. 陪診前台使用專屬外殼')
{
  const layout = read(`${CARE_APP}/layout.tsx`)
  if (!layout) {
    fail(`${CARE_APP}/layout.tsx 不存在`)
  } else {
    if (layout.includes('CareSiteShell')) ok('(care) layout 使用 CareSiteShell')
    else fail('(care) layout 未使用 CareSiteShell')

    if (!stripComments(layout).includes('FrontShell')) ok('(care) layout 未載入商城的 FrontShell')
    else fail('(care) layout 仍載入 FrontShell', '陪診前台不可繼承商城外殼')
  }

  // 舊的 /care 必須已移除，否則 Next.js 會出現重複路由
  if (!existsSync(join(ROOT, 'app/(front)/care'))) ok('舊的 app/(front)/care 已移除，無路由衝突')
  else fail('app/(front)/care 仍存在', '會與 app/(care)/care 產生路由衝突')
}

// ── 2. 商城元素殘留 ────────────────────────────────────────
console.log('\n2. 陪診前台不得殘留商城元素')
{
  // 只比對「使用者看得到的商城語彙」與「商城元件／路由的實際引用」。
  const BANNED = [
    { pattern: /加入購物車/, label: '加入購物車' },
    { pattern: /立即購買/, label: '立即購買' },
    { pattern: /會員價/, label: '會員價' },
    { pattern: /團購/, label: '團購' },
    { pattern: /保健品/, label: '保健品' },
    { pattern: /睡眠自測/, label: '睡眠自測' },
    { pattern: /健康自測/, label: '健康自測' },
    { pattern: /購物車/, label: '購物車' },
    { pattern: /CartContext|CartProvider|CartFloatButton|MobileBottomNav/, label: '商城購物車／導覽元件' },
    { pattern: /components\/front\//, label: '商城 components/front 元件' },
    { pattern: /href=["'`]\/(products|cart|checkout|sleep-quiz|health-quiz)/, label: '商城路由連結' },
  ]

  const files = [...walk(CARE_APP), ...walk(CARE_COMPONENTS)]
  if (files.length === 0) fail('找不到任何陪診前台檔案')

  let hits = 0
  for (const f of files) {
    const raw = read(f)
    if (!raw) continue
    const src = stripComments(raw)
    for (const b of BANNED) {
      if (b.pattern.test(src)) {
        const line = src.split('\n').findIndex(l => b.pattern.test(l)) + 1
        fail(`${f}:${line} 出現商城元素「${b.label}」`)
        hits++
      }
    }
  }
  if (hits === 0) ok(`${files.length} 個陪診前台檔案皆無商城導覽或商城文案`)
}

// ── 3. 舊路由導向 ──────────────────────────────────────────
console.log('\n3. 舊陪診路由導向')
{
  const cfg = read('next.config.js')
  if (!cfg) {
    fail('next.config.js 不存在')
  } else {
    const expected = [
      ['/services/medical-companion', '/care'],
      ['/request/medical-companion', '/care/assessment'],
    ]
    for (const [source, destination] of expected) {
      const re = new RegExp(`source:\\s*['"\`]${source}['"\`][^}]*destination:\\s*['"\`]${destination}['"\`]`)
      if (re.test(cfg)) ok(`${source} → ${destination}`)
      else fail(`缺少導向 ${source} → ${destination}`)

      // 循環檢查：來源與目的地不可相同，且目的地不可是來源的前綴關係
      if (source === destination) fail(`${source} 導向自己，會造成循環 redirect`)
    }

    // 目的地必須是站內相對路徑，不可含 http(s) 或協定相對網址
    const dests = [...cfg.matchAll(/destination:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
    const external = dests.filter(d => /^(https?:)?\/\//.test(d))
    if (external.length === 0) ok('所有 redirect 目的地皆為站內路徑，不會導向外部網址')
    else fail('redirect 目的地含外部網址', external.join(', '))

    // 目的地本身不能又是另一條 redirect 的來源（多跳→潛在循環）
    const sources = [...cfg.matchAll(/source:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
    const chained = dests.filter(d => sources.includes(d))
    if (chained.length === 0) ok('沒有 redirect 目的地又是另一條的來源，不會鏈式循環')
    else fail('redirect 形成鏈式跳轉', chained.join(', '))
  }
}

// ── 4. 手機行動列只在 /care ────────────────────────────────
console.log('\n4. 手機行動列僅出現在陪診前台')
{
  const shell = read(`${CARE_COMPONENTS}/CareSiteShell.tsx`)
  if (shell && shell.includes('CareMobileCTA')) ok('CareSiteShell 掛載 CareMobileCTA')
  else fail('CareSiteShell 未掛載 CareMobileCTA')

  // 商城端不得引用陪診的行動列
  const frontFiles = [...walk('app/(front)'), ...walk('components/front')]
  const leaked = frontFiles.filter(f => stripComments(read(f) || '').includes('CareMobileCTA'))
  if (leaked.length === 0) ok('商城端未引用 CareMobileCTA')
  else fail('商城端引用了陪診行動列', leaked.join(', '))

  // 商城端只保留一個陪診入口
  const entries = frontFiles.filter(f => /href=["'`]\/care/.test(stripComments(read(f) || '')))
  if (entries.length <= 1) ok(`商城端保留 ${entries.length} 個陪診入口`)
  else fail(`商城端有 ${entries.length} 個陪診入口，應只保留一個`, entries.join(', '))
}

// ── 5. 路由與 metadata ─────────────────────────────────────
console.log('\n5. 路由與 SEO metadata')
{
  const ROUTES = ['', '/assessment', '/services', '/process', '/safety', '/faq', '/account']
  const titles = new Set()
  for (const r of ROUTES) {
    const p = `${CARE_APP}/care${r}/page.tsx`
    const src = read(p)
    if (!src) { fail(`路由 /care${r} 缺少 ${p}`); continue }
    if (!/export const metadata/.test(src)) {
      fail(`/care${r} 未定義 metadata`)
      continue
    }
    const m = src.match(/title:\s*[`'"]([^`'"]+)/)
    const title = m ? m[1] : ''
    if (title && titles.has(title)) fail(`/care${r} 的 title 與其他頁重複`, title)
    else { titles.add(title); ok(`/care${r} 存在且有獨立 metadata`) }
  }
}

// ── 6. 品牌名稱集中管理 ────────────────────────────────────
console.log('\n6. 品牌名稱只定義一次')
{
  const brand = read(BRAND_FILE)
  if (!brand) {
    fail(`${BRAND_FILE} 不存在`)
  } else {
    const m = brand.match(/name:\s*['"`]([^'"`]+)['"`]/)
    const name = m ? m[1] : ''
    if (!name) {
      fail('careBrand.name 未定義')
    } else {
      const others = [...walk(CARE_APP), ...walk(CARE_COMPONENTS)]
        .filter(f => stripComments(read(f) || '').includes(name))
      if (others.length === 0) ok(`品牌名稱「${name}」只定義於 ${BRAND_FILE}，頁面皆從設定匯入`)
      else fail('有頁面寫死品牌名稱', others.join(', '))
    }
  }
}

// ── 結果 ───────────────────────────────────────────────────
console.log(`\n── 結果 ──\n  通過 ${passes}\n  失敗 ${failures}\n`)
if (failures > 0) {
  console.log('✗ 陪診品牌前台檢查未通過\n')
  process.exit(1)
}
console.log('✓ 陪診品牌前台檢查全部通過\n')
