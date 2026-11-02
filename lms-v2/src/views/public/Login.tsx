import { useState } from 'react'
import { LogIn, MessageCircle, ShieldCheck, GraduationCap } from 'lucide-react'
import { supabase, pinLogin, errText } from '../../lib/supabase'
import { useT } from '../../lib/i18n'
import { useStore } from '../../lib/store'
import { go } from '../../lib/route'
import { waLink } from '../../lib/format'
import type { Session } from '@supabase/supabase-js'
import { PublicHeader } from './Header'
import { Field, useTitle } from '../../components/ui'

export default function Login({ next, admin: adminFirst = false }: { next: string; admin?: boolean }) {
  const t = useT()
  useTitle(t('login'))
  const wa = useStore((s) => s.settings.whatsapp)
  const [role, setRole] = useState<'student' | 'admin'>(adminFirst || next.startsWith('/admin') ? 'admin' : 'student')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [useEmail, setUseEmail] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function done(session: Session) {
    useStore.setState({ session })
    await useStore.getState().loadProfile()
    const isAdmin = session.user.app_metadata?.lms_admin === true
    go(next && next !== '/login' && (isAdmin || !next.startsWith('/admin')) ? next : isAdmin ? '/admin' : '/app')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      if (useEmail) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw })
        if (error || !data.session) throw new Error(error?.message === 'Invalid login credentials' ? t('wrongLogin') : error?.message || t('wrongLogin'))
        await done(data.session)
      } else {
        await done(await pinLogin(role, pin, phone))
      }
    } catch (e2) {
      setErr(errText(e2))
      setPin('')
    }
    setBusy(false)
  }

  return (
    <>
      <PublicHeader />
      <main className="wrap app-main" style={{ maxWidth: 440 }}>
        <div className="card lift" style={{ padding: 22 }}>
          <h1 style={{ fontSize: 26 }}>{t('login')}</h1>
          {!useEmail && (
            <div className="seg mt12" role="tablist">
              <button type="button" aria-pressed={role === 'student'} onClick={() => setRole('student')} className="row nowrap" style={{ gap: 6, flex: 1 }}>
                <GraduationCap size={16} /> {t('student')}
              </button>
              <button type="button" aria-pressed={role === 'admin'} onClick={() => setRole('admin')} className="row nowrap" style={{ gap: 6, flex: 1 }}>
                <ShieldCheck size={16} /> {t('admin')}
              </button>
            </div>
          )}
          <p className="muted mt12" style={{ marginBottom: 16 }}>
            {useEmail ? t('loginSub') : role === 'admin' ? t('adminSub') : t('pinSub')}
          </p>
          <form onSubmit={submit}>
            {useEmail ? (
              <>
                <Field label={t('email')}>
                  <input type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label={t('password')}>
                  <input type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
                </Field>
              </>
            ) : (
              <>
                {role === 'student' && (
                  <Field label={t('waNo')}>
                    <input type="tel" inputMode="tel" autoComplete="tel" required placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </Field>
                )}
                <Field label={t('pin')}>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    required
                    minLength={4}
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    style={{ letterSpacing: '0.5em', fontSize: 22, textAlign: 'center' }}
                    autoFocus={role === 'admin'}
                  />
                </Field>
              </>
            )}
            {err && <p className="err">{err}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              <LogIn size={18} />
              {busy ? '…' : t('login')}
            </button>
          </form>
          <button type="button" className="linkish" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setUseEmail(!useEmail)}>
            {useEmail ? `${t('waNo')} + ${t('pin')}` : t('useEmail')}
          </button>
          <p className="muted small mt8">{t('forgot')}</p>
          <a className="btn btn-ghost btn-block mt12" href={waLink(wa, 'Hi Roshan, I need help logging in to the learning app.')} target="_blank" rel="noopener">
            <MessageCircle size={18} />
            {t('help')}
          </a>
        </div>
      </main>
    </>
  )
}
