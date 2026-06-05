'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  /** Convenience helper for authed fetch calls — adds Bearer token automatically */
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let subscription: { unsubscribe: () => void } | null = null

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(data.session)
        setUser(data.session?.user ?? null)
      } catch (err) {
        console.warn('[Auth] getSession failed:', err)
        if (mounted) {
          setSession(null)
          setUser(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }

      try {
        const result = supabase.auth.onAuthStateChange((_event, newSession) => {
          try {
            if (!mounted) return
            setSession(newSession)
            setUser(newSession?.user ?? null)
          } catch (err) {
            console.warn('[Auth] state change handler error:', err)
          }
        })
        subscription = result.data.subscription
      } catch (err) {
        console.warn('[Auth] onAuthStateChange failed:', err)
      }
    }

    init()

    return () => {
      mounted = false
      try { subscription?.unsubscribe() } catch {}
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  const refresh = async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    setUser(data.session?.user ?? null)
  }

  const authedFetch = async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const headers = new Headers(init.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...init, headers })
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, refresh, authedFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useUserAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useUserAuth must be used within UserAuthProvider')
  return ctx
}

/** Hook that redirects to /login if user is not authenticated. */
export function useRequireUser() {
  const { user, loading } = useUserAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])
  return { user, loading }
}
