import { useState } from 'react'
import { ArrowLeft, MessageCircle, KeyRound, Plus, Download, Trash, Pencil, Award, Eye } from 'lucide-react'
import { supabase, callAdmin, errText } from '../../lib/supabase'
import { useLoad } from '../../lib/useLoad'
import { useStore } from '../../lib/store'
import { money, dayYear, waLink, todayIST } from '../../lib/format'
import { receiptPdf } from '../../lib/pdf'
import { useTitle, Skel, Sheet, Field } from '../../components/ui'
import { all, paid, loginMessage, type Course, type Enrolment, type Lesson, type Payment, type Profile, type Submission } from './data'
import type { Certificate } from '../../lib/types'

async function load(id: string) {
  const [p, enrolments, courses, lessons, prog, att, subs, certs] = await Promise.all([
    supabase.from('lms_profiles').select('*').eq('user_id', id).maybeSingle(),
    all<Enrolment[]>(supabase.from('lms_enrolments').select('*').eq('user_id', id).order('created_at')),
    all<Course[]>(supabase.from('lms_courses').select('*').order('sort')),
    all<Lesson[]>(supabase.from('lms_lessons').select('id,course_id,title,published,has_assignment,live_start').eq('published', true)),
    all<{ lesson_id: string }[]>(supabase.from('lms_progress').select('lesson_id').eq('user_id', id)),
    all<{ lesson_id: string }[]>(supabase.from('lms_attendance').select('lesson_id').eq('user_id', id)),
    all<Submission[]>(supabase.from('lms_submissions').select('*').eq('user_id', id)),
    all<Certificate[]>(supabase.from('lms_certificates').select('*').eq('user_id', id)),
  ])
  const payments = enrolments.length ? await all<Payment[]>(supabase.from('lms_payments').select('*').in('enrolment_id', enrolments.map((e) => e.id)).order('paid_on', { ascending: false })) : []
  return { profile: p.data as Profile | null, enrolments, courses, lessons, prog, att, subs, certs, payments }
}

