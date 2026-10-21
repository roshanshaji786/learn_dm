import { useState } from 'react'
import { ui } from '../data/content'
import { normalisePhone, waLink } from '../lib/format'
import { useStore } from '../lib/store'
import { hasBackend, pub } from '../lib/supabase'
import { Sheet, WhatsAppIcon } from './ui'

function utmFromUrl() {
  const q = new URLSearchParams(location.search)
  const parts = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
    .map((k) => (q.get(k) ? `${k.slice(4)}=${q.get(k)}` : ''))
    .filter(Boolean)
  if (q.get('fbclid')) parts.push('fb')
  return parts.join('&').slice(0, 200) || null
}

export function LeadSheet({ mode }: { mode: 'join' | 'ask' }) {
  const { lang, settings, openSheet } = useStore()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [goal, setGoal] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const close = () => openSheet(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = normalisePhone(phone)
    if (!name.trim()) return setErr(ui.badName[lang])
    if (!p) return setErr(ui.badPhone[lang])
    setErr(null)
    setBusy(true)
    let saved = false
    if (hasBackend) {
      const { error } = await pub.from('learn_leads').insert({
        name: name.trim().slice(0, 80),
        phone: p,
        city: city.trim().slice(0, 60) || null,
        goal: goal.trim().slice(0, 300) || null,
        lang,
        source: mode === 'join' ? 'site-join' : 'site-question',
        utm: utmFromUrl(),
      })
      saved = !error
    }
    if (mode === 'join') {
      if (!saved) {
        setErr(ui.saveFail[lang])
        setBusy(false)
        await new Promise((r) => setTimeout(r, 1500))
      }
      location.href = settings.checkoutUrl
      return
    }
    const msg =
      lang === 'ml'
        ? `Hi Roshan, ഞാൻ ${name.trim()}${city ? ` (${city.trim()})` : ''}. 7-Day Starter-നെ കുറിച്ച് ഒരു സംശയം: ${goal.trim()}`
        : `Hi Roshan, I'm ${name.trim()}${city ? ` from ${city.trim()}` : ''}. A question about the 7-Day Starter: ${goal.trim()}`
    setBusy(false)
    close()
    window.open(waLink(settings.whatsapp, msg), '_blank', 'noopener')
  }

  const join = mode === 'join'
  return (
    <Sheet title={join ? ui.sheetTitle[lang] : ui.askTitle[lang]} onClose={close}>
      <p className="muted">{join ? ui.sheetText[lang] : ui.askText[lang]}</p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="f-name">{ui.name[lang]}</label>
          <input id="f-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </div>
        <div className="field">
          <label htmlFor="f-phone">{ui.phone[lang]}</label>
          <input id="f-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={16} required />
        </div>
        <div className="field">
          <label htmlFor="f-city">{ui.city[lang]}</label>
          <input id="f-city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="f-goal">{join ? ui.goal[lang] : ui.question[lang]}</label>
          <textarea id="f-goal" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={300} rows={2} />
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        {join ? (
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? ui.saving[lang] : ui.continuePay[lang]}
          </button>
        ) : (
          <button className="btn btn-wa btn-block" disabled={busy}>
            <WhatsAppIcon /> {busy ? ui.saving[lang] : ui.sendWa[lang]}
          </button>
        )}
      </form>
      {join && (
        <a className="linkish" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }} href={settings.checkoutUrl}>
          {ui.skip[lang]}
        </a>
      )}
      <p className="fine">{ui.privacy[lang]}</p>
    </Sheet>
  )
}
