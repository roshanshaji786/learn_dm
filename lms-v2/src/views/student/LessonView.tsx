import { useState, type ReactNode } from 'react'
import { ArrowLeft, Lock, Video, CalendarPlus, CircleCheck, ExternalLink, Upload, FileText, RotateCcw } from 'lucide-react'
import { supabase, errText } from '../../lib/supabase'
import { useLoad } from '../../lib/useLoad'
import { useStore } from '../../lib/store'
import { useT } from '../../lib/i18n'
import { when, embedUrl, dayYear } from '../../lib/format'
import { useTitle, Field, Spinner } from '../../components/ui'
import type { LessonContent } from '../../lib/types'
import { type StudentData, joinOpen, joinClass, gcalLink } from './data'

export function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g)
  const out: ReactNode[] = parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noopener">
        {p}
      </a>
    ) : (
      p
    ),
  )
  return <div className="prose">{out}</div>
}

export default function LessonView({ id, d, reload }: { id: string; d: StudentData; reload: () => Promise<void> }) {
  const t = useT()
  const profile = useStore((s) => s.profile)
  const say = useStore((s) => s.say)
  const l = d.lessons.find((x) => x.id === id)
  const s = d.states[id]
  useTitle(l?.title ?? t('lesson'))
  const { data: content, loading } = useLoad(async () => {
    if (!s?.unlocked) return null
    const r = await supabase.from('lms_lesson_content').select('*').eq('lesson_id', id).maybeSingle()
    return (r.data as LessonContent) ?? null
  }, [id, s?.unlocked])
  const [busy, setBusy] = useState(false)

  if (!l)
    return (
      <a className="linkish" href="#/app/learn">
        <ArrowLeft size={18} /> {t('back')}
      </a>
    )
  const mod = d.modules.find((m) => m.id === l.module_id)
  const course = d.courses.find((c) => c.id === l.course_id)
  const idx = d.lessons.findIndex((x) => x.id === id)
  const next = d.lessons[idx + 1]
  const emb = embedUrl(content?.recording_url)
  const upcoming = l.live_start && new Date(l.live_start).getTime() + l.duration_min * 60000 > Date.now()

  async function toggleDone() {
    setBusy(true)
    const r = s?.completed
      ? await supabase.from('lms_progress').delete().eq('lesson_id', id).eq('user_id', profile!.user_id)
      : await supabase.from('lms_progress').insert({ lesson_id: id, user_id: profile!.user_id })
    if (r.error) say(errText(r.error), true)
    await reload()
    setBusy(false)
  }

  return (
    <>
      <a className="linkish" href="#/app/learn">
        <ArrowLeft size={18} /> {mod?.title ?? t('back')}
      </a>
      <h1 style={{ fontSize: 24 }}>{l.title}</h1>
      <p className="small muted mt8">
        {course?.title}
        {l.live_start && ` · ${when(l.live_start)} IST`}
        {s?.attended && ` · ${t('attended')}`}
      </p>

      {!s?.unlocked ? (
        <div className="banner mt16">
          <Lock size={18} />
          <div className="grow">{s?.fee_locked ? t('overdue') : s?.opens_at ? `${t('opens')} ${when(s.opens_at)} IST` : t('locked')}</div>
        </div>
      ) : loading ? (
        <Spinner />
      ) : (
        <>
          {upcoming && (
            <div className="card mt16 stack">
              <button
                className="btn btn-wa btn-block"
                disabled={!joinOpen(l) || busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await joinClass(l.id)
                  } catch (e) {
                    say(errText(e), true)
                  }
                  setBusy(false)
                }}
              >
                <Video size={20} /> {joinOpen(l) ? t('join') : t('joinSoon')}
              </button>
              <a className="btn btn-sm btn-ghost" href={gcalLink(l, course?.title ?? '')} target="_blank" rel="noopener">
                <CalendarPlus size={16} /> {t('addCal')}
              </a>
            </div>
          )}

          <h2 className="h-sub">{t('recording')}</h2>
          {emb ? (
            <div className="video">
              <iframe src={emb} title={l.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
              <span className="wm">
                {profile?.name} · {profile?.phone || profile?.email}
              </span>
            </div>
          ) : content?.recording_url ? (
            <a className="btn btn-ghost btn-block" href={content.recording_url} target="_blank" rel="noopener">
              <ExternalLink size={18} /> {t('recording')}
            </a>
          ) : (
            <p className="small muted">{t('noRecording')}</p>
          )}

          {content?.notes && (
            <>
              <h2 className="h-sub">{t('notes')}</h2>
              <div className="card">
                <Linkify text={content.notes} />
              </div>
            </>
          )}

          {l.has_assignment && <Assignment d={d} lessonId={id} text={content?.assign_text ?? ''} max={l.assign_max} dueDays={l.assign_due_days} opensAt={s.opens_at} reload={reload} />}

          <button className={'btn btn-block mt24 ' + (s.completed ? 'btn-ghost' : 'btn-primary')} onClick={toggleDone} disabled={busy}>
            {s.completed ? (
              <>
                <CircleCheck size={18} /> {t('markedDone')}
              </>
            ) : (
              t('markDone')
            )}
          </button>
          {next && (
            <a className="btn btn-ghost btn-block mt8" href={`#/app/lesson/${next.id}`}>
              {next.title}
            </a>
          )}
        </>
      )}
    </>
  )
}

