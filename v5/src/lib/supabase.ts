import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasBackend = Boolean(url && key)

// Signed-in client for the admin. Its own storage key, since the project is shared with another app.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { storageKey: 'learn-v5-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

// No-session client for public reads and the lead form, so an expired admin login never breaks the sales page.
export const pub = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

export type LeadStatus = 'new' | 'contacted' | 'interested' | 'joined' | 'continuing' | 'dropped' | 'lost'

export type Lead = {
  id: string
  created_at: string
  updated_at: string
  name: string
  phone: string
  city: string | null
  goal: string | null
  lang: 'en' | 'ml'
  source: string
  utm: string | null
  status: LeadStatus
  paid_499: boolean
  paid_500: boolean
  paid_999: boolean
  follow_up_on: string | null
  note: string | null
}

export type NewLead = Pick<Lead, 'name' | 'phone' | 'lang' | 'source'> & Partial<Pick<Lead, 'city' | 'goal' | 'utm'>>
