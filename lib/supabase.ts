import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// SERVICE_ROLE_KEY is server-only; will be undefined on client.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Client for front-end (anon key) — safe on both server and client.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client — ONLY initialized when service role key is present (i.e. on the server).
// On client this stays null; any accidental usage will throw clearly instead of crashing
// at module load time when a client component imports this file.
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    })
  : (null as unknown as ReturnType<typeof createClient>)

/**
 * 前台頁面專用的唯讀用戶端：查詢結果快取 60 秒。
 *
 * 跟 supabaseAdmin 用同一把金鑰，差別只在快取。supabaseAdmin 的每個查詢都帶
 * cache: 'no-store'（後台要即時資料），用它的頁面會被 Next 當成「每次都重新產生」，
 * 每個訪客都要等一次資料庫來回。首頁、賣場、商品頁改用這個，查詢會快取起來，
 * 頁面也就能每 60 秒才重新產生一次。後台改資料時 refreshStorefront() 會讓快取
 * 立刻失效（lib/storefrontCache.ts）。
 *
 * 只能拿來讀。寫入（訂單、瀏覽數）一律用 supabaseAdmin。
 */
export const STOREFRONT_REVALIDATE_SECONDS = 60
export const supabaseStorefront = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, next: { revalidate: STOREFRONT_REVALIDATE_SECONDS } } as RequestInit),
      },
    })
  : (null as unknown as ReturnType<typeof createClient>)
