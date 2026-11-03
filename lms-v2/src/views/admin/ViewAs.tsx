import { Eye, BookOpen, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useLoad, must } from '../../lib/useLoad'
import { useTitle, Spinner, Empty } from '../../components/ui'
import type { Course, Profile } from '../../lib/types'
import StudentApp from '../student/StudentApp'

// #/admin/view                      → pick a student or a course
// #/admin/view/course/<courseId>/…  → the course as a brand-new student sees it
// #/admin/view/<userId>/…           → exactly what that student sees
export default function ViewAs({ parts }: { parts: string[] }) {
  const [a, b] = parts
  const isCourse = a === 'course'
  const id = isCourse ? b : a
  const rest = parts.slice(isCourse ? 2 : 1)
  const { data, error } = useLoad(async () => {
    if (!id) return null
    if (isCourse) {
      const c = must(await supabase.from('lms_courses').select('*').eq('id', id).single()) as Course
      return { label: `new student · ${c.title}`, profile: { user_id: '', name: 'Student', email: 'student@example.com', phone: null, lang: 'en', must_change_password: false, note: null, created_at: '' } as Profile }
    }
    const p = must(await supabase.from('lms_profiles').select('*').eq('user_id', id).single()) as Profile
    return { label: p.name, profile: p }
  }, [id, isCourse])

  if (!id) return <Picker />
  if (error) return <p className="err wrap app-main">{error}</p>
  if (!data) return <Spinner />
  const base = isCourse ? `/admin/view/course/${id}` : `/admin/view/${id}`
  return (
    <StudentApp
      parts={rest}
      viewAs={{ mode: isCourse ? 'course' : 'admin', id, base, preview: true, profile: data.profile, label: data.label, exit: isCourse ? `/admin/courses/${id}` : `/admin/students/${id}` }}
    />
  )
}

function Picker() {
  useTitle('Student view')
  const { data } = useLoad(async () => {
    const [c, p] = await Promise.all([supabase.from('lms_courses').select('id,title').order('sort'), supabase.from('lms_profiles').select('user_id,name,phone').order('name')])
    return { courses: must(c) as Pick<Course, 'id' | 'title'>[], profiles: must(p) as Pick<Profile, 'user_id' | 'name' | 'phone'>[] }
  }, [])
  return (
    <main className="wrap app-main narrow">
      <a className="linkish" href="#/admin">
        ← Admin
      </a>
      <h1 style={{ fontSize: 24 }}>Student view</h1>
      <p className="small muted mt8">See the app exactly as a student does, without logging in as them. Nothing you tap here changes their account.</p>
      {!data ? (
        <Spinner />
      ) : (
        <>
          <h2 className="h-sub">Preview a course as a new student</h2>
          <div className="list">
            {data.courses.map((c) => (
              <a className="item" key={c.id} href={`#/admin/view/course/${c.id}`}>
                <span className="ic">
                  <BookOpen size={18} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <div className="t ellipsis">{c.title}</div>
                </span>
                <ChevronRight size={18} className="muted" />
              </a>
            ))}
          </div>
          <h2 className="h-sub">View as a student</h2>
          {data.profiles.length ? (
            <div className="list">
              {data.profiles.map((p) => (
                <a className="item" key={p.user_id} href={`#/admin/view/${p.user_id}`}>
                  <span className="ic">
                    <Eye size={18} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <div className="t ellipsis">{p.name}</div>
                    {p.phone && <div className="s">{p.phone}</div>}
                  </span>
                  <ChevronRight size={18} className="muted" />
                </a>
              ))}
            </div>
          ) : (
            <Empty>No students yet</Empty>
          )}
        </>
      )}
    </main>
  )
}
