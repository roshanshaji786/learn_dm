import { ArrowLeft, Download, Pencil } from 'lucide-react'
import { supabase, errText } from '../../lib/supabase'
import { useLoad } from '../../lib/useLoad'
import { useStore } from '../../lib/store'
import { when, time, csv, download } from '../../lib/format'
import { useTitle, Skel, Empty } from '../../components/ui'
import { all, type Enrolment, type Lesson, type Profile } from './data'

export default function Attendance({ lessonId }: { lessonId: string }) {
  const say = useStore((s) => s.say)
  const { data, reload, setData } = useLoad(async () => {
    const l = (await supabase.from('lms_lessons').select('*').eq('id', lessonId).single()).data as Lesson
    const [es, att] = await Promise.all([
      all<Enrolment[]>(supabase.from('lms_enrolments').select('*').eq('course_id', l.course_id).neq('status', 'cancelled')),
      all<{ user_id: string; joined_at: string; source: string }[]>(supabase.from('lms_attendance').select('user_id,joined_at,source').eq('lesson_id', lessonId)),
    ])
    const ps = es.length ? await all<Profile[]>(supabase.from('lms_profiles').select('*').in('user_id', es.map((e) => e.user_id)).order('name')) : []
    return { l, ps, att }
  }, [lessonId])
  useTitle('Attendance')
  if (!data) return <Skel n={5} />

  async function toggle(uid: string, on: boolean) {
    const prev = data!.att
    setData({ ...data!, att: on ? [...prev, { user_id: uid, joined_at: new Date().toISOString(), source: 'manual' }] : prev.filter((a) => a.user_id !== uid) })
    const r = on
      ? await supabase.from('lms_attendance').insert({ user_id: uid, lesson_id: lessonId, source: 'manual' })
      : await supabase.from('lms_attendance').delete().eq('user_id', uid).eq('lesson_id', lessonId)
    if (r.error) {
      say(errText(r.error), true)
      await reload()
    }
  }

  const present = data.att.length
  return (
    <>
      <a className="linkish" href="#/admin">
        <ArrowLeft size={18} /> Dashboard
      </a>
      <div className="page-h">
        <h1 className="ellipsis">{data.l.title}</h1>
        <a className="icon-btn" href={`#/admin/lesson/${lessonId}`} aria-label="Edit lesson">
          <Pencil size={18} />
        </a>
      </div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        {data.l.live_start ? when(data.l.live_start) : 'No live time'} · {present} of {data.ps.length} present. Tapping Join marks students present automatically; tick anyone who joined another way.
      </p>
      {data.ps.length ? (
        <div className="list">
          {data.ps.map((p) => {
            const a = data.att.find((x) => x.user_id === p.user_id)
            return (
              <label className="att" key={p.user_id}>
                <span style={{ minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: 'block' }}>
                    {p.name}
                  </b>
                  <span className="tiny muted">{a ? (a.source === 'join' ? `Joined ${time(a.joined_at)}` : 'Marked by you') : 'Absent'}</span>
                </span>
                <input type="checkbox" checked={!!a} onChange={(e) => void toggle(p.user_id, e.target.checked)} />
              </label>
            )
          })}
        </div>
      ) : (
        <Empty>No students in this course yet.</Empty>
      )}
      <button
        className="btn btn-ghost btn-block mt16"
        onClick={() =>
          download(
            `attendance-${data.l.title.replace(/\W+/g, '-').toLowerCase()}.csv`,
            csv([['Name', 'Phone', 'Email', 'Present', 'How', 'Time'], ...data.ps.map((p) => {
              const a = data.att.find((x) => x.user_id === p.user_id)
              return [p.name, p.phone ?? '', p.email, a ? 'yes' : 'no', a?.source ?? '', a ? time(a.joined_at) : '']
            })]),
          )
        }
      >
        <Download size={16} /> Attendance CSV
      </button>
    </>
  )
}
