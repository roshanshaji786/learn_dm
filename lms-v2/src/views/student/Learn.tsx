import { Lock, CircleCheck, ChevronRight } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { when, day } from '../../lib/format'
import { useTitle, Empty } from '../../components/ui'
import type { Lesson } from '../../lib/types'
import type { StudentData } from './data'
import { useView } from './ctx'

export default function Learn({ d }: { d: StudentData }) {
  const t = useT()
  useTitle(t('learn'))
  if (!d.courses.length) return <Empty>{t('noCourse')}</Empty>
  return (
    <>
      {d.courses.map((c) => {
        const mods = d.modules.filter((m) => m.course_id === c.id)
        return (
          <section key={c.id} style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22 }}>{c.title}</h1>
            {mods.map((m, mi) => {
              const ls = d.lessons.filter((l) => l.module_id === m.id)
              return (
                <div key={m.id}>
                  <h2 className="h-sub">
                    <span className="badge brand" style={{ marginLeft: 0 }}>
                      {String(mi + 1).padStart(2, '0')}
                    </span>
                    {m.title}
                    <span>
                      {ls.filter((l) => d.states[l.id]?.completed).length}/{ls.length}
                    </span>
                  </h2>
                  {ls.length ? (
                    <div className="list">
                      {ls.map((l, i) => (
                        <LessonRow key={l.id} l={l} n={i + 1} d={d} />
                      ))}
                    </div>
                  ) : (
                    <p className="small muted">{m.summary || t('nothing')}</p>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}
    </>
  )
}

function LessonRow({ l, n, d }: { l: Lesson; n: number; d: StudentData }) {
  const v = useView()
  const t = useT()
  const s = d.states[l.id]
  const unlocked = s?.unlocked
  const sub = !unlocked
    ? s?.fee_locked
      ? t('feeDue')
      : s?.opens_at
        ? `${t('opens')} ${new Date(s.opens_at).getTime() - Date.now() < 86400000 * 6 ? when(s.opens_at) : day(s.opens_at)}`
        : t('locked')
    : l.live_start
      ? `${t('liveAt')} ${when(l.live_start)}${s?.attended ? ' · ' + t('attended') : ''}`
      : l.has_assignment
        ? t('assignment')
        : ''
  return (
    <a className="item" href={`#${v.base}/lesson/${l.id}`}>
      <span className={'ic' + (s?.completed ? ' ok' : !unlocked ? ' lock' : '')}>{s?.completed ? <CircleCheck size={20} /> : !unlocked ? <Lock size={18} /> : n}</span>
      <span style={{ minWidth: 0 }}>
        <div className="t ellipsis">{l.title}</div>
        {sub && <div className="s">{sub}</div>}
      </span>
      <ChevronRight size={18} className="muted" />
    </a>
  )
}
