import { useEffect, type ReactNode } from 'react'
import { X, Sun, Moon, Monitor } from 'lucide-react'
import { useStore, type Theme } from '../lib/store'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', k)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn plain" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}

export function Toast() {
  const t = useStore((s) => s.toast)
  if (!t) return null
  return (
    <div className={'toast' + (t.bad ? ' bad' : '')} role="status">
      {t.text}
    </div>
  )
}

export function Empty({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <p>{children}</p>
    </div>
  )
}

export function Skel({ n = 3 }: { n?: number }) {
  return (
    <div className="list">
      {Array.from({ length: n }, (_, i) => (
        <div className="skel" key={i} />
      ))}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function ThemeSeg() {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const opts: [Theme, string, ReactNode][] = [
    ['system', 'Auto', <Monitor size={16} key="m" />],
    ['light', 'Light', <Sun size={16} key="s" />],
    ['dark', 'Dark', <Moon size={16} key="d" />],
  ]
  return (
    <div className="seg" role="group" aria-label="Theme">
      {opts.map(([v, l, ic]) => (
        <button key={v} aria-pressed={theme === v} onClick={() => setTheme(v)} className="row nowrap" style={{ gap: 6 }}>
          {ic}
          {l}
        </button>
      ))}
    </div>
  )
}

export function LangToggle() {
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
        EN
      </button>
      <button aria-pressed={lang === 'ml'} onClick={() => setLang('ml')} lang="ml">
        മല
      </button>
    </div>
  )
}

export function Logo({ sub }: { sub?: string }) {
  const name = useStore((s) => s.settings.academy_name)
  return (
    <a className="logo" href="#/">
      <img src="/icons/mark-96.png" alt="" width={32} height={32} />
      <span>
        {name}
        {sub && <small>{sub}</small>}
      </span>
    </a>
  )
}

export function Spinner() {
  return <div className="spin" role="status" aria-label="Loading" />
}

export function useTitle(t: string) {
  useEffect(() => {
    document.title = t ? `${t} · Darts AI Academy` : 'Darts AI Academy · Learn'
  }, [t])
}
