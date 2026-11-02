import { useState } from 'react'
import { ClipboardCheck, FileText, ExternalLink } from 'lucide-react'
import { supabase, errText } from '../../lib/supabase'
import { useLoad } from '../../lib/useLoad'
import { useStore } from '../../lib/store'
import { go } from '../../lib/route'
import { when } from '../../lib/format'
import { useTitle, Skel, Empty, Sheet, Field } from '../../components/ui'
import { Linkify } from '../student/LessonView'
import { all, type Lesson, type Profile, type Submission } from './data'

export default function Marking({ filter }: { filter?: string }) {
  useTitle('Marking')
  const f = filter === 'all' ? 'all' : 'todo'
  const { data, reload } = useLoad(async () => {
    const subs = await all<Submission[]>(supabase.from('lms_submissions').select('*').order('submitted_at', { ascending: false }).limit(500))
    const [ps, ls] = await Promise.all([
      all<Profile[]>(supabase.from('lms_profiles').select('user_id,name,phone,email')),
      all<Lesson[]>(supabase.from('lms_lessons').select('id,title,assign_max,course_id')),
    ])
    return { subs, ps, ls }
  }, [])
  const [open, setOpen] = useState<Submission | null>(null)
  const shown = (data?.subs ?? []).filter((s) => f === 'all' || s.status === 'submitted')
  return (
    <>
      <div className="page-h">
        <h1>Marking</h1>
      </div>
      <div className="chips">
        <button aria-pressed={f === 'todo'} onClick={() => go('/admin/marking')}>
          To mark {data ? `(${data.subs.filter((s) => s.status === 'submitted').length})` : ''}
        </button>
        <button aria-pressed={f === 'all'} onClick={() => go('/admin/marking/all')}>
          All
        </button>
      </div>
      {!data ? (
        <Skel n={4} />
      ) : shown.length ? (
        <div className="list wide">
          {shown.map((s) => (
            <button className="item noicon" key={s.id} onClick={() => setOpen(s)}>
              <span style={{ minWidth: 0 }}>
                <div className="t ellipsis">{data.ps.find((p) => p.user_id === s.user_id)?.name}</div>
                <div className="s">
                  {data.ls.find((l) => l.id === s.lesson_id)?.title} · {when(s.submitted_at)}
                </div>
              </span>
              <span className={'badge ' + (s.status === 'graded' ? 'ok' : s.status === 'redo' ? 'warn' : 'brand')}>{s.status === 'graded' ? `${s.marks ?? '—'}` : s.status === 'redo' ? 'Redo' : 'New'}</span>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon={<ClipboardCheck size={32} />}>{f === 'todo' ? 'All marked. Nice.' : 'No submissions yet.'}</Empty>
      )}
      {open && data && (
        <MarkSheet
          s={open}
          p={data.ps.find((p) => p.user_id === open.user_id)}
          l={data.ls.find((l) => l.id === open.lesson_id)}
          onClose={() => setOpen(null)}
          onDone={reload}
        />
      )}
    </>
  )
}

function MarkSheet({ s, p, l, onClose, onDone }: { s: Submission; p?: Profile; l?: Lesson; onClose: () => void; onDone: () => Promise<void> }) {
  const say = useStore((x) => x.say)
  const [marks, setMarks] = useState(s.marks != null ? String(s.marks) : '')
  const [fb, setFb] = useState(s.feedback ?? '')
  const [busy, setBusy] = useState(false)
  async function save(status: 'graded' | 'redo') {
    setBusy(true)
    const r = await supabase
      .from('lms_submissions')
      .update({ status, marks: marks === '' ? null : Number(marks), feedback: fb.trim() || null, graded_at: new Date().toISOString() })
      .eq('id', s.id)
    setBusy(false)
    if (r.error) return say(errText(r.error), true)
    say(status === 'graded' ? 'Marked' : 'Sent back for redo')
    onClose()
    await onDone()
  }
  async function file() {
    const { data, error } = await supabase.storage.from('lms-submissions').createSignedUrl(s.file_path!, 600)
    if (error) return say(errText(error), true)
    window.open(data.signedUrl, '_blank')
  }
  return (
    <Sheet title={p?.name ?? 'Submission'} onClose={onClose}>
      <p className="small muted" style={{ marginBottom: 10 }}>
        {l?.title} · {when(s.submitted_at)}
      </p>
      {s.answer && (
        <div className="card" style={{ marginBottom: 10 }}>
          <Linkify text={s.answer} />
        </div>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        {s.link && (
          <a className="btn btn-sm btn-ghost grow" href={s.link} target="_blank" rel="noopener">
            <ExternalLink size={16} /> Open link
          </a>
        )}
        {s.file_path && (
          <button className="btn btn-sm btn-ghost grow" onClick={file}>
            <FileText size={16} /> Open file
          </button>
        )}
      </div>
      <Field label={`Marks${l?.assign_max ? ` (out of ${l.assign_max})` : ''}`}>
        <input type="number" inputMode="decimal" min={0} max={l?.assign_max ?? undefined} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} />
      </Field>
      <Field label="Feedback">
        <textarea value={fb} onChange={(e) => setFb(e.target.value)} maxLength={5000} />
      </Field>
      <div className="row">
        <button className="btn btn-primary grow" disabled={busy} onClick={() => save('graded')}>
          Save marks
        </button>
        <button className="btn btn-ghost grow" disabled={busy} onClick={() => save('redo')}>
          Ask to redo
        </button>
      </div>
    </Sheet>
  )
}
