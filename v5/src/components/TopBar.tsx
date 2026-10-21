import { Moon, Sun, SunMoon } from 'lucide-react'
import { useStore, type Theme } from '../lib/store'
import { ui } from '../data/content'

const next: Record<Theme, Theme> = { system: 'dark', dark: 'light', light: 'system' }

export function TopBar({ right }: { right?: React.ReactNode }) {
  const { lang, setLang, theme, setTheme } = useStore()
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : SunMoon
  return (
    <header className="topbar">
      <div className="wrap">
        <a className="logo" href="#/">
          <img src="/icons/mark-96.png" alt="" width="30" height="30" />
          <span>{ui.brand[lang]}</span>
        </a>
        {right}
        <div className="lang-toggle" role="group" aria-label="Language">
          <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
            EN
          </button>
          <button aria-pressed={lang === 'ml'} onClick={() => setLang('ml')} lang="ml">
            മല
          </button>
        </div>
        <button className="icon-btn" onClick={() => setTheme(next[theme])} aria-label={`Theme: ${theme}`} title={`Theme: ${theme}`}>
          <Icon size={20} />
        </button>
      </div>
    </header>
  )
}
