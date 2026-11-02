import { useEffect, useState } from 'react'
import { ArrowLeft, Trash, MessageCircle, Users } from 'lucide-react'
import { supabase, errText } from '../../lib/supabase'
import { useLoad } from '../../lib/useLoad'
import { useStore } from '../../lib/store'
import { go } from '../../lib/route'
import { toLocalInput, fromLocalInput } from '../../lib/format'
import { useTitle, Skel, Field } from '../../components/ui'
import type { Lesson, LessonContent, Module, UnlockMode } from '../../lib/types'

type Form = Omit<Lesson, 'id' | 'live_start' | 'unlock_at'> & { live_start: string; unlock_at: string } & Omit<LessonContent, 'lesson_id'>

export default function LessonEdit({ id, moduleId }: { id: string | null; moduleId?: string }) {
  const say = useStore((s) => s.say)
  const { data } = useLoad(async () => {
    const l = id ? ((await supabase.from('lms_lessons').select('*').eq('id', id).single()).data as Lesson) : null
    const mid = l?.module_id ?? moduleId!
    const m = (await supabase.from('lms_modules').select('*').eq('id', mid).single()).data as Module
    const mods = ((await supabase.from('lms_modules').select('*').eq('course_id', m.course_id).order('sort')).data ?? []) as Module[]
    const content = id ? ((await supabase.from('lms_lesson_content').select('*').eq('lesson_id', id).maybeSingle()).data as LessonContent | null) : null
    const count = (await supabase.from('lms_lessons').select('id', { count: 'exact', head: true }).eq('module_id', mid)).count ?? 0
    return { l, m, mods, content, count }
  }, [id, moduleId])
  const [f, setF] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!data) return
    const { l, m, content, count } = data
    setF({
      course_id: m.course_id,
      module_id: m.id,
      title: l?.title ?? '',
      sort: l?.sort ?? count + 1,
      live_start: toLocalInput(l?.live_start),
      duration_min: l?.duration_min ?? 60,
      unlock_mode: l?.unlock_mode ?? 'open',
      unlock_at: toLocalInput(l?.unlock_at),
      unlock_days: l?.unlock_days ?? null,
      has_assignment: l?.has_assignment ?? false,
      assign_max: l?.assign_max ?? 10,
      assign_due_days: l?.assign_due_days ?? 7,
      published: l?.published ?? true,
      notes: content?.notes ?? '',
      meet_link: content?.meet_link ?? '',
      recording_url: content?.recording_url ?? '',
      assign_text: content?.assign_text ?? '',
    })
  }, [data])
  useTitle(data?.l?.title ?? 'New lesson')
  if (!data || !f) return <Skel n={5} />
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!f) return
    if (f.unlock_mode === 'before_class' && !f.live_start) return say('Set a live class time for "1 hour before class"', true)
    setBusy(true)
    const row = {
      course_id: f.course_id,
      module_id: f.module_id,
      title: f.title.trim(),
      sort: Number(f.sort),
      live_start: fromLocalInput(f.live_start),
      duration_min: Number(f.duration_min) || 60,
      unlock_mode: f.unlock_mode,
      unlock_at: f.unlock_mode === 'date' ? fromLocalInput(f.unlock_at) : null,
      unlock_days: f.unlock_mode === 'days' ? Number(f.unlock_days ?? 0) : null,
      has_assignment: f.has_assignment,
      assign_max: f.has_assignment ? Number(f.assign_max) || null : null,
      assign_due_days: f.has_assignment && f.assign_due_days !== null && String(f.assign_due_days) !== '' ? Number(f.assign_due_days) : null,
      published: f.published,
    }
    try {
      const r = id ? await supabase.from('lms_lessons').update(row).eq('id', id).select('id').single() : await supabase.from('lms_lessons').insert(row).select('id').single()
      if (r.error) throw r.error
      const c = await supabase.from('lms_lesson_content').upsert({
        lesson_id: r.data.id,
        notes: f.notes?.trim() || null,
        meet_link: f.meet_link?.trim() || null,
        recording_url: f.recording_url?.trim() || null,
        assign_text: f.assign_text?.trim() || null,
      })
      if (c.error) throw c.error
      say('Saved')
      if (!id) go(`/admin/lesson/${r.data.id}`)
    } catch (err) {
      say(errText(err), true)
    }
    setBusy(false)
  }
  async function del() {
    if (!id || !confirm('Delete this lesson? Progress, attendance and submissions for it are deleted too.')) return
    const r = await supabase.from('lms_lessons').delete().eq('id', id)
    if (r.error) return say(errText(r.error), true)
    go(`/admin/courses/${data!.m.course_id}`)
  }

  return (
    <>
      <a className="linkish" href={`#/admin/courses/${data.m.course_id}`}>
        <ArrowLeft size={18} /> {data.m.title}
      </a>
      <div className="page-h">
        <h1 className="ellipsis">{data.l?.title ?? 'New lesson'}</h1>
      </div>
      {id && (
        <div className="row" style={{ marginBottom: 12 }}>
          <a className="btn btn-sm btn-ghost grow" href={`#/admin/class/${id}`}>
            <Users size={16} /> Attendance
          </a>
          <a className="btn btn-sm btn-wa grow" href={`#/admin/wa/compose/${id}`}>
            <MessageCircle size={16} /> Send class link
          </a>
        </div>
      )}
      <form onSubmit={save}>
        <div className="card">
          <Field label="Lesson title">
            <input required value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={160} />
          </Field>
          <div className="grid2">
            <Field label="Module">
              <select value={f.module_id} onChange={(e) => set('module_id', e.target.value)}>
                {data.mods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Order">
              <input type="number" value={f.sort} onChange={(e) => set('sort', Number(e.target.value))} />
            </Field>
          </div>
          <label className="toggle">
            Visible to students
            <input type="checkbox" checked={f.published} onChange={(e) => set('published', e.target.checked)} />
          </label>
        </div>

        <h2 className="h-sub">Live class</h2>
        <div className="card">
          <div className="grid2">
            <Field label="Date and time (IST)">
              <input type="datetime-local" value={f.live_start} onChange={(e) => set('live_start', e.target.value)} />
            </Field>
            <Field label="Minutes">
              <input type="number" min={5} max={600} value={f.duration_min} onChange={(e) => set('duration_min', Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Google Meet link" hint="Students see it only through the Join button, which opens 10 minutes before class and records attendance.">
            <input type="url" value={f.meet_link ?? ''} onChange={(e) => set('meet_link', e.target.value)} placeholder="https://meet.google.com/…" />
          </Field>
          <Field label="Recording link" hint="YouTube (unlisted), Google Drive or Vimeo. Plays inside the app with the student's name watermarked.">
            <input type="url" value={f.recording_url ?? ''} onChange={(e) => set('recording_url', e.target.value)} placeholder="https://" />
          </Field>
        </div>

        <h2 className="h-sub">When it opens</h2>
        <div className="card">
          <div className="seg" style={{ marginBottom: 12 }}>
            {(
              [
                ['open', 'Right away'],
                ['before_class', '1 hr before class'],
                ['date', 'On a date'],
                ['days', 'Days after joining'],
              ] as [UnlockMode, string][]
            ).map(([k, l]) => (
              <button type="button" key={k} aria-pressed={f.unlock_mode === k} onClick={() => set('unlock_mode', k)}>
                {l}
              </button>
            ))}
          </div>
          {f.unlock_mode === 'date' && (
            <Field label="Opens on (IST)">
              <input type="datetime-local" value={f.unlock_at} onChange={(e) => set('unlock_at', e.target.value)} />
            </Field>
          )}
          {f.unlock_mode === 'days' && (
            <Field label="Days after the student joins">
              <input type="number" min={0} value={f.unlock_days ?? 0} onChange={(e) => set('unlock_days', Number(e.target.value))} />
            </Field>
          )}
          <p className="small muted">Students with an overdue fee can't open any lesson until they pay.</p>
        </div>

        <h2 className="h-sub">Notes</h2>
        <div className="card">
          <Field label="Notes, links and resources for students">
            <textarea value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} rows={6} maxLength={20000} />
          </Field>
        </div>

        <h2 className="h-sub">Assignment</h2>
        <div className="card">
          <label className="toggle">
            This lesson has an assignment
            <input type="checkbox" checked={f.has_assignment} onChange={(e) => set('has_assignment', e.target.checked)} />
          </label>
          {f.has_assignment && (
            <>
              <Field label="What to do">
                <textarea value={f.assign_text ?? ''} onChange={(e) => set('assign_text', e.target.value)} maxLength={5000} />
              </Field>
              <div className="grid2">
                <Field label="Max marks">
                  <input type="number" min={1} value={f.assign_max ?? ''} onChange={(e) => set('assign_max', Number(e.target.value))} />
                </Field>
                <Field label="Due (days after it opens)">
                  <input type="number" min={0} value={f.assign_due_days ?? ''} onChange={(e) => set('assign_due_days', Number(e.target.value))} />
                </Field>
              </div>
            </>
          )}
        </div>

        <button className="btn btn-primary btn-block mt16" disabled={busy}>
          {id ? 'Save lesson' : 'Create lesson'}
        </button>
      </form>
      {id && (
        <button className="btn btn-danger btn-block mt8" onClick={del}>
          <Trash size={16} /> Delete lesson
        </button>
      )}
    </>
  )
}
