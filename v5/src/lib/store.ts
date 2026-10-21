import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { BATCH_START, CHECKOUT_URL, SEATS_TOTAL, WHATSAPP, type Lang } from '../data/content'
import { getPref, setPref } from './storage'
import { hasBackend, pub, supabase, type Lead } from './supabase'

export type Route = { view: 'home' } | { view: 'admin'; tab: 'leads' | 'students' | 'stats' }
export type Theme = 'system' | 'light' | 'dark'
export type Sheet = null | 'join' | 'ask' | 'login'

export function parseHash(hash = location.hash): Route {
  const h = hash.replace(/^#\/?/, '')
  if (h.startsWith('admin')) {
    const tab = h.split('/')[1]
    return { view: 'admin', tab: tab === 'students' || tab === 'stats' ? tab : 'leads' }
  }
  return { view: 'home' }
}

function initialLang(): Lang {
  const q = new URLSearchParams(location.search).get('lang')
  if (q === 'ml' || q === 'en') return q
  const saved = getPref('lang')
  return saved === 'ml' ? 'ml' : 'en'
}

export type Settings = { seatsTotal: number; seatsTaken: number; batchStart: string; checkoutUrl: string; whatsapp: string }

type State = {
  route: Route
  lang: Lang
  theme: Theme
  sheet: Sheet
  settings: Settings
  session: Session | null
  isAdmin: boolean | null
  leads: Lead[]
  leadsLoading: boolean
  leadsError: string | null
  toast: string | null
  setRoute: (r: Route) => void
  setLang: (l: Lang) => void
  setTheme: (t: Theme) => void
  openSheet: (s: Sheet) => void
  showToast: (msg: string) => void
  loadSettings: () => Promise<void>
  loadLeads: () => Promise<void>
  saveLead: (id: string, patch: Partial<Lead>) => Promise<boolean>
  addLead: (lead: Partial<Lead>) => Promise<boolean>
  deleteLead: (id: string) => Promise<boolean>
  checkAdmin: () => Promise<void>
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useStore = create<State>((set, get) => ({
  route: parseHash(),
  lang: initialLang(),
  theme: (getPref('theme') as Theme) || 'system',
  sheet: null,
  settings: { seatsTotal: SEATS_TOTAL, seatsTaken: 0, batchStart: BATCH_START, checkoutUrl: CHECKOUT_URL, whatsapp: WHATSAPP },
  session: null,
  isAdmin: null,
  leads: [],
  leadsLoading: false,
  leadsError: null,
  toast: null,

  setRoute: (route) => set({ route }),
  setLang: (lang) => {
    setPref('lang', lang)
    document.documentElement.lang = lang === 'ml' ? 'ml' : 'en'
    set({ lang })
  },
  setTheme: (theme) => {
    setPref('theme', theme === 'system' ? null : theme)
    applyTheme(theme)
    set({ theme })
  },
  openSheet: (sheet) => set({ sheet }),
  showToast: (toast) => {
    clearTimeout(toastTimer)
    set({ toast })
    toastTimer = setTimeout(() => set({ toast: null }), 3200)
  },

  loadSettings: async () => {
    if (!hasBackend) return
    const { data, error } = await pub.from('learn_settings').select('key,value')
    if (error || !data) return
    const m = Object.fromEntries(data.map((r) => [r.key, r.value]))
    const cur = get().settings
    set({
      settings: {
        seatsTotal: Number(m.seats_total) || cur.seatsTotal,
        seatsTaken: Number(m.seats_taken) || 0,
        batchStart: m.batch_start || cur.batchStart,
        checkoutUrl: m.checkout_url || cur.checkoutUrl,
        whatsapp: m.whatsapp || cur.whatsapp,
      },
    })
  },

  checkAdmin: async () => {
    const { data } = await supabase.auth.getSession()
    const session = data.session
    if (!session) return set({ session: null, isAdmin: false })
    const { data: rows, error } = await supabase.from('learn_admins').select('email').limit(1)
    set({ session, isAdmin: !error && (rows?.length ?? 0) > 0 })
  },

  loadLeads: async () => {
    set({ leadsLoading: true, leadsError: null })
    const { data, error } = await supabase
      .from('learn_leads')
      .select('id,created_at,updated_at,name,phone,city,goal,lang,source,utm,status,paid_499,paid_500,paid_999,follow_up_on,note')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) set({ leadsLoading: false, leadsError: error.message })
    else set({ leads: (data ?? []) as Lead[], leadsLoading: false })
  },

  saveLead: async (id, patch) => {
    const prev = get().leads
    set({ leads: prev.map((l) => (l.id === id ? { ...l, ...patch } : l)) })
    const { error } = await supabase.from('learn_leads').update(patch).eq('id', id)
    if (error) {
      set({ leads: prev })
      get().showToast("Couldn't save: " + error.message)
      return false
    }
    return true
  },

  addLead: async (lead) => {
    const { data, error } = await supabase.from('learn_leads').insert(lead).select().single()
    if (error) {
      get().showToast("Couldn't add: " + error.message)
      return false
    }
    set({ leads: [data as Lead, ...get().leads] })
    return true
  },

  deleteLead: async (id) => {
    const { error } = await supabase.from('learn_leads').delete().eq('id', id)
    if (error) {
      get().showToast("Couldn't delete: " + error.message)
      return false
    }
    set({ leads: get().leads.filter((l) => l.id !== id) })
    return true
  },
}))

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', dark ? '#0f0a1e' : '#ffffff')
}

export function go(hash: string) {
  if (location.hash !== hash) location.hash = hash
}
