import type { ReactNode } from 'react'
import { href } from '../lib/route'

export type Tab = { to: string; label: string; icon: ReactNode; active: boolean; dot?: number }

export function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <nav className="tabbar" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }} aria-label="Main">
      {tabs.map((t) => (
        <a key={t.to} href={href(t.to)} aria-current={t.active ? 'page' : undefined}>
          {t.icon}
          <span>{t.label}</span>
          {t.dot ? <span className="dot">{t.dot}</span> : null}
        </a>
      ))}
    </nav>
  )
}
