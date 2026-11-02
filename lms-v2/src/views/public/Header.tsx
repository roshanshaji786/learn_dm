import { LogIn, LayoutDashboard, GraduationCap } from 'lucide-react'
import { Logo, LangToggle } from '../../components/ui'
import { useStore } from '../../lib/store'
import { useT } from '../../lib/i18n'

export function PublicHeader() {
  const t = useT()
  const session = useStore((s) => s.session)
  const isAdmin = useStore((s) => s.isAdmin)
  return (
    <header className="topbar">
      <div className="wrap">
        <Logo />
        <LangToggle />
        {session ? (
          <a className="icon-btn" href={isAdmin ? '#/admin' : '#/app'} aria-label={isAdmin ? t('admin') : t('myLearning')}>
            {isAdmin ? <LayoutDashboard size={18} /> : <GraduationCap size={18} />}
          </a>
        ) : (
          <a className="icon-btn" href="#/login">
            <LogIn size={18} />
            <span>{t('login')}</span>
          </a>
        )}
      </div>
    </header>
  )
}

export function PublicFooter() {
  const name = useStore((s) => s.settings.academy_name)
  const t = useT()
  return (
    <footer className="footer">
      <div className="wrap">
        <b style={{ color: 'var(--text)' }}>{name}</b>
        <span>Live, mentor-led courses with Roshan Shaji · Kerala, India</span>
        <span className="row" style={{ gap: 14 }}>
          <a href="https://roshanshaji.com" rel="noopener">roshanshaji.com</a>
          <a href="#/verify">{t('verify')}</a>
          <a href="#/login?as=admin">{t('admin')}</a>
          <a href="https://wa.me/917012045854" rel="noopener">WhatsApp +91 70120 45854</a>
        </span>
        <span>© {new Date().getFullYear()} DanRosh Tech Solutions</span>
      </div>
    </footer>
  )
}
