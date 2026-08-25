/**
 * 測試專用的模組解析 hook（零相依）。
 *
 * 應用程式碼沿用 Next.js 慣例：相對匯入不寫副檔名，並使用 '@/' 別名。
 * Node 的 ESM 解析器兩者都不認得，因此在測試時補上，
 * 讓 node:test 能直接跑 .ts 原始碼，不必為了測試改動應用程式碼。
 */
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

const ROOT = resolvePath(fileURLToPath(import.meta.url), '../..')
const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.js', '.mjs']

function firstExisting(base) {
  if (existsSync(base) && !existsSync(base + '.ts')) {
    // 已經是實際檔案（含副檔名）
    if (/\.[cm]?[jt]sx?$/.test(base)) return base
  }
  for (const ext of CANDIDATES) {
    const p = base + ext
    if (existsSync(p)) return p
  }
  return null
}

export async function resolve(specifier, context, next) {
  // '@/lib/care/domain' → <root>/lib/care/domain.ts
  if (specifier.startsWith('@/')) {
    const hit = firstExisting(resolvePath(ROOT, specifier.slice(2)))
    if (hit) return next(pathToFileURL(hit).href, context)
  }

  // './domain' → <dir>/domain.ts
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const parentPath = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : ROOT
    const hit = firstExisting(resolvePath(parentPath, specifier))
    if (hit) return next(pathToFileURL(hit).href, context)
  }

  return next(specifier, context)
}
