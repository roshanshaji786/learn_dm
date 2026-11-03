import { Plus, BookOpen, ChevronRight } from 'lucide-react'
import { useLoad } from '../../lib/useLoad'
import { money } from '../../lib/format'
import { useTitle, Skel, Empty } from '../../components/ui'
import { loadCourseTree } from './data'

export default function Courses() {
  useTitle('Courses')
  const { data } = useLoad(() => loadCourseTree(), [])
  return (
    <>
      <div className="page-h">
        <h1>Courses</h1>
        <a className="btn btn-sm btn-primary" href="#/admin/courses/new">
          <Plus size={16} /> Course
        </a>
      </div>
      {!data ? (
        <Skel n={2} />
      ) : data.courses.length ? (
        <div className="list wide">
          {data.courses.map((c) => (
            <a className="item" key={c.id} href={`#/admin/courses/${c.id}`}>
              <span className="ic">
                <BookOpen size={20} />
              </span>
              <span style={{ minWidth: 0 }}>
                <div className="t ellipsis">{c.title}</div>
                <div className="s">
                  {money(c.fee)} · {data.modules.filter((m) => m.course_id === c.id).length} modules · {data.lessons.filter((l) => l.course_id === c.id).length} lessons
                </div>
              </span>
              <span className="row nowrap">
                {!c.published && <span className="badge">Hidden</span>}
                <ChevronRight size={18} className="muted" />
              </span>
            </a>
          ))}
        </div>
      ) : (
        <Empty>No courses yet.</Empty>
      )}
    </>
  )
}