function Assignment({ d, lessonId, text, max, dueDays, opensAt, reload }: { d: StudentData; lessonId: string; text: string; max: number | null; dueDays: number | null; opensAt: string | null; reload: () => Promise<void> }) {
  const t = useT()
  const profile = useStore((s) => s.profile)!
  const say = useStore((s) => s.say)
  const sub = d.submissions.find((s) => s.lesson_id === lessonId)
  const [answer, setAnswer] = useState(sub?.answer ?? '')
  const [link, setLink] = useState(sub?.link ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const due = opensAt && dueDays != null ? new Date(new Date(opensAt).getTime() + dueDays * 86400000).toISOString() : null
  const locked = sub?.status === 'graded'

  async function openFile() {
    if (!sub?.file_path) return
    const { data, error } = await supabase.storage.from('lms-submissions').createSignedUrl(sub.file_path, 300)
    if (error) return say(errText(error), true)
    window.open(data.signedUrl, '_blank')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!answer.trim() && !link.trim() && !file && !sub?.file_path) return say('Add an answer, a link or a file', true)
    if (file && file.size > 10 * 1024 * 1024) return say('File is larger than 10 MB', true)
    setBusy(true)
    try {
      let file_path = sub?.file_path ?? null
      if (file) {
        const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-80)
        file_path = `${profile.user_id}/${lessonId}/${Date.now()}-${safe}`
        const up = await supabase.storage.from('lms-submissions').upload(file_path, file, { upsert: false, contentType: file.type || undefined })
        if (up.error) throw up.error
      }
      const row = { answer: answer.trim() || null, link: link.trim() || null, file_path }
      const r = sub
        ? await supabase.from('lms_submissions').update(row).eq('id', sub.id)
        : await supabase.from('lms_submissions').insert({ ...row, lesson_id: lessonId, user_id: profile.user_id })
      if (r.error) throw r.error
      say(t('submitted'))
      setFile(null)
      await reload()
    } catch (err) {
      say(errText(err), true)
    }
    setBusy(false)
  }

  return (
    <>
      <h2 className="h-sub">
        {t('assignment')}
        {sub && <span className={'badge ' + (sub.status === 'graded' ? 'ok' : sub.status === 'redo' ? 'warn' : 'brand')}>{t(sub.status === 'graded' ? 'graded' : sub.status === 'redo' ? 'redo' : 'submitted')}</span>}
      </h2>
      <div className="card">
        {text ? <Linkify text={text} /> : null}
        {due && <p className="small muted mt8">Due {dayYear(due)}</p>}
        {sub && (sub.status !== 'submitted' || sub.feedback) && (
          <div className="banner info mt12">
            {sub.status === 'redo' ? <RotateCcw size={18} /> : <CircleCheck size={18} />}
            <div className="grow">
              {sub.marks != null && (
                <p>
                  <b>
                    {t('marks')}: {sub.marks}
                    {max ? ` / ${max}` : ''}
                  </b>
                </p>
              )}
              {sub.feedback && (
                <p>
                  {t('feedback')}: {sub.feedback}
                </p>
              )}
            </div>
          </div>
        )}
        <form onSubmit={submit} className="mt12">
          <Field label={t('yourAnswer')}>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={locked} maxLength={10000} />
          </Field>
          <Field label={t('linkOpt')}>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} disabled={locked} placeholder="https://" />
          </Field>
          {sub?.file_path && (
            <button type="button" className="linkish" onClick={openFile}>
              <FileText size={16} /> {sub.file_path.split('/').pop()?.replace(/^\d+-/, '')}
            </button>
          )}
          {!locked && (
            <Field label={t('fileOpt')}>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.csv" />
            </Field>
          )}
          {!locked && (
            <button className="btn btn-primary btn-block" disabled={busy}>
              <Upload size={18} /> {sub ? t('resubmit') : t('submit')}
            </button>
          )}
        </form>
      </div>
    </>
  )
}
