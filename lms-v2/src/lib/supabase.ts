import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasBackend = Boolean(url && key)
export const SUPABASE_URL = url ?? 'http://localhost'

// Signed-in client. Its own storage key, because the Supabase project is shared with other apps.
export const supabase = createClient(SUPABASE_URL, key ?? 'missing', {
  auth: { storageKey: 'darts-lms-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

// No-session client for public reads, so an expired login never blanks the public pages.
export const pub = createClient(SUPABASE_URL, key ?? 'missing', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'darts-lms-pub' },
})

export async function callAdmin<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data: s } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/lms-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key ?? '',
      Authorization: `Bearer ${s.session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ action, ...payload }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
  return body as T
}

export function errText(e: unknown): string {
  if (!e) return 'Something went wrong'
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  const m = (e as { message?: string }).message
  return m || 'Something went wrong'
}
