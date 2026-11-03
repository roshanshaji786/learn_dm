import { useEffect, useState } from 'react'
import { Video, CalendarPlus, TriangleAlert, KeyRound, ChevronRight, MessageCircle, IndianRupee, CirclePlay } from 'lucide-react'
import { useStore } from '../../lib/store'
import { useT } from '../../lib/i18n'
import { money, when, day, waLink, todayIST } from '../../lib/format'
import { errText } from '../../lib/supabase'
import { useTitle, Empty } from '../../components/ui'
import { type StudentData, nextLive, joinOpen, gcalLink, joinClass, paidFor, upiLink } from './data'
import { useView, PREVIEW_MSG } from './ctx'

function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setN(Date.now()), ms)
    return () => clearInterval(i)
  }, [ms])
  return n
}

export default function Today({ d }: { d: StudentData }) {
  const t = useT()
  useTitle(t('today'))
  const v = useView()
  const profile = v.profile
  const settings = useStore((s) => s.settings)
  const say = useStore((s) => s.say)
  const now = useNow()
  const [joining, setJoining] = useState(false)

  if (!d.enrolments.length)
    return (
      <>
        <h1 style={{ fontSize: 24 }}>
          {t('hi')} {profile?.name?.split(' ')[0] ?? ''} 👋
        </h1>
        <Empty>{t('noCourse')}</Empty>
        <a className="btn btn-wa btn-block" href={waLink(settings.whatsapp, 'Hi Roshan, I want to enrol.')} target="_blank" rel="noopener">
          <MessageCircle size={18} /> {t('help')}
        </a>
      </>
    )

  const live = nextLive(d.lessons)
  const liveCourse = live ? d.courses.find((c) => c.id === live.course_id) : undefined
  const open = live ? joinOpen(live) : false
  const st = live ? d.states[live.id] : undefined
  const left = live ? Math.max(0, new Date(live.live_start!).getTime() - now) : 0
  const cd = [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60]

  const cont = d.lessons.find((l) => d.states[l.id]?.unlocked && !d.states[l.id]?.completed)

  async function join() {
    if (!live) return
    if (v.preview) return say(PREVIEW_MSG)
    setJoining(true)
    try {
      await joinClass(live.id)
    } catch (e) {
      say(errText(e), true)
    }
    setJoining(false)
  }

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 14 }}>
        {t('hi')} {profile?.name?.split(' ')[0] ?? ''} 👋
      </h1>

      {profile?.must_change_password && (
        <a className="banner" href={'#' + v.base + '/me'} style={{ color: 'inherit', textDecoration: 'none' }}>
          <KeyRound size={18} />
          <div className="grow">{t('mustChange')}</div>
          <ChevronRight size={18} />
        </a>
      )}

      {d.enrolments.map((e) => {
        const c = d.courses.find((x) => x.id === e.course_id)
        const bal = Number(e.total_fee) - paidFor(d, e.id)
        if (bal <= 0 || !c) return null
        const over = e.due_date && e.due_date < todayIST()
        return (
          <div className={'banner' + (over ? ' bad' : '')} key={e.id}>
            {over ? <TriangleAlert size={18} /> : <IndianRupee size={18} />}
            <div className="grow">
              <p>
                <b>
                  {t('feeDue')}: {money(bal)}
                </b>
                {e.due_date && (
                  <>
                    {' '}
                    · {t('dueBy')} {day(e.due_date)}
                  </>
                )}
              </p>
              {over && <p>{t('overdue')}</p>}
              <div className="row">
                <a className="btn btn-sm btn-primary" href={upiLink(settings.upi_id, bal, settings.academy_name, c.title)}>
                  {t('payUpi')}
                </a>
                <a className="btn btn-sm btn-ghost" href={waLink(settings.whatsapp, `Hi Roshan, I paid for ${c.title}. Sending the screenshot.`)} target="_blank" rel="noopener">
                  {t('sendProof')}
                </a>
              </div>
              <p className="tiny muted">UPI: {settings.upi_id}</p>
            </div>
          </div>
        )
      })}

      <div className="next-class">
        <p className="k">{t('nextClass')}</p>
        {live ? (
          <>
            <div>
              <h2>{live.title}</h2>
              <p className="when">
                {when(live.live_start)} IST · {live.duration_min} min{liveCourse ? ` · ${liveCourse.title}` : ''}
              </p>
            </div>
            {!open && (
              <div className="count" aria-label="Time to class">
                {(['days', 'hrs', 'min', 'sec'] as const).map((u, i) => (
                  <div key={u}>
                    <b>{String(cd[i]).padStart(2, '0')}</b>
                    <small>{u}</small>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-wa btn-block" onClick={join} disabled={(!open && !v.preview) || joining || st?.fee_locked}>
              <Video size={20} />
              {open ? t('join') : t('joinSoon')}
            </button>
            <div className="row">
              <a className="btn btn-sm btn-ghost grow" href={gcalLink(live, liveCourse?.title ?? '')} target="_blank" rel="noopener">
                <CalendarPlus size={16} /> {t('addCal')}
              </a>
              <a className="btn btn-sm btn-ghost grow" href={`#${v.base}/lesson/${live.id}`}>
                {t('lesson')} <ChevronRight size={16} />
              </a>
            </div>
          </>
        ) : (
          <p className="when">{t('noClass')}</p>
        )}
      </div>

      <h2 className="h-sub">{t('progress')}</h2>
      <div className="list">
        {d.courses.map((c) => {
          const ls = d.lessons.filter((l) => l.course_id === c.id)
          const done = ls.filter((l) => d.states[l.id]?.completed).length
          const pct = ls.length ? Math.round((done / ls.length) * 100) : 0
          return (
            <a className="card" key={c.id} href={'#' + v.base + '/learn'} style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="row nowrap">
                <b className="grow ellipsis">{c.title}</b>
                <span className="badge brand">{pct}%</span>
              </div>
              <div className="bar mt8">
                <i style={{ width: pct + '%' }} />
              </div>
              <p className="small muted mt8">
                {done} / {ls.length} {t('lessonsDone')}
              </p>
            </a>
          )
        })}
      </div>

      {cont && (
        <>
          <h2 className="h-sub">{t('continueL')}</h2>
          <a className="item" href={`#${v.base}/lesson/${cont.id}`}>
            <span className="ic">
              <CirclePlay size={20} />
            </span>
            <span style={{ minWidth: 0 }}>
              <div className="t ellipsis">{cont.title}</div>
              <div className="s">{d.modules.find((m) => m.id === cont.module_id)?.title}</div>
            </span>
            <ChevronRight size={18} className="muted" />
          </a>
        </>
      )}
    </>
  )
}
