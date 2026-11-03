import { ClipboardList, ChevronRight } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { day } from '../../lib/format'
import { useTitle, Empty } from '../../components/ui'
import type { StudentData } from './data'
import { useView } from './ctx'

export default function Tasks({ d }: { d: StudentData }) {
  const v = useView()
  const t = useT()
  useTitle(t('tasks'))
  const rows = d.lessons
    .filter((l) => l.has_assignment && d.states[l.id]?.unlocked)
    .map((l) => {
      const sub = d.submissions.find((s) => s.lesson_id === l.id)
      const opens = d.states[l.id]?.opens_at
      const due = opens && l.assign_due_days != null ? new Date(new Date(opens).getTime() + l.assign_due_days * 86400000).toISOString() : null
      return { l, sub, due }
    })
  const todo = rows.filter((r) => !r.sub || r.sub.status === 'redo')
  const doneRows = rows.filter((r) => r.sub && r.sub.status !== 'redo')
  if (!rows.length)
    return (
      <>
        <h1 style={{ fontSize: 24 }}>{t('tasks')}</h1>
        <Empty icon={<ClipboardList size={32} />}>{t('noTasks')}</Empty>
      </>
    )
  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <a className="item noicon" href={`#${v.base}/lesson/${r.l.id}`}>
      <span style={{ minWidth: 0 }}>
        <div className="t ellipsis">{r.l.title}</div>
        <div className="s">
          {r.sub?.status === 'graded' && r.sub.marks != null ? `${t('marks')} ${r.sub.marks}${r.l.assign_max ? '/' + r.l.assign_max : ''}` : r.due ? `Due ${day(r.due)}` : d.modules.find((m) => m.id === r.l.module_id)?.title}
        </div>
      </span>
      <span className="row nowrap">
        {r.sub ? (
          <span className={'badge ' + (r.sub.status === 'graded' ? 'ok' : r.sub.status === 'redo' ? 'warn' : 'brand')}>{t(r.sub.status === 'graded' ? 'graded' : r.sub.status === 'redo' ? 'redo' : 'submitted')}</span>
        ) : r.due && r.due < new Date().toISOString() ? (
          <span className="badge bad">Late</span>
        ) : null}
        <ChevronRight size={18} className="muted" />
      </span>
    </a>
  )
  return (
    <>
      <h1 style={{ fontSize: 24 }}>{t('tasks')}</h1>
      <h2 className="h-sub">
        {t('pending')} <span>{todo.length}</span>
      </h2>
      {todo.length ? (
        <div className="list">
          {todo.map((r) => (
            <Row key={r.l.id} r={r} />
          ))}
        </div>
      ) : (
        <p className="small muted">🎉</p>
      )}
      {doneRows.length > 0 && (
        <>
          <h2 className="h-sub">
            {t('submitted')} <span>{doneRows.length}</span>
          </h2>
          <div className="list">
            {doneRows.map((r) => (
              <Row key={r.l.id} r={r} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
