import { useEffect, useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { WhatsAppIcon } from '../components/ui'
import { questions, r, START_LINE, type Field } from '../data/register'
import { normalisePhone, utmFromUrl, waLink } from '../lib/format'
import { useStore } from '../lib/store'
import { hasBackend, pub } from '../lib/supabase'

type Answers = Partial<Record<Field, string | string[]>>

export default function Register() {
  const { lang, settings } = useStore()
  const other = lang === 'en' ? 'ml' : 'en'
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [a, setA] = useState<Answers>({})
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    document.title = 'Register · DARTS AI Academy'
  }, [])

  const pick = (key: Field, v: string, multi?: boolean) =>
    setA((cur) => {
      if (!multi) return { ...cur, [key]: cur[key] === v ? undefined : v }
      const list = (cur[key] as string[] | undefined) ?? []
      return { ...cur, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] }
    })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = normalisePhone(phone)
    if (!name.trim()) return setErr(lang === 'ml' ? 'പേര് നൽകൂ.' : 'Please enter your name.')
    if (!p) return setErr(lang === 'ml' ? '10 അക്ക WhatsApp നമ്പർ നൽകൂ.' : 'Please enter a 10-digit WhatsApp number.')
    const missing = questions.find((q) => q.required && !(q.multi ? (a[q.key] as string[] | undefined)?.length : a[q.key]))
    if (missing) return setErr(`${r.pick[lang]} ${missing.label[lang]}`)
    setErr(null)
    setBusy(true)
    const one = (k: Field) => (a[k] as string | undefined) ?? null
    const { error } = hasBackend
      ? await pub.from('learn_registrations').insert({
          name: name.trim().slice(0, 80),
          phone: p,
          district: one('district'),
          who: one('who'),
          age: one('age'),
          interests: a.interests as string[],
          goal: one('goal'),
          budget: one('budget'),
          heard_from: one('heard_from'),
          note: note.trim().slice(0, 300) || null,
          lang,
          utm: utmFromUrl(),
        })
      : { error: new Error('no backend') }
    setBusy(false)
    if (error) return setErr(r.fail[lang])
    setDone(true)
    scrollTo({ top: 0 })
  }

  const waText =
    lang === 'ml'
      ? `Hi Roshan, ഞാൻ ${name.trim()}. 7-Day AI Starter-ന് register ചെയ്തു.`
      : `Hi Roshan, I'm ${name.trim()}. I just registered for the 7-Day AI Starter.`

  return (
    <main className="wrap reg" id="main">
      <p className="reg-eyebrow">{START_LINE[lang]}</p>
      {done ? (
        <div className="card reg-done" role="status">
          <CircleCheck size={44} />
          <h1>{r.doneTitle[lang]}</h1>
          <p className="muted">{r.doneText[lang]}</p>
          <a className="btn btn-primary btn-block" href={settings.checkoutUrl}>
            {r.pay[lang]}
          </a>
          <a className="btn btn-wa btn-block" href={waLink(settings.whatsapp, waText)} target="_blank" rel="noopener">
            <WhatsAppIcon /> {r.chat[lang]}
          </a>
        </div>
      ) : (
        <>
          <h1>{r.title[lang]}</h1>
          <p className="muted">{r.intro[lang]}</p>
          <form onSubmit={submit} noValidate className="card">
            <div className="field">
              <label htmlFor="r-name">
                {r.name[lang]} * <small>{r.name[other]}</small>
              </label>
              <input id="r-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </div>
            <div className="field">
              <label htmlFor="r-phone">
                {r.phone[lang]} * <small>{r.phone[other]}</small>
              </label>
              <input id="r-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={16} required />
            </div>
            {questions.map((q) =>
              q.select ? (
                <div className="field" key={q.key}>
                  <label htmlFor={`r-${q.key}`}>
                    {q.label[lang]} <small>{q.label[other]}</small>
                  </label>
                  <select id={`r-${q.key}`} value={(a[q.key] as string) ?? ''} onChange={(e) => setA({ ...a, [q.key]: e.target.value || undefined })}>
                    <option value="">{lang === 'ml' ? 'തിരഞ്ഞെടുക്കൂ' : 'Select'}</option>
                    {q.options.map((o) => (
                      <option key={o.v} value={o.v}>
                        {lang === 'ml' ? o.ml : o.v}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <fieldset className="field" key={q.key}>
                  <legend>
                    {q.label[lang]}
                    {q.required && ' *'} <small>{q.label[other]}</small>
                  </legend>
                  <div className="opts">
                    {q.options.map((o) => {
                      const on = q.multi ? ((a[q.key] as string[] | undefined) ?? []).includes(o.v) : a[q.key] === o.v
                      return (
                        <button type="button" key={o.v} aria-pressed={on} onClick={() => pick(q.key, o.v, q.multi)}>
                          {lang === 'ml' ? o.ml : o.v}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              ),
            )}
            <div className="field">
              <label htmlFor="r-note">{r.note[lang]}</label>
              <textarea id="r-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} />
            </div>
            {err && <p className="err" role="alert">{err}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? r.saving[lang] : r.submit[lang]}
            </button>
            <p className="fine">{r.privacy[lang]}</p>
          </form>
        </>
      )}
    </main>
  )
}
