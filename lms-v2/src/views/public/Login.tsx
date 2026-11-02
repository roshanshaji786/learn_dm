import { useState } from 'react'
import { LogIn, MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/i18n'
import { useStore } from '../../lib/store'
import { go } from '../../lib/route'
import { waLink } from '../../lib/format'
import { PublicHeader } from './Header'
import { Field, useTitle } from '../../components/ui'

export default function Login({ next }: { next: string }) {
  const t = useT()
  useTitle(t('login'))
  const wa = useStore((s) => s.settings.whatsapp)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw })
    if (error || !data.session) {
      setBusy(false)
      return setErr(error?.message === 'Invalid login credentials' ? t('wrongLogin') : error?.message || t('wrongLogin'))
    }
    useStore.setState({ session: data.session })
    await useStore.getState().loadProfile()
    setBusy(false)
    const admin = data.session.user.app_metadata?.lms_admin === true
    go(next && next !== '/login' ? next : admin ? '/admin' : '/app')
  }

  return (
    <>
      <PublicHeader />
      <main className="wrap app-main" style={{ maxWidth: 440 }}>
        <div className="card lift" style={{ padding: 22 }}>
          <h1 style={{ fontSize: 26 }}>{t('login')}</h1>
          <p className="muted mt8" style={{ marginBottom: 16 }}>
            {t('loginSub')}
          </p>
          <form onSubmit={submit}>
            <Field label={t('email')}>
              <input type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t('password')}>
              <input type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            {err && <p className="err">{err}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              <LogIn size={18} />
              {t('login')}
            </button>
          </form>
          <p className="muted small mt16">{t('forgot')}</p>
          <a className="btn btn-ghost btn-block mt12" href={waLink(wa, 'Hi Roshan, I need help logging in to the learning app.')} target="_blank" rel="noopener">
            <MessageCircle size={18} />
            {t('help')}
          </a>
        </div>
      </main>
    </>
  )
}
