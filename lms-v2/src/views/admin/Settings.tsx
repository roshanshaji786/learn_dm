import { useState } from 'react'
import { LogOut, KeyRound } from 'lucide-react'
import { supabase, errText } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { go } from '../../lib/route'
import { useTitle, Field, ThemeSeg } from '../../components/ui'

export default function Settings() {
  useTitle('Settings')
  const settings = useStore((s) => s.settings)
  const session = useStore((s) => s.session)
  const say = useStore((s) => s.say)
  const [f, setF] = useState({ academy_name: settings.academy_name ?? '', whatsapp: settings.whatsapp ?? '', upi_id: settings.upi_id ?? '' })
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const rows = Object.entries(f).map(([key, value]) => ({ key, value: value.trim(), updated_at: new Date().toISOString() }))
    const r = await supabase.from('lms_settings').upsert(rows)
    setBusy(false)
    if (r.error) return say(errText(r.error), true)
    useStore.setState({ settings: { ...settings, ...f } })
    say('Saved')
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } })
    if (error) return say(errText(error), true)
    setPw('')
    say('Password changed')
  }

  return (
    <>
      <div className="page-h">
        <h1>Settings</h1>
      </div>
      <form onSubmit={save} className="card">
        <Field label="Academy name">
          <input value={f.academy_name} onChange={(e) => setF({ ...f, academy_name: e.target.value })} />
        </Field>
        <Field label="WhatsApp number (with 91)" hint="Used on every Enrol and Help button">
          <input inputMode="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="UPI ID" hint="Students' Pay by UPI button pays this ID">
          <input value={f.upi_id} onChange={(e) => setF({ ...f, upi_id: e.target.value })} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy}>
          Save
        </button>
      </form>

      <h2 className="h-sub">Theme</h2>
      <ThemeSeg />

      <h2 className="h-sub">
        <KeyRound size={18} /> Your password
      </h2>
      <form onSubmit={changePw}>
        <input type="email" autoComplete="username" value={session?.user.email ?? ''} readOnly hidden />
        <Field label="New password (8+ characters)">
          <input type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <button className="btn btn-ghost btn-block" disabled={pw.length < 8}>
          Change password
        </button>
      </form>

      <p className="small muted mt24">Signed in as {session?.user.email}</p>
      <button
        className="btn btn-danger btn-block mt8"
        onClick={async () => {
          await useStore.getState().signOut()
          go('/')
        }}
      >
        <LogOut size={18} /> Log out
      </button>
    </>
  )
}
