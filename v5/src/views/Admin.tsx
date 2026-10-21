import { useEffect } from 'react'
import { BarChart3, GraduationCap, Users } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { useStore } from '../lib/store'
import { hasBackend } from '../lib/supabase'
import Leads from './admin/Leads'
import { Login } from './admin/Login'
import Stats from './admin/Stats'
import Students from './admin/Students'

const tabs = [
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
] as const

export default function Admin({ tab }: { tab: 'leads' | 'students' | 'stats' }) {
  const { isAdmin, session, checkAdmin, loadLeads, leads } = useStore()

  useEffect(() => {
    if (isAdmin && !leads.length) loadLeads()
  }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = 'Admin · DARTS AI v5'
    return () => {
      document.title = 'AI × Shopify 7-Day Starter · DARTS AI Academy'
    }
  }, [])

  let body
  if (!hasBackend) body = <p className="empty">The database isn't configured for this build.</p>
  else if (isAdmin === null) body = <div className="wrap admin-main"><div className="skel" /></div>
  else if (!session) body = <Login />
  else if (!isAdmin)
    body = (
      <div className="wrap empty">
        <p>{session.user.email} isn't an admin for this app.</p>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={async () => { const { supabase } = await import('../lib/supabase'); await supabase.auth.signOut(); checkAdmin() }}>
          Sign out
        </button>
      </div>
    )
  else
    body = (
      <>
        <main className="wrap admin-main" id="main">
          {tab === 'leads' && <Leads />}
          {tab === 'students' && <Students />}
          {tab === 'stats' && <Stats />}
        </main>
        <nav className="tabbar" aria-label="Admin">
          {tabs.map((t) => (
            <a key={t.id} href={`#admin/${t.id}`} aria-current={tab === t.id ? 'page' : undefined}>
              <t.icon size={22} />
              {t.label}
            </a>
          ))}
        </nav>
      </>
    )

  return (
    <>
      <TopBar />
      {body}
    </>
  )
}
