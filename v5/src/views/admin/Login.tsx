import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../lib/store'

export function Login() {
  const { checkAdmin, showToast } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const redirect = location.origin + '/#admin'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setMsg(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
      else await checkAdmin()
    } else {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect } })
      if (error) setMsg(error.message)
      else if (data.session) await checkAdmin()
      else setMsg('Check your email and tap the confirm link once. Then come back here and sign in with this password.')
    }
    setBusy(false)
  }

  const magic = async () => {
    if (!email.trim()) return setMsg('Type your email first.')
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect, shouldCreateUser: false } })
    setBusy(false)
    if (error) setMsg(error.message)
    else showToast('Sign-in link sent. Open it on this phone.')
  }

  return (
    <div className="wrap" style={{ maxWidth: 440, paddingTop: 32, paddingBottom: 40 }}>
      <div className="card">
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Admin sign-in</h2>
        <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 16 }}>Leads, students and payments. Only Roshan's email can see them.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="a-email">Email</label>
            <input id="a-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="a-pass">{mode === 'signin' ? 'Password' : 'Choose a password (8+ characters)'}</label>
            <input id="a-pass" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {msg && <p className="err" role="alert">{msg}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            <LogIn size={18} /> {mode === 'signin' ? 'Sign in' : 'Create admin password'}
          </button>
        </form>
        <button className="linkish" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null) }}>
          {mode === 'signin' ? 'First time here? Create your password' : 'Already have a password? Sign in'}
        </button>
        <button className="linkish" onClick={magic} disabled={busy}>
          Email me a sign-in link instead
        </button>
      </div>
    </div>
  )
}
