import { useEffect, useState } from 'react'
import { ShieldCheck, CircleAlert } from 'lucide-react'
import { pub, errText } from '../../lib/supabase'
import { useT } from '../../lib/i18n'
import { dayYear } from '../../lib/format'
import { PublicHeader, PublicFooter } from './Header'
import { Field, useTitle } from '../../components/ui'

type Res = { name: string; course: string; issued_at: string; revoked: boolean } | 'none' | null

export default function Verify({ code: initial }: { code: string }) {
  const t = useT()
  useTitle(t('verifyH'))
  const [code, setCode] = useState(initial)
  const [res, setRes] = useState<Res>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function check(c = code) {
    if (!c.trim()) return
    setBusy(true)
    setErr('')
    const { data, error } = await pub.rpc('lms_verify', { p_code: c.trim() })
    setBusy(false)
    if (error) return setErr(errText(error))
    setRes(data?.[0] ?? 'none')
  }
  useEffect(() => {
    if (initial) void check(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])

  return (
    <>
      <PublicHeader />
      <main className="wrap narrow app-main">
        <h1 style={{ fontSize: 26 }}>{t('verifyH')}</h1>
        <p className="muted mt8">{t('verifyP')}</p>
        <form
          className="mt16"
          onSubmit={(e) => {
            e.preventDefault()
            void check()
          }}
        >
          <Field label="Certificate ID">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="DAA-XXXXXXXX" autoCapitalize="characters" spellCheck={false} />
          </Field>
          {err && <p className="err">{err}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {t('check')}
          </button>
        </form>
        {res === 'none' && (
          <div className="banner bad mt16">
            <CircleAlert size={18} />
            <div>{t('notFound')}</div>
          </div>
        )}
        {res && res !== 'none' && (
          <div className="cert-preview mt16">
            {res.revoked ? (
              <p className="badge bad">{t('revoked')}</p>
            ) : (
              <p className="badge ok">
                <ShieldCheck size={14} style={{ verticalAlign: -2 }} /> {t('valid')}
              </p>
            )}
            <h2>{res.name}</h2>
            <p className="muted">has completed</p>
            <p style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }}>{res.course}</p>
            <p className="muted small mt12">
              {t('issued')} {dayYear(res.issued_at)} · Darts AI Academy
            </p>
          </div>
        )}
      </main>
      <PublicFooter />
    </>
  )
}
