import { lazy, Suspense, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { money } from '../../lib/format'
import { useStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { paidTotal } from './Students'

const DayChart = lazy(() => import('./DayChart'))

export default function Stats() {
  const { leads, settings, session, checkAdmin, showToast, loadSettings } = useStore()
  const [seats, setSeats] = useState(String(settings.seatsTotal))
  const [checkout, setCheckout] = useState(settings.checkoutUrl)

  const s = useMemo(() => {
    const joined = leads.filter((l) => l.paid_499 || l.paid_999)
    const full = joined.filter((l) => l.paid_999 || l.paid_500)
    const contacted = leads.filter((l) => l.status !== 'new')
    const interested = leads.filter((l) => ['interested', 'joined', 'continuing'].includes(l.status) || l.paid_499 || l.paid_999)
    const bySource = new Map<string, number>()
    leads.forEach((l) => bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1))
    const byDay = new Map<string, { leads: number; joined: number }>()
    leads.forEach((l) => {
      const d = new Date(l.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const row = byDay.get(d) ?? { leads: 0, joined: 0 }
      row.leads++
      if (l.paid_499 || l.paid_999) row.joined++
      byDay.set(d, row)
    })
    const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-21).map(([day, v]) => ({ day: day.slice(5), ...v }))
    return {
      joined,
      full,
      collected: joined.reduce((n, l) => n + paidTotal(l), 0),
      funnel: [
        ['Leads', leads.length],
        ['Contacted', contacted.length],
        ['Interested', interested.length],
        ['Paid ₹499', joined.length],
        ['Paid ₹999 total', full.length],
      ] as const,
      sources: [...bySource.entries()].sort((a, b) => b[1] - a[1]),
      days,
    }
  }, [leads])

  const max = Math.max(1, s.funnel[0][1])
  const conv = leads.length ? Math.round((s.joined.length / leads.length) * 100) : 0

  const saveSettings = async () => {
    const total = Math.max(1, Math.min(500, parseInt(seats) || settings.seatsTotal))
    const { error } = await supabase.from('learn_settings').upsert([
      { key: 'seats_total', value: String(total), updated_at: new Date().toISOString() },
      { key: 'checkout_url', value: checkout.trim(), updated_at: new Date().toISOString() },
    ])
    if (error) showToast("Couldn't save: " + error.message)
    else {
      showToast('Saved. The sales page shows it now.')
      loadSettings()
    }
  }

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <b>{leads.length}</b>
          <span>leads</span>
        </div>
        <div className="kpi">
          <b>{conv}%</b>
          <span>lead → paid</span>
        </div>
        <div className="kpi">
          <b>{money(s.collected)}</b>
          <span>collected</span>
        </div>
        <div className="kpi">
          <b>{Math.max(0, settings.seatsTotal - s.joined.length)}</b>
          <span>seats left of {settings.seatsTotal}</span>
        </div>
      </div>

      <h3 className="h-sub">Funnel</h3>
      <div className="card funnel">
        {s.funnel.map(([label, n]) => (
          <div key={label}>
            <span>{label}</span>
            <i style={{ width: `${(n / max) * 100}%` }} />
            <b>{n}</b>
          </div>
        ))}
      </div>

      <h3 className="h-sub">Leads per day (last 3 weeks)</h3>
      <div className="card" style={{ height: 240, padding: '12px 4px 4px' }}>
        {s.days.length ? (
          <Suspense fallback={<div className="skel" style={{ height: '100%' }} />}>
            <DayChart data={s.days} />
          </Suspense>
        ) : (
          <p className="empty">No leads yet.</p>
        )}
      </div>

      <h3 className="h-sub">Where leads come from</h3>
      <div className="card funnel">
        {s.sources.length ? (
          s.sources.map(([src, n]) => (
            <div key={src}>
              <span>{src}</span>
              <i style={{ width: `${(n / max) * 100}%`, background: 'var(--accent)' }} />
              <b>{n}</b>
            </div>
          ))
        ) : (
          <p style={{ color: 'var(--muted)' }}>No leads yet.</p>
        )}
      </div>

      <h3 className="h-sub">Sales page settings</h3>
      <div className="card">
        <div className="field">
          <label htmlFor="s-seats">Total seats</label>
          <input id="s-seats" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="field">
          <label htmlFor="s-checkout">₹499 checkout link</label>
          <input id="s-checkout" type="url" value={checkout} onChange={(e) => setCheckout(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" onClick={saveSettings}>
          Save settings
        </button>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '20px 0 8px' }}>Signed in as {session?.user.email}</p>
      <button
        className="btn btn-ghost btn-block"
        onClick={async () => {
          await supabase.auth.signOut()
          await checkAdmin()
        }}
      >
        <LogOut size={18} /> Sign out
      </button>
    </>
  )
}
