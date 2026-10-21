import { useState } from 'react'
import { MessageCircle, Phone, Trash2 } from 'lucide-react'
import { Sheet, WhatsAppIcon } from '../../components/ui'
import { prettyPhone, shortDate, waLink, normalisePhone } from '../../lib/format'
import { useStore } from '../../lib/store'
import type { Lead, LeadStatus } from '../../lib/supabase'
import { templates } from './templates'

export const STATUSES: { id: LeadStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'interested', label: 'Interested' },
  { id: 'joined', label: 'Joined ₹499' },
  { id: 'continuing', label: 'Continuing' },
  { id: 'dropped', label: 'Dropped' },
  { id: 'lost', label: 'Not interested' },
]

export function LeadEditor({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { saveLead, deleteLead, settings } = useStore()
  const [note, setNote] = useState(lead.note ?? '')
  const [follow, setFollow] = useState(lead.follow_up_on ?? '')
  const live = useStore((s) => s.leads.find((l) => l.id === lead.id)) ?? lead

  const setPaid = (key: 'paid_499' | 'paid_500' | 'paid_999', value: boolean) => {
    const patch: Partial<Lead> = { [key]: value }
    if (value && (key === 'paid_499' || key === 'paid_999') && ['new', 'contacted', 'interested'].includes(live.status)) patch.status = 'joined'
    if (value && (key === 'paid_500' || key === 'paid_999')) patch.status = 'continuing'
    saveLead(live.id, patch)
  }

  const saveNotes = () => {
    if ((live.note ?? '') !== note || (live.follow_up_on ?? '') !== follow) saveLead(live.id, { note: note || null, follow_up_on: follow || null })
  }

  const close = () => {
    saveNotes()
    onClose()
  }

  return (
    <Sheet title={live.name} onClose={close}>
      <p className="muted">
        {prettyPhone(live.phone)}
        {live.city ? ` · ${live.city}` : ''} · {live.source} · {shortDate(live.created_at)} · {live.lang === 'ml' ? 'മലയാളം' : 'English'}
      </p>
      {live.goal && <p className="card" style={{ marginBottom: 12, fontSize: 15 }}>“{live.goal}”</p>}
      <div className="row" style={{ marginBottom: 14 }}>
        <a className="btn btn-ghost btn-sm" href={`tel:+${live.phone}`}>
          <Phone size={18} /> Call
        </a>
        <a className="btn btn-wa btn-sm" href={`https://wa.me/${live.phone}`} target="_blank" rel="noopener">
          <WhatsAppIcon size={18} /> Chat
        </a>
      </div>

      <div className="field">
        <label>Status</label>
        <div className="seg">
          {STATUSES.map((s) => (
            <button key={s.id} aria-pressed={live.status === s.id} onClick={() => saveLead(live.id, { status: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Payments</label>
        <div className="toggles">
          <label className="toggle">
            <span>Paid ₹499 (Days 1–2)</span>
            <input type="checkbox" checked={live.paid_499} onChange={(e) => setPaid('paid_499', e.target.checked)} />
          </label>
          <label className="toggle">
            <span>Paid ₹500 (Days 3–7)</span>
            <input type="checkbox" checked={live.paid_500} onChange={(e) => setPaid('paid_500', e.target.checked)} />
          </label>
          <label className="toggle">
            <span>Paid ₹999 at once</span>
            <input type="checkbox" checked={live.paid_999} onChange={(e) => setPaid('paid_999', e.target.checked)} />
          </label>
        </div>
      </div>

      <div className="field">
        <label htmlFor="l-follow">Follow up on</label>
        <input id="l-follow" type="date" value={follow} onChange={(e) => setFollow(e.target.value)} onBlur={saveNotes} />
      </div>
      <div className="field">
        <label htmlFor="l-note">Notes</label>
        <textarea id="l-note" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNotes} maxLength={2000} placeholder="What they said, objections, when to call…" />
      </div>

      <div className="field">
        <label>WhatsApp drafts ({live.lang === 'ml' ? 'Malayalam' : 'English'})</label>
        <div className="toggles">
          {templates(live, settings.checkoutUrl).map((t) => (
            <a
              key={t.id}
              className="toggle"
              style={{ textDecoration: 'none', color: 'inherit' }}
              href={waLink(live.phone, t.text)}
              target="_blank"
              rel="noopener"
              onClick={() => live.status === 'new' && saveLead(live.id, { status: 'contacted' })}
            >
              <span>{t.label}</span>
              <MessageCircle size={18} />
            </a>
          ))}
        </div>
      </div>

      <button
        className="linkish"
        style={{ color: 'var(--bad)' }}
        onClick={async () => {
          if (confirm(`Delete ${live.name}? This can't be undone.`) && (await deleteLead(live.id))) onClose()
        }}
      >
        <Trash2 size={16} style={{ verticalAlign: '-3px' }} /> Delete lead
      </button>
    </Sheet>
  )
}

export function AddLead({ onClose }: { onClose: () => void }) {
  const { addLead } = useStore()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [source, setSource] = useState('whatsapp-ad')
  const [lang, setLang] = useState<'en' | 'ml'>('ml')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = normalisePhone(phone)
    if (!name.trim()) return setErr('Enter a name.')
    if (!p) return setErr('Enter a 10-digit number (or +country code).')
    setBusy(true)
    const ok = await addLead({ name: name.trim(), phone: p, city: city.trim() || null, source, lang, status: 'contacted' })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Sheet title="Add a lead" onClose={onClose}>
      <p className="muted">For people who messaged on WhatsApp or called, so every lead is in one list.</p>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="n-name">Name</label>
          <input id="n-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="n-phone">Phone / WhatsApp</label>
          <input id="n-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={16} />
        </div>
        <div className="field">
          <label htmlFor="n-city">Place</label>
          <input id="n-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="n-source">Came from</label>
          <select id="n-source" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="whatsapp-ad">WhatsApp ad</option>
            <option value="instagram">Instagram</option>
            <option value="referral">Referral</option>
            <option value="call">Phone call</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field">
          <label>Language for messages</label>
          <div className="seg">
            <button type="button" aria-pressed={lang === 'ml'} onClick={() => setLang('ml')}>
              മലയാളം
            </button>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
              English
            </button>
          </div>
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Saving…' : 'Add lead'}
        </button>
      </form>
    </Sheet>
  )
}
