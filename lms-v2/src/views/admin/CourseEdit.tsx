import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Pencil, Trash, ChevronRight, Video, Lock, ClipboardList, ExternalLink, Eye } from 'lucide-react'
import { supabase, errText } from '../../lib/supabase'
import { useLoad } from '../../lib/useLoad'
import { useStore } from '../../lib/store'
import { go } from '../../lib/route'
import { when } from '../../lib/format'
import { useTitle, Skel, Sheet, Field } from '../../components/ui'
import { loadCourseTree, type Course, type Module } from './data'

const blank: Partial<Course> = { title: '', slug: '', subtitle: '', description: '', highlights: [], fee: 0, fee_note: '', cover_url: '/img/adm-cover.jpg', published: false, cert_enabled: true, sort: 10 }

export default function CourseEdit({ id }: { id: string | null }) {
  const say = useStore((s) => s.say)
  const { data, reload } = useLoad(async () => (id ? loadCourseTree(id) : null), [id])
  const c = data?.courses[0]
  const [f, setF] = useState<Partial<Course>>(blank)
  const [busy, setBusy] = useState(false)
  const [mod, setMod] = useState<Partial<Module> | null>(null)
  useEffect(() => {
    if (c) setF(c)
  }, [c])
  useTitle(c?.title ?? 'New course')
  if (id && !data) return <Skel n={4} />

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const row = {
      title: f.title!.trim(),
      slug: (f.slug || f.title!).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80),
      subtitle: f.subtitle || null,
      description: f.description || null,
      highlights: (f.highlights ?? []).map((h) => h.trim()).filter(Boolean),
      fee: Number(f.fee ?? 0),
      fee_note: f.fee_note || null,
      cover_url: f.cover_url || null,
      published: !!f.published,
      cert_enabled: !!f.cert_enabled,
      sort: Number(f.sort ?? 0),
    }
    const r = id ? await supabase.from('lms_courses').update(row).eq('id', id).select('id').single() : await supabase.from('lms_courses').insert(row).select('id').single()
    setBusy(false)
    if (r.error) return say(errText(r.error), true)
    say('Saved')
    if (!id) go(`/admin/courses/${r.data.id}`)
    else await reload()
  }
  async function del() {
    if (!id || !confirm('Delete this course with all its modules, lessons, enrolments and payments? This cannot be undone.')) return
    if (prompt('Type DELETE to confirm') !== 'DELETE') return
    const r = await supabase.from('lms_courses').delete().eq('id', id)
    if (r.error) return say(errText(r.error), true)
    go('/admin/courses')
  }

  return (
    <>
      <a className="linkish" href="#/admin/courses">
        <ArrowLeft size={18} /> Courses
      </a>
      <div className="page-h">
        <h1 className="ellipsis">{c?.title ?? 'New course'}</h1>
        {c && (
          <a className="icon-btn" href={`#/course/${c.slug}`} aria-label="View public page">
            <ExternalLink size={18} />
          </a>
        )}
      </div>

      {c && (
        <a className="btn btn-ghost btn-block" href={`#/admin/view/course/${c.id}`} style={{ marginBottom: 12 }}>
          <Eye size={18} /> Preview as a student
        </a>
      )}

      {c && data && (
        <>
          <h2 className="h-sub">
            Modules and lessons <span>{data.lessons.length} lessons</span>
          </h2>
          <div className="stack">
            {data.modules.map((m, i) => {
              const ls = data.lessons.filter((l) => l.module_id === m.id)
              return (
                <div className="card" key={m.id} style={{ padding: 12 }}>
                  <div className="row nowrap">
                    <span className="badge brand">{String(i + 1).padStart(2, '0')}</span>
                    <b className="grow ellipsis">{m.title}</b>
                    <button className="icon-btn plain" aria-label="Edit module" onClick={() => setMod(m)}>
                      <Pencil size={16} />
                    </button>
                  </div>
                  {ls.length > 0 && (
                    <div className="list mt8">
                      {ls.map((l) => (
                        <a className="item noicon" key={l.id} href={`#/admin/lesson/${l.id}`} style={{ minHeight: 52, padding: '8px 12px' }}>
                          <span style={{ minWidth: 0 }}>
                            <div className="t ellipsis" style={{ fontSize: 15 }}>
                              {l.title}
                            </div>
                            <div className="s">
                              {l.live_start ? (
                                <>
                                  <Video size={12} style={{ verticalAlign: -1 }} /> {when(l.live_start)}
                                </>
                              ) : (
                                'No live time'
                              )}
                              {l.unlock_mode !== 'open' && (
                                <>
                                  {' '}
                                  · <Lock size={12} style={{ verticalAlign: -1 }} /> {l.unlock_mode.replace('_', ' ')}
                                </>
                              )}
                              {l.has_assignment && (
                                <>
                                  {' '}
                                  · <ClipboardList size={12} style={{ verticalAlign: -1 }} />
                                </>
                              )}
                            </div>
                          </span>
                          <span className="row nowrap">
                            {!l.published && <span className="badge">Draft</span>}
                            <ChevronRight size={16} className="muted" />
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                  <a className="linkish" href={`#/admin/new-lesson/${m.id}`}>
                    <Plus size={16} /> Lesson
                  </a>
                </div>
              )
            })}
            <button className="btn btn-ghost" onClick={() => setMod({ course_id: c.id, title: '', summary: '', sort: (data.modules.at(-1)?.sort ?? 0) + 1 })}>
              <Plus size={16} /> Module
            </button>
          </div>
        </>
      )}

      <h2 className="h-sub">Course details</h2>
      <form onSubmit={save} className="card">
        <Field label="Title">
          <input required minLength={2} value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Web address" hint={`lms.roshanshaji.com/#/course/${f.slug || '…'}`}>
          <input value={f.slug ?? ''} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="made from the title" />
        </Field>
        <Field label="Short intro">
          <textarea value={f.subtitle ?? ''} onChange={(e) => setF({ ...f, subtitle: e.target.value })} maxLength={300} />
        </Field>
        <Field label="Description">
          <textarea value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={5000} />
        </Field>
        <Field label="Highlights (one per line)">
          <textarea value={(f.highlights ?? []).join('\n')} onChange={(e) => setF({ ...f, highlights: e.target.value.split('\n') })} />
        </Field>
        <div className="grid2">
          <Field label="Fee (₹)">
            <input type="number" min={0} value={f.fee ?? 0} onChange={(e) => setF({ ...f, fee: Number(e.target.value) })} />
          </Field>
          <Field label="Order">
            <input type="number" value={f.sort ?? 0} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Fee note">
          <input value={f.fee_note ?? ''} onChange={(e) => setF({ ...f, fee_note: e.target.value })} maxLength={200} />
        </Field>
        <Field label="Cover image URL">
          <input value={f.cover_url ?? ''} onChange={(e) => setF({ ...f, cover_url: e.target.value })} />
        </Field>
        <label className="toggle">
          Show on the website
          <input type="checkbox" checked={!!f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} />
        </label>
        <label className="toggle">
          Certificate on completion
          <input type="checkbox" checked={!!f.cert_enabled} onChange={(e) => setF({ ...f, cert_enabled: e.target.checked })} />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {id ? 'Save course' : 'Create course'}
        </button>
      </form>
      {id && (
        <button className="btn btn-danger btn-block mt16" onClick={del}>
          <Trash size={16} /> Delete course
        </button>
      )}
      {mod && <ModuleSheet m={mod} onClose={() => setMod(null)} onDone={reload} />}
    </>
  )
}

function ModuleSheet({ m, onClose, onDone }: { m: Partial<Module>; onClose: () => void; onDone: () => Promise<void> }) {
  const say = useStore((s) => s.say)
  const [f, setF] = useState(m)
  const [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const row = { course_id: f.course_id, title: f.title!.trim(), summary: f.summary || null, sort: Number(f.sort ?? 0) }
    const r = m.id ? await supabase.from('lms_modules').update(row).eq('id', m.id) : await supabase.from('lms_modules').insert(row)
    setBusy(false)
    if (r.error) return say(errText(r.error), true)
    onClose()
    await onDone()
  }
  async function del() {
    if (!confirm('Delete this module and all its lessons?')) return
    const r = await supabase.from('lms_modules').delete().eq('id', m.id!)
    if (r.error) return say(errText(r.error), true)
    onClose()
    await onDone()
  }
  return (
    <Sheet title={m.id ? 'Edit module' : 'New module'} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="Title">
          <input required value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Summary">
          <textarea value={f.summary ?? ''} onChange={(e) => setF({ ...f, summary: e.target.value })} />
        </Field>
        <Field label="Order" hint="Lower numbers come first">
          <input type="number" value={f.sort ?? 0} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy}>
          Save
        </button>
        {m.id && (
          <button type="button" className="btn btn-danger btn-block mt8" onClick={del}>
            <Trash size={16} /> Delete module
          </button>
        )}
      </form>
    </Sheet>
  )
}