export default function StudentDetail({ id }: { id: string }) {
  const say = useStore((s) => s.say)
  const { data, reload } = useLoad(() => load(id), [id])
  const [sheet, setSheet] = useState<null | { k: 'edit' } | { k: 'pay'; e: Enrolment } | { k: 'enrol' } | { k: 'fee'; e: Enrolment } | { k: 'pw'; msg: string }>(null)
  useTitle(data?.profile?.name ?? 'Student')
  if (!data) return <Skel n={4} />
  const p = data.profile
  if (!p) return <p>Student not found.</p>

  async function resetPw() {
    if (!p!.phone) return say('Add their WhatsApp number first (edit ✏️)', true)
    const want = prompt(`New PIN for ${p!.name} (4 to 8 digits). Leave empty for a random one. Their old PIN stops working.`, '')
    if (want === null) return
    try {
      const r = await callAdmin<{ pin: string }>('set_pin', { user_id: p!.user_id, pin: want.trim() })
      setSheet({ k: 'pw', msg: loginMessage(p!.name, p!.phone, r.pin) })
      await reload()
    } catch (e) {
      say(errText(e), true)
    }
  }
  async function delPayment(pay: Payment) {
    if (!confirm(`Delete payment ${pay.receipt_no} of ${money(pay.amount)}?`)) return
    const r = await supabase.from('lms_payments').delete().eq('id', pay.id)
    if (r.error) return say(errText(r.error), true)
    await reload()
  }

  return (
    <>
      <a className="linkish" href="#/admin/students">
        <ArrowLeft size={18} /> Students
      </a>
      <div className="page-h">
        <h1 className="ellipsis">{p.name}</h1>
        <button className="icon-btn" onClick={() => setSheet({ k: 'edit' })} aria-label="Edit">
          <Pencil size={18} />
        </button>
      </div>
      <div className="card">
        <dl className="dl">
          <dt>WhatsApp (login)</dt>
          <dd>{p.phone || '—'}</dd>
          {!p.email.endsWith('@students.roshanshaji.com') && (
            <>
              <dt>Email</dt>
              <dd>{p.email}</dd>
            </>
          )}
          <dt>Joined</dt>
          <dd>{dayYear(p.created_at)}</dd>
        </dl>
        {p.note && <p className="small muted mt12">{p.note}</p>}
        <div className="row mt12">
          <a className="btn btn-sm btn-wa grow" href={waLink(p.phone, `Hi ${p.name.split(' ')[0]}, `)} target="_blank" rel="noopener" aria-disabled={!p.phone}>
            <MessageCircle size={16} /> WhatsApp
          </a>
          <button className="btn btn-sm btn-ghost grow" onClick={resetPw}>
            <KeyRound size={16} /> New PIN
          </button>
        </div>
        <a className="btn btn-sm btn-ghost btn-block mt8" href={`#/admin/view/${p.user_id}`}>
          <Eye size={16} /> View as this student
        </a>
      </div>

      {data.enrolments.map((e) => {
        const c = data.courses.find((x) => x.id === e.course_id)
        const pays = data.payments.filter((x) => x.enrolment_id === e.id)
        const pd = paid(data, e.id)
        const bal = Number(e.total_fee) - pd
        const ls = data.lessons.filter((l) => l.course_id === e.course_id)
        const done = ls.filter((l) => data.prog.some((x) => x.lesson_id === l.id)).length
        const att = ls.filter((l) => data.att.some((x) => x.lesson_id === l.id)).length
        const live = ls.filter((l) => l.live_start && new Date(l.live_start).getTime() < Date.now()).length
        const subs = data.subs.filter((s) => ls.some((l) => l.id === s.lesson_id))
        const cert = data.certs.find((x) => x.course_id === e.course_id)
        return (
          <section key={e.id}>
            <h2 className="h-sub">
              <span className="ellipsis">{c?.title}</span>
              <span className={'badge ' + (e.status === 'cancelled' ? 'bad' : e.status === 'completed' ? 'ok' : 'brand')}>{e.status}</span>
            </h2>
            <div className="card">
              <dl className="dl">
                <dt>Fee</dt>
                <dd>{money(e.total_fee)}</dd>
                <dt>Paid</dt>
                <dd style={{ color: 'var(--ok)' }}>{money(pd)}</dd>
                <dt>Balance</dt>
                <dd style={{ color: bal > 0 ? 'var(--warn)' : 'var(--ok)' }}>
                  {money(bal)}
                  {e.due_date && bal > 0 ? ` · due ${dayYear(e.due_date)}` : ''}
                </dd>
                <dt>Lessons done</dt>
                <dd>
                  {done} / {ls.length}
                </dd>
                <dt>Classes attended</dt>
                <dd>
                  {att} / {live}
                </dd>
                <dt>Assignments</dt>
                <dd>
                  {subs.length} submitted · {subs.filter((s) => s.status === 'graded').length} marked
                </dd>
                {cert && (
                  <>
                    <dt>Certificate</dt>
                    <dd>
                      <a href={`#/verify/${cert.code}`}>
                        <Award size={14} style={{ verticalAlign: -2 }} /> {cert.code}
                      </a>
                      {cert.revoked && ' (revoked)'}
                    </dd>
                  </>
                )}
              </dl>
              <div className="row mt12">
                <button className="btn btn-sm btn-primary grow" onClick={() => setSheet({ k: 'pay', e })}>
                  <Plus size={16} /> Payment
                </button>
                <button className="btn btn-sm btn-ghost grow" onClick={() => setSheet({ k: 'fee', e })}>
                  <Pencil size={16} /> Fee & status
                </button>
              </div>
              {bal > 0 && p.phone && (
                <a
                  className="btn btn-sm btn-ghost btn-block mt8"
                  target="_blank"
                  rel="noopener"
                  href={waLink(p.phone, `Hi ${p.name.split(' ')[0]}, a gentle reminder: ${money(bal)} is due for ${c?.title}${e.due_date ? ` by ${dayYear(e.due_date)}` : ''}. You can pay by UPI to 7012045854@apl and send me the screenshot. Thank you!`)}
                >
                  <MessageCircle size={16} /> Send fee reminder
                </a>
              )}
            </div>
            {pays.length > 0 && (
              <div className="list mt8">
                {pays.map((pay, i) => (
                  <div className="item noicon" key={pay.id} style={{ cursor: 'default' }}>
                    <span style={{ minWidth: 0 }}>
                      <div className="t">{money(pay.amount)}</div>
                      <div className="s">
                        {dayYear(pay.paid_on)} · {pay.method} · {pay.receipt_no}
                      </div>
                    </span>
                    <span className="row nowrap">
                      <button
                        className="icon-btn plain"
                        aria-label="Receipt PDF"
                        onClick={() => {
                          const upto = pays.slice(i).reduce((a, x) => a + Number(x.amount), 0)
                          void receiptPdf({
                            academy: useStore.getState().settings.academy_name,
                            receiptNo: pay.receipt_no,
                            paidOn: pay.paid_on,
                            student: p.name,
                            phone: p.phone,
                            email: p.email,
                            course: c?.title ?? '',
                            amount: Number(pay.amount),
                            method: pay.method,
                            reference: pay.reference,
                            totalFee: Number(e.total_fee),
                            paidToDate: upto,
                            balance: Math.max(0, Number(e.total_fee) - upto),
                          })
                        }}
                      >
                        <Download size={18} />
                      </button>
                      <button className="icon-btn plain" aria-label="Delete payment" onClick={() => delPayment(pay)}>
                        <Trash size={18} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}

      <button className="btn btn-ghost btn-block mt16" onClick={() => setSheet({ k: 'enrol' })}>
        <Plus size={16} /> Enrol in a course
      </button>

      {sheet?.k === 'edit' && <EditProfile p={p} onClose={() => setSheet(null)} onDone={reload} />}
      {sheet?.k === 'pay' && <AddPayment e={sheet.e} p={p} onClose={() => setSheet(null)} onDone={reload} />}
      {sheet?.k === 'fee' && <EditFee e={sheet.e} onClose={() => setSheet(null)} onDone={reload} />}
      {sheet?.k === 'enrol' && <Enrol p={p} courses={data.courses.filter((c) => !data.enrolments.some((e) => e.course_id === c.id))} onClose={() => setSheet(null)} onDone={reload} />}
      {sheet?.k === 'pw' && (
        <Sheet title="New PIN" onClose={() => setSheet(null)}>
          <pre className="card prose small" style={{ margin: 0 }}>
            {sheet.msg}
          </pre>
          <a className="btn btn-wa btn-block mt12" href={waLink(p.phone, sheet.msg)} target="_blank" rel="noopener">
            <MessageCircle size={18} /> Send on WhatsApp
          </a>
        </Sheet>
      )}
    </>
  )
}

function useSave(onDone: () => Promise<void>, onClose: () => void) {
  const say = useStore((s) => s.say)
  const [busy, setBusy] = useState(false)
  return {
    busy,
    run: async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
      setBusy(true)
      const r = await fn()
      setBusy(false)
      if (r.error) return say(errText(r.error), true)
      say('Saved')
      onClose()
      await onDone()
    },
  }
}

function EditProfile({ p, onClose, onDone }: { p: Profile; onClose: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ name: p.name, phone: p.phone ?? '', note: p.note ?? '' })
  const s = useSave(onDone, onClose)
  return (
    <Sheet title="Edit student" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void s.run(() => supabase.from('lms_profiles').update({ name: f.name.trim(), phone: f.phone.trim() || null, note: f.note.trim() || null }).eq('user_id', p.user_id))
        }}
      >
        <Field label="Full name">
          <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="WhatsApp number">
          <input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="Private note (only you see this)">
          <textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={s.busy}>
          Save
        </button>
      </form>
    </Sheet>
  )
}

function AddPayment({ e, p, onClose, onDone }: { e: Enrolment; p: Profile; onClose: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ amount: '', paid_on: todayIST(), method: 'UPI', reference: '' })
  const s = useSave(onDone, onClose)
  return (
    <Sheet title={`Payment from ${p.name.split(' ')[0]}`} onClose={onClose}>
      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          void s.run(() => supabase.from('lms_payments').insert({ enrolment_id: e.id, amount: Number(f.amount), paid_on: f.paid_on, method: f.method, reference: f.reference.trim() || null }))
        }}
      >
        <div className="grid2">
          <Field label="Amount (₹)">
            <input required type="number" inputMode="decimal" min={1} step="0.01" value={f.amount} onChange={(x) => setF({ ...f, amount: x.target.value })} />
          </Field>
          <Field label="Date paid">
            <input required type="date" value={f.paid_on} onChange={(x) => setF({ ...f, paid_on: x.target.value })} />
          </Field>
        </div>
        <Field label="Method">
          <select value={f.method} onChange={(x) => setF({ ...f, method: x.target.value })}>
            {['UPI', 'Cash', 'Bank transfer', 'Card', 'Other'].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Reference (optional)">
          <input value={f.reference} onChange={(x) => setF({ ...f, reference: x.target.value })} maxLength={100} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={s.busy}>
          Save payment
        </button>
        <p className="tiny muted center mt8">A receipt number is made automatically. The student sees it under "Me".</p>
      </form>
    </Sheet>
  )
}

function EditFee({ e, onClose, onDone }: { e: Enrolment; onClose: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ total_fee: String(e.total_fee), due_date: e.due_date ?? '', status: e.status })
  const s = useSave(onDone, onClose)
  return (
    <Sheet title="Fee and status" onClose={onClose}>
      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          void s.run(() => supabase.from('lms_enrolments').update({ total_fee: Number(f.total_fee), due_date: f.due_date || null, status: f.status }).eq('id', e.id))
        }}
      >
        <Field label="Agreed total fee (₹)">
          <input type="number" min={0} value={f.total_fee} onChange={(x) => setF({ ...f, total_fee: x.target.value })} />
        </Field>
        <Field label="Balance due by" hint="After this date, new lessons pause until the balance is paid. Leave empty for no lock.">
          <input type="date" value={f.due_date} onChange={(x) => setF({ ...f, due_date: x.target.value })} />
        </Field>
        <Field label="Status">
          <select value={f.status} onChange={(x) => setF({ ...f, status: x.target.value as Enrolment['status'] })}>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled (removes access)</option>
          </select>
        </Field>
        <button className="btn btn-primary btn-block" disabled={s.busy}>
          Save
        </button>
      </form>
    </Sheet>
  )
}

