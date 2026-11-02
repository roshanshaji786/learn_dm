import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase, pub, hasBackend } from './supabase'
import type { Profile, Settings } from './types'

export type Lang = 'en' | 'ml'
export type Theme = 'system' | 'light' | 'dark'

type Toast = { text: string; bad?: boolean; id: number } | null

type State = {
  ready: boolean
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  settings: Settings
  lang: Lang
  theme: Theme
  toast: Toast
  setLang: (l: Lang) => void
  setTheme: (t: Theme) => void
  say: (text: string, bad?: boolean) => void
  loadProfile: () => Promise<void>
  signOut: () => Promise<void>
}

function readLS(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function writeLS(k: string, v: string) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* private mode */
  }
}

const urlLang = new URLSearchParams(location.search).get('lang')
const initialLang: Lang = urlLang === 'ml' || (!urlLang && readLS('lms-lang') === 'ml') ? 'ml' : 'en'
const initialTheme = (readLS('lms-theme') as Theme) || 'system'

export const useStore = create<State>((set, get) => ({
  ready: !hasBackend,
  session: null,
  profile: null,
  isAdmin: false,
  settings: { academy_name: 'Darts AI Academy', whatsapp: '917012045854', upi_id: '7012045854@apl' },
  lang: initialLang,
  theme: initialTheme,
  toast: null,
  setLang: (lang) => {
    writeLS('lms-lang', lang)
    document.documentElement.lang = lang
    set({ lang })
    const p = get().profile
    if (p && p.lang !== lang) void supabase.from('lms_profiles').update({ lang }).eq('user_id', p.user_id)
  },
  setTheme: (theme) => {
    writeLS('lms-theme', theme)
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    set({ theme })
  },
  say: (text, bad) => {
    const id = Date.now()
    set({ toast: { text, bad, id } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 3200)
  },
  loadProfile: async () => {
    const s = get().session
    if (!s) return set({ profile: null, isAdmin: false })
    const isAdmin = s.user.app_metadata?.lms_admin === true
    const { data } = await supabase.from('lms_profiles').select('*').eq('user_id', s.user.id).maybeSingle()
    set({ profile: (data as Profile) ?? null, isAdmin })
  },
  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null, isAdmin: false })
  },
}))

document.documentElement.lang = initialLang

export async function initStore() {
  if (!hasBackend) return
  const { data } = await supabase.auth.getSession()
  useStore.setState({ session: data.session })
  await useStore.getState().loadProfile()
  useStore.setState({ ready: true })
  supabase.auth.onAuthStateChange((_e, session) => {
    const prev = useStore.getState().session
    useStore.setState({ session })
    if (prev?.user.id !== session?.user.id) void useStore.getState().loadProfile()
  })
  const { data: rows } = await pub.from('lms_settings').select('key,value')
  if (rows) useStore.setState({ settings: { ...useStore.getState().settings, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) } })
}
