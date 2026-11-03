import { useState } from 'react'
import { Search, Plus, Users } from 'lucide-react'
import { useLoad } from '../../lib/useLoad'
import { money, todayIST, initials } from '../../lib/format'
import { parseHash } from '../../lib/route'
import { useTitle, Skel, Empty } from '../../components/ui'
import { loadRoster, paid } from './data'
import { AddStudentSheet } from './AddStudent'

export default function Students() {
  useTitle('Students')
  const { data, reload } = useLoad(loadRoster, [])
  const [q, setQ] = useState('')
  const [f, setF] = useState<'all' | 'due' | 'overdue' | 'done'>('all')
  const [adding, setAdding] = useState(() => parseHash().query.get('add') === '1')
  const today = todayIST()

  const rows = (data?.profiles ?? []).map((p) => {
    const es = data!.enrolments.filter((e) => e.user_id === p.user_id && e.status !== 'cancelled')
    const bal = es.reduce((a, e) => a + Number(e.total_fee) - paid(data!, e.id), 0)
    const over = es.some((e) => e.due_date && e.due_date < today && Number(e.total_fee) - paid(data!, e.id) > 0)
    return { p, es, bal, over, done: es.length > 0 && es.every((e) => e.status === 'completed') }
  })
  const ql = q.trim().toLowerCase()
  const shown = rows.filter(
    (r) =>
      (!ql || r.p.name.toLowerCase().includes(ql) || r.p.email.includes(ql) || (r.p.phone ?? '').includes(ql)) &&
      (f === 'all' || (f === 'due' && r.bal > 0) || (f === 'overdue' && r.over) || (f === 'done' && r.done)),
  )

  return (
    <>
      <div className="page-h">
        <h1>Students</h1>
        <span className="muted small">{data?.profiles.length ?? ''}</span>
      </div>
      <div className="row nowrap" style={{ marginBottom: 10 }}>
        <div className="search-wrap">
          <Search size={18} />
          <input className="search" placeholder="Name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </div>
      </div>
      <div className="chips">
        {(
          [
            ['all', 'All'],
            ['due', 'Fee due'],
            ['overdue', 'Overdue'],
            ['done', 'Completed'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>
            {l}
          </button>
        ))}
      </div>
      {!data ? (
        <Skel n={5} />
      ) : shown.length ? (
        <div className="list wide">
          {shown.map(({ p, es, bal, over }) => (
            <a className="item" key={p.user_id} href={`#/admin/students/${p.user_id}`}>
              <span className="ic">{initials(p.name)}</span>
              <span style={{ minWidth: 0 }}>
                <div className="t ellipsis">{p.name}</div>
                <div className="s">{es.map((e) => data.courses.find((c) => c.id === e.course_id)?.title).join(', ') || 'No course'}</div>
              </span>
              <span className="end">
                {bal > 0 ? <span className={'badge ' + (over ? 'bad' : 'warn')}>{money(bal)} due</span> : es.length ? <span className="badge ok">Paid</span> : null}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <Empty icon={<Users size={32} />}>{data.profiles.length ? 'No one matches.' : 'No students yet. Tap + to add the first one.'}</Empty>
      )}
      <button className="fab" aria-label="Add student" onClick={() => setAdding(true)}>
        <Plus size={26} />
      </button>
      {adding && data && (
        <AddStudentSheet
          courses={data.courses}
          onClose={() => setAdding(false)}
          onDone={() => {
            void reload()
          }}
        />
      )}
    </>
  )
}
