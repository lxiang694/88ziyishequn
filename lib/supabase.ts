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
