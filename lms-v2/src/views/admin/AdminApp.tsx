import { LayoutDashboard, Users, BookOpen, ClipboardCheck, MessageCircle, Settings as Gear, GraduationCap } from 'lucide-react'
import { Logo } from '../../components/ui'
import { TabBar } from '../../components/TabBar'
import Dashboard from './Dashboard'
import Students from './Students'
import StudentDetail from './StudentDetail'
import Courses from './Courses'
import CourseEdit from './CourseEdit'
import LessonEdit from './LessonEdit'
import Attendance from './Attendance'
import Marking from './Marking'
import WhatsApp from './WhatsApp'
import Settings from './Settings'
import ViewAs from './ViewAs'

export default function AdminApp({ parts }: { parts: string[] }) {
  const [p0, p1, p2] = parts
  if (p0 === 'view') return <ViewAs parts={parts.slice(1)} />
  let body
  if (p0 === 'students' && p1) body = <StudentDetail id={p1} />
  else if (p0 === 'students') body = <Students />
  else if (p0 === 'courses' && p1 === 'new') body = <CourseEdit id={null} />
  else if (p0 === 'courses' && p1) body = <CourseEdit id={p1} />
  else if (p0 === 'courses') body = <Courses />
  else if (p0 === 'lesson' && p1) body = <LessonEdit id={p1} />
  else if (p0 === 'new-lesson' && p1) body = <LessonEdit id={null} moduleId={p1} />
  else if (p0 === 'class' && p1) body = <Attendance lessonId={p1} />
  else if (p0 === 'marking') body = <Marking filter={p1} />
  else if (p0 === 'wa') body = <WhatsApp tab={p1} preset={p2} />
  else if (p0 === 'settings') body = <Settings />
  else body = <Dashboard />
  const tab = p0 === 'lesson' || p0 === 'new-lesson' ? 'courses' : p0 === 'class' || !p0 ? 'home' : p0
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo sub="Admin" />
          <a className="icon-btn" href="#/admin/view" aria-label="Student view">
            <GraduationCap size={18} />
          </a>
          <a className="icon-btn" href="#/admin/settings" aria-label="Settings">
            <Gear size={18} />
          </a>
        </div>
      </header>
      <main className="wrap app-main">{body}</main>
      <TabBar
        tabs={[
          { to: '/admin', label: 'Home', icon: <LayoutDashboard size={22} />, active: tab === 'home' },
          { to: '/admin/students', label: 'Students', icon: <Users size={22} />, active: tab === 'students' },
          { to: '/admin/courses', label: 'Courses', icon: <BookOpen size={22} />, active: tab === 'courses' },
          { to: '/admin/marking', label: 'Marking', icon: <ClipboardCheck size={22} />, active: tab === 'marking' },
          { to: '/admin/wa', label: 'WhatsApp', icon: <MessageCircle size={22} />, active: tab === 'wa' },
        ]}
      />
    </>
  )
}
