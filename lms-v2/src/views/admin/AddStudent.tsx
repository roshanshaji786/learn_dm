import { useState } from 'react'
import { MessageCircle, Copy } from 'lucide-react'
import { supabase, callAdmin, errText } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { waLink, todayIST } from '../../lib/format'
import { go } from '../../lib/route'
import { Sheet, Field } from '../../components/ui'
import { loginMessage, type Course } from './data'

type Created = { user_id: string; temp_password: string | null; existing: boolean }

export function AddStudentSheet({ courses, onClose, onDone }: { courses: Course[]; onClose: () => void; onDone: () => void }) {
  const say = useStore((s) => s.say)
  const [f, setF] = useState({ name: '', email: '', phone: '', course: courses[0]?.id ?? '', fee: String(courses[0]?.fee ?? ''), amount: '', method: 'UPI', reference: '', due: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ c: Created; name: string; email: string; phone: string } | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const c = await callAdmin<Created>('create_student', { name: f.name, email: f.email, phone: f.phone })
      if (f.course) {
        const { data: ex } = await supabase.from('lms_enrolments').select('id').eq('user_id', c.user_id).eq('course_id', f.course).maybeSingle()
        let enrolmentId = ex?.id as string | undefined
        if (!enrolmentId) {
          const r = await supabase.from('lms_enrolments').insert({ user_id: c.user_id, course_id: f.course, total_fee: Number(f.fee || 0), due_date: f.due || null }).select('id').single()
          if (r.error) throw r.error
          enrolmentId = r.data.id
        }
        if (Number(f.amount) > 0) {
          const p = await supabase.from('lms_payments').insert({ enrolment_id: enrolmentId, amount: Number(f.amount), method: f.method, reference: f.reference || null, paid_on: todayIST() })
          if (p.error) throw p.error
        }
      }
      setDone({ c, name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone })
      onDone()
    } catch (e2) {
      setErr(errText(e2))
    }
    setBusy(false)
  }

  if (done) {
    const msg = done.c.temp_password ? loginMessage(done.name, done.email, done.c.temp_password) : `Hi ${done.name.split(' ')[0]}, you're enrolled! Open https://lms.roshanshaji.com/#/app and log in with your usual email (${done.email}).`
    return (
      <Sheet title="Student added" onClose={onClose}>
        <p className="muted" style={{ marginBottom: 12 }}>
          {done.c.existing ? 'This email already had a login, so their password is unchanged.' : 'Send the login now. The temporary password is shown only here.'}
        </p>
        <pre className="card prose small" style={{ margin: 0 }}>
          {msg}
        </pre>
        <div className="stack mt12">
          <a className="btn btn-wa btn-block" href={waLink(done.phone, msg)} target="_blank" rel="noopener">
            <MessageCircle size={18} /> Send on WhatsApp
          </a>
          <button
            className="btn btn-ghost btn-block"
            onClick={async () => {
              await navigator.clipboard.writeText(msg).catch(() => {})
              say('Copied')
            }}
          >
            <Copy size={16} /> Copy message
          </button>
          <button
            className="linkish"
            style={{ justifyContent: 'center' }}
            onClick={() => {
              onClose()
              go(`/admin/students/${done.c.user_id}`)
            }}
          >
            Open student
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title="Add a student" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Full name">
          <input required value={f.name} onChange={set('name')} autoComplete="off" maxLength={100} />
        </Field>
        <Field label="Email (their login)">
          <input required type="email" inputMode="email" value={f.email} onChange={set('email')} autoComplete="off" />
        </Field>
        <Field label="WhatsApp number">
          <input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="10-digit mobile" />
        </Field>
        <Field label="Course">
          <select
            value={f.course}
            onChange={(e) => {
              const c = courses.find((x) => x.id === e.target.value)
              setF({ ...f, course: e.target.value, fee: c ? String(c.fee) : f.fee })
            }}
          >
            <option value="">No course yet</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        {f.course && (
          <>
            <div className="grid2">
              <Field label="Agreed fee (₹)">
                <input type="number" inputMode="decimal" min={0} value={f.fee} onChange={set('fee')} />
              </Field>
              <Field label="Balance due by">
                <input type="date" value={f.due} onChange={set('due')} />
              </Field>
            </div>
            <div className="grid2">
              <Field label="Paid now (₹)">
                <input type="number" inputMode="decimal" min={0} value={f.amount} onChange={set('amount')} placeholder="0" />
              </Field>
              <Field label="Method">
                <select value={f.method} onChange={set('method')}>
                  {['UPI', 'Cash', 'Bank transfer', 'Card', 'Other'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
            </div>
            {Number(f.amount) > 0 && (
              <Field label="UPI / transaction reference (optional)">
                <input value={f.reference} onChange={set('reference')} maxLength={100} />
              </Field>
            )}
          </>
        )}
        {err && <p className="err">{err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating…' : 'Create login'}
        </button>
        <p className="tiny muted center mt8">A login with a temporary password is created. You send it on WhatsApp.</p>
      </form>
    </Sheet>
  )
}
