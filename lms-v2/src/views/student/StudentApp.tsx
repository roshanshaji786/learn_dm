import { House, BookOpen, ClipboardList, User, LayoutDashboard } from 'lucide-react'
import { useStore } from '../../lib/store'
import { useT } from '../../lib/i18n'
import { useLoad } from '../../lib/useLoad'
import { Logo, LangToggle, Spinner } from '../../components/ui'
import { TabBar } from '../../components/TabBar'
import { loadStudent } from './data'
import Today from './Today'
import Learn from './Learn'
import LessonView from './LessonView'
import Tasks from './Tasks'
import Me from './Me'

export default function StudentApp({ parts }: { parts: string[] }) {
  const t = useT()
  const session = useStore((s) => s.session)!
  const isAdmin = useStore((s) => s.isAdmin)
  const { data, loading, error, reload } = useLoad(() => loadStudent(session.user.id), [session.user.id])
  const [p0, p1] = parts
  const tab = p0 === 'lesson' ? 'learn' : p0 || 'today'

  const pendingTasks = data
    ? data.lessons.filter((l) => l.has_assignment && data.states[l.id]?.unlocked && !data.submissions.some((s) => s.lesson_id === l.id && s.status !== 'redo')).length
    : 0

  let body
  if (!data) body = loading ? <Spinner /> : <p className="err">{error}</p>
  else if (p0 === 'lesson' && p1) body = <LessonView id={p1} d={data} reload={reload} />
  else if (p0 === 'learn') body = <Learn d={data} />
  else if (p0 === 'tasks') body = <Tasks d={data} />
  else if (p0 === 'me') body = <Me d={data} reload={reload} />
  else body = <Today d={data} />

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo sub={t('myLearning')} />
          <LangToggle />
          {isAdmin && (
            <a className="icon-btn" href="#/admin" aria-label="Admin">
              <LayoutDashboard size={18} />
            </a>
          )}
        </div>
      </header>
      <main className="wrap app-main narrow">{body}</main>
      <TabBar
        tabs={[
          { to: '/app', label: t('today'), icon: <House size={22} />, active: tab === 'today' },
          { to: '/app/learn', label: t('learn'), icon: <BookOpen size={22} />, active: tab === 'learn' },
          { to: '/app/tasks', label: t('tasks'), icon: <ClipboardList size={22} />, active: tab === 'tasks', dot: pendingTasks },
          { to: '/app/me', label: t('me'), icon: <User size={22} />, active: tab === 'me' },
        ]}
      />
    </>
  )
}
