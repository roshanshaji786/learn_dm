import { useState } from 'react'
import { Receipt, Award, Download, KeyRound, LogOut, MessageCircle, Smartphone, ShieldCheck } from 'lucide-react'
import { supabase, errText } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { useT } from '../../lib/i18n'
import { money, dayYear, waLink } from '../../lib/format'
import { go } from '../../lib/route'
import { useTitle, Field, ThemeSeg, LangToggle } from '../../components/ui'
import { receiptPdf, certificatePdf } from '../../lib/pdf'
import { type StudentData, paidFor } from './data'

export default function Me({ d, reload }: { d: StudentData; reload: () => Promise<void> }) {
  const t = useT()
  useTitle(t('me'))
  const profile = useStore((s) => s.profile)!
  const settings = useStore((s) => s.settings)
  const say = useStore((s) => s.say)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState('')

  async function changePw(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 8) return say(t('newPw'), true)
    setBusy('pw')
    const { error } = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } })
    if (!error) await supabase.from('lms_profiles').update({ must_change_password: false }).eq('user_id', profile.user_id)
    setBusy('')
    if (error) return say(errText(error), true)
    setPw('')
    say(t('pwChanged'))
    await useStore.getState().loadProfile()
  }

  async function claim(courseId: string) {
    setBusy('cert' + courseId)
    const { error } = await supabase.rpc('lms_claim_certificate', { p_course: courseId })
    setBusy('')
    if (error) return say(errText(error), true)
    await reload()
  }

  return (
    <>
      <div className="row nowrap" style={{ marginBottom: 14 }}>
        <div className="grow">
          <h1 style={{ fontSize: 24 }}>{profile.name}</h1>
          <p className="small muted ellipsis">
            {profile.email}
            {profile.phone && ` · ${profile.phone}`}
          </p>
        </div>
      </div>

      {d.enrolments.map((e) => {
        const c = d.courses.find((x) => x.id === e.course_id)
        if (!c) return null
        const paid = paidFor(d, e.id)
        const bal = Number(e.total_fee) - paid
        const pays = d.payments.filter((p) => p.enrolment_id === e.id)
        const cert = d.certificates.find((x) => x.course_id === c.id && !x.revoked)
        const ls = d.lessons.filter((l) => l.course_id === c.id)
        const allDone = ls.length > 0 && ls.every((l) => d.states[l.id]?.completed)
        return (
          <section key={e.id}>
            <h2 className="h-sub">
              <Receipt size={18} /> {t('payments')} <span className="ellipsis">{c.title}</span>
            </h2>
            <div className="card">
              <dl className="dl">
                <dt>{t('totalFee')}</dt>
                <dd>{money(e.total_fee)}</dd>
                <dt>{t('paid')}</dt>
                <dd style={{ color: 'var(--ok)' }}>{money(paid)}</dd>
                <dt>{t('balance')}</dt>
                <dd style={{ color: bal > 0 ? 'var(--warn)' : 'var(--ok)' }}>{money(Math.max(0, bal))}</dd>
                {e.due_date && bal > 0 && (
                  <>
                    <dt>{t('dueBy')}</dt>
                    <dd>{dayYear(e.due_date)}</dd>
                  </>
                )}
              </dl>
            </div>
            {pays.length > 0 && (
              <div className="list mt8">
                {pays.map((p, i) => (
                  <button
                    key={p.id}
                    className="item noicon"
                    onClick={() => {
                      const upto = pays.slice(i).reduce((a, x) => a + Number(x.amount), 0)
                      void receiptPdf({
                        academy: settings.academy_name,
                        receiptNo: p.receipt_no,
                        paidOn: p.paid_on,
                        student: profile.name,
                        phone: profile.phone,
                        email: profile.email,
                        course: c.title,
                        amount: Number(p.amount),
                        method: p.method,
                        reference: p.reference,
                        totalFee: Number(e.total_fee),
                        paidToDate: upto,
                        balance: Math.max(0, Number(e.total_fee) - upto),
                      })
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <div className="t">{money(p.amount)}</div>
                      <div className="s">
                        {dayYear(p.paid_on)} · {p.method} · {p.receipt_no}
                      </div>
                    </span>
                    <Download size={18} className="muted" />
                  </button>
                ))}
              </div>
            )}

            {c.cert_enabled && (
              <>
                <h2 className="h-sub">
                  <Award size={18} /> {t('certificate')}
                </h2>
                {cert ? (
                  <div className="cert-preview">
                    <p className="badge ok">
                      <ShieldCheck size={14} style={{ verticalAlign: -2 }} /> {cert.code}
                    </p>
                    <h2>{profile.name}</h2>
                    <p className="muted small">{c.title}</p>
                    <div className="stack mt16">
                      <button
                        className="btn btn-primary btn-block"
                        onClick={() => void certificatePdf({ name: profile.name, course: c.title, code: cert.code, issuedAt: cert.issued_at, verifyUrl: `${location.host}/#/verify/${cert.code}` })}
                      >
                        <Download size={18} /> {t('download')}
                      </button>
                      <a className="linkish" style={{ justifyContent: 'center' }} href={`#/verify/${cert.code}`}>
                        {t('verify')}
                      </a>
                    </div>
                  </div>
                ) : allDone && bal <= 0 ? (
                  <button className="btn btn-primary btn-block" onClick={() => claim(c.id)} disabled={busy === 'cert' + c.id}>
                    <Award size={18} /> {t('claimCert')}
                  </button>
                ) : (
                  <p className="small muted">{t('certNotYet')}</p>
                )}
              </>
            )}
          </section>
        )
      })}

      <h2 className="h-sub">{t('language')}</h2>
      <LangToggle />
      <h2 className="h-sub">{t('theme')}</h2>
      <ThemeSeg />

      {profile.must_change_password && (
        <>
      <h2 className="h-sub">
        <KeyRound size={18} /> {t('changePw')}
      </h2>
      {profile.must_change_password && <p className="banner">{t('mustChange')}</p>}
      <form onSubmit={changePw}>
        <input type="email" autoComplete="username" value={profile.email} readOnly hidden />
        <Field label={t('newPw')}>
          <input type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <button className="btn btn-ghost btn-block" disabled={busy === 'pw' || pw.length < 8}>
          {t('save')}
        </button>
      </form>

        </>
      )}

      <h2 className="h-sub">
        <Smartphone size={18} /> {t('install')}
      </h2>
      <p className="small muted">{t('installHint')}</p>

      <div className="stack mt24">
        <a className="btn btn-wa btn-block" href={waLink(settings.whatsapp, 'Hi Roshan, I need help with the learning app.')} target="_blank" rel="noopener">
          <MessageCircle size={18} /> {t('help')}
        </a>
        <button
          className="btn btn-danger btn-block"
          onClick={async () => {
            await useStore.getState().signOut()
            go('/')
          }}
        >
          <LogOut size={18} /> {t('logout')}
        </button>
      </div>
    </>
  )
}