function Enrol({ p, courses, onClose, onDone }: { p: Profile; courses: Course[]; onClose: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ course: courses[0]?.id ?? '', fee: String(courses[0]?.fee ?? 0), due: '' })
  const s = useSave(onDone, onClose)
  if (!courses.length)
    return (
      <Sheet title="Enrol" onClose={onClose}>
        <p className="muted">Already enrolled in every course.</p>
      </Sheet>
    )
  return (
    <Sheet title={`Enrol ${p.name.split(' ')[0]}`} onClose={onClose}>
      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          void s.run(() => supabase.from('lms_enrolments').insert({ user_id: p.user_id, course_id: f.course, total_fee: Number(f.fee), due_date: f.due || null }))
        }}
      >
        <Field label="Course">
          <select value={f.course} onChange={(x) => setF({ ...f, course: x.target.value, fee: String(courses.find((c) => c.id === x.target.value)?.fee ?? 0) })}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid2">
          <Field label="Agreed fee (₹)">
            <input type="number" min={0} value={f.fee} onChange={(x) => setF({ ...f, fee: x.target.value })} />
          </Field>
          <Field label="Due by">
            <input type="date" value={f.due} onChange={(x) => setF({ ...f, due: x.target.value })} />
          </Field>
        </div>
        <button className="btn btn-primary btn-block" disabled={s.busy}>
          Enrol
        </button>
      </form>
    </Sheet>
  )
}
