import { CalendarDays, ChevronRight, Download, TriangleAlert, ClipboardCheck, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useLoad } from '../../lib/useLoad'
import { money, when, todayIST, day, csv, download } from '../../lib/format'
import { useTitle, Skel } from '../../components/ui'
import { all, loadRoster, paid, loadCourseTree } from './data'

export default function Dashboard() {
  useTitle('Admin')
  const { data } = useLoad(async () => {
    const [r, tree, toMark, att, prog, subs] = await Promise.all([
      loadRoster(),
      loadCourseTree(),
      supabase.from('lms_submissions').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
      all<{ user_id: string; lesson_id: string }[]>(supabase.from('lms_attendance').select('user_id,lesson_id')),
      all<{ user_id: string; lesson_id: string }[]>(supabase.from('lms_progress').select('user_id,lesson_id')),
      all<{ user_id: string; lesson_id: string; marks: number | null; status: string }[]>(supabase.from('lms_submissions').select('user_id,lesson_id,marks,status')),
    ])
    return { r, tree, toMark: toMark.count ?? 0, att, prog, subs }
  }, [])

  if (!data) return <Skel n={5} />
  const { r, tree } = data
  const active = r.enrolments.filter((e) => e.status !== 'cancelled')
  const collected = r.payments.reduce((a, p) => a + Number(p.amount), 0)
  const month = todayIST().slice(0, 7)
  const thisMonth = r.payments.filter((p) => p.paid_on.startsWith(month)).reduce((a, p) => a + Number(p.amount), 0)
  const dues = active.map((e) => ({ e, bal: Number(e.total_fee) - paid(r, e.id) })).filter((x) => x.bal > 0)
  const outstanding = dues.reduce((a, x) => a + x.bal, 0)
  const today = todayIST()
  const overdue = dues.filter((x) => x.e.due_date && x.e.due_date < today)
  const soon = dues.filter((x) => x.e.due_date && x.e.due_date >= today).sort((a, b) => (a.e.due_date! < b.e.due_date! ? -1 : 1)).slice(0, 5)
  const name = (uid: string) => r.profiles.find((p) => p.user_id === uid)?.name ?? '—'
  const now = Date.now()
  const classes = tree.lessons
    .filter((l) => l.live_start && new Date(l.live_start).getTime() + l.duration_min * 60000 > now - 86400000)
    .sort((a, b) => (a.live_start! < b.live_start! ? -1 : 1))
    .slice(0, 6)
  const recent = tree.lessons.filter((l) => l.live_start && new Date(l.live_start).getTime() < now).slice(-10).reverse()

  function gradebook() {
    const lessons = tree.lessons.filter((l) => l.published)
    const rows: (string | number)[][] = [['Name', 'Email', 'Phone', 'Course', 'Fee', 'Paid', 'Balance', 'Due date', 'Lessons done', 'Classes attended', 'Assignments marked', 'Total marks', ...lessons.map((l) => l.title)]]
    for (const e of r.enrolments) {
      const p = r.profiles.find((x) => x.user_id === e.user_id)
      const c = r.courses.find((x) => x.id === e.course_id)
      const ls = lessons.filter((l) => l.course_id === e.course_id)
      const pd = paid(r, e.id)
      const mine = data!.subs.filter((s) => s.user_id === e.user_id && ls.some((l) => l.id === s.lesson_id))
      rows.push([
        p?.name ?? '', p?.email ?? '', p?.phone ?? '', c?.title ?? '', Number(e.total_fee), pd, Number(e.total_fee) - pd, e.due_date ?? '',
        data!.prog.filter((x) => x.user_id === e.user_id && ls.some((l) => l.id === x.lesson_id)).length,
        data!.att.filter((x) => x.user_id === e.user_id && ls.some((l) => l.id === x.lesson_id)).length,
        mine.filter((s) => s.status === 'graded').length,
        mine.reduce((a, s) => a + Number(s.marks ?? 0), 0),
        ...lessons.map((l) => {
          if (l.course_id !== e.course_id) return ''
          const s = mine.find((x) => x.lesson_id === l.id)
          const done = data!.prog.some((x) => x.user_id === e.user_id && x.lesson_id === l.id)
          return s?.marks != null ? s.marks : done ? 'done' : ''
        }),
      ])
    }
    download(`gradebook-${today}.csv`, csv(rows))
  }
  function paymentsCsv() {
    const rows: (string | number)[][] = [['Receipt', 'Date', 'Name', 'Phone', 'Course', 'Amount', 'Method', 'Reference']]
    for (const p of r.payments) {
      const e = r.enrolments.find((x) => x.id === p.enrolment_id)
      const pr = r.profiles.find((x) => x.user_id === e?.user_id)
      rows.push([p.receipt_no, p.paid_on, pr?.name ?? '', pr?.phone ?? '', r.courses.find((c) => c.id === e?.course_id)?.title ?? '', Number(p.amount), p.method, p.reference ?? ''])
    }
    download(`payments-${today}.csv`, csv(rows))
  }

  return (
    <>
      <div className="page-h">
        <h1>Dashboard</h1>
        <a className="btn btn-sm btn-primary" href="#/admin/students?add=1">
          <Plus size={16} /> Student
        </a>
      </div>
      <div className="kpis">
        <div className="kpi">
          <b>{new Set(active.map((e) => e.user_id)).size}</b>
          <span>Students</span>
        </div>
        <div className="kpi">
          <b>{money(thisMonth)}</b>
          <span>Collected this month</span>
        </div>
        <div className="kpi">
          <b>{money(collected)}</b>
          <span>Collected in total</span>
        </div>
        <div className="kpi">
          <b style={{ color: outstanding ? 'var(--warn)' : undefined }}>{money(outstanding)}</b>
          <span>Fees still due</span>
        </div>
      </div>

      {data.toMark > 0 && (
        <a className="banner info mt12" href="#/admin/marking" style={{ color: 'inherit', textDecoration: 'none' }}>
          <ClipboardCheck size={18} />
          <div className="grow">
            <b>{data.toMark}</b> assignment{data.toMark > 1 ? 's' : ''} to mark
          </div>
          <ChevronRight size={18} />
        </a>
      )}

      <h2 className="h-sub">
        <CalendarDays size={18} /> Classes
      </h2>
      {classes.length ? (
        <div className="list wide">
          {classes.map((l) => (
            <a className="item noicon" key={l.id} href={`#/admin/class/${l.id}`}>
              <span style={{ minWidth: 0 }}>
                <div className="t ellipsis">{l.title}</div>
                <div className="s">{when(l.live_start)}</div>
              </span>
              <span className="badge">{data.att.filter((a) => a.lesson_id === l.id).length} joined</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="small muted">
          No upcoming classes. Set a live time on a lesson in <a href="#/admin/courses">Courses</a>.
        </p>
      )}
      {recent.length > 0 && (
        <details className="mt8">
          <summary className="linkish">Past classes and attendance</summary>
          <div className="list">
            {recent.map((l) => (
              <a className="item noicon" key={l.id} href={`#/admin/class/${l.id}`}>
                <span style={{ minWidth: 0 }}>
                  <div className="t ellipsis">{l.title}</div>
                  <div className="s">{when(l.live_start)}</div>
                </span>
                <span className="badge">{data.att.filter((a) => a.lesson_id === l.id).length} joined</span>
              </a>
            ))}
          </div>
        </details>
      )}

      {overdue.length > 0 && (
        <>
          <h2 className="h-sub" style={{ color: 'var(--bad)' }}>
            <TriangleAlert size={18} /> Overdue fees <span>{money(overdue.reduce((a, x) => a + x.bal, 0))}</span>
          </h2>
          <div className="list wide">
            {overdue.map(({ e, bal }) => (
              <a className="item noicon" key={e.id} href={`#/admin/students/${e.user_id}`}>
                <span style={{ minWidth: 0 }}>
                  <div className="t ellipsis">{name(e.user_id)}</div>
                  <div className="s">Due {day(e.due_date)} · lessons paused</div>
                </span>
                <span className="badge bad">{money(bal)}</span>
              </a>
            ))}
          </div>
        </>
      )}
      {soon.length > 0 && (
        <>
          <h2 className="h-sub">Fees due soon</h2>
          <div className="list wide">
            {soon.map(({ e, bal }) => (
              <a className="item noicon" key={e.id} href={`#/admin/students/${e.user_id}`}>
                <span style={{ minWidth: 0 }}>
                  <div className="t ellipsis">{name(e.user_id)}</div>
                  <div className="s">Due {day(e.due_date)}</div>
                </span>
                <span className="badge warn">{money(bal)}</span>
              </a>
            ))}
          </div>
        </>
      )}

      <h2 className="h-sub">Export</h2>
      <div className="row">
        <button className="btn btn-ghost" onClick={gradebook}>
          <Download size={16} /> Gradebook CSV
        </button>
        <button className="btn btn-ghost" onClick={paymentsCsv}>
          <Download size={16} /> Payments CSV
        </button>
      </div>
    </>
  )
}
