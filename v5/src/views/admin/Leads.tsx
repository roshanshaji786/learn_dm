import { useMemo, useState } from 'react'
import { Inbox, Plus, RefreshCw, Search } from 'lucide-react'
import { prettyPhone, timeAgo } from '../../lib/format'
import { useStore } from '../../lib/store'
import type { Lead } from '../../lib/supabase'
import { AddLead, LeadEditor, STATUSES } from './LeadEditor'

type Filter = 'all' | 'today' | 'follow' | Lead['status']

export function LeadRow({ lead, onOpen, extra }: { lead: Lead; onOpen: () => void; extra?: React.ReactNode }) {
  const label = STATUSES.find((s) => s.id === lead.status)?.label ?? lead.status
  const paid = lead.paid_999 ? '₹999 paid' : lead.paid_499 && lead.paid_500 ? '₹999 paid' : lead.paid_499 ? '₹499 paid' : ''
  return (
    <button className="lead-row" onClick={onOpen}>
      <span className="nm">{lead.name}</span>
      <span className="sub">
        {prettyPhone(lead.phone)}
        {lead.city ? ` · ${lead.city}` : ''} · {timeAgo(lead.created_at)}
      </span>
      <span className="right">
        <span className={`status ${lead.status}`}>{label}</span>
        {extra ?? (paid && <span className="paid">{paid}</span>)}
      </span>
    </button>
  )
}

export function Skeletons() {
  return (
    <div className="list">
      {[0, 1, 2, 3, 4].map((i) => (
        <div className="skel" key={i} />
      ))}
    </div>
  )
}

export default function Leads() {
  const { leads, leadsLoading, leadsError, loadLeads } = useStore()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<Lead | null>(null)
  const [adding, setAdding] = useState(false)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return leads.filter((l) => {
      if (filter === 'today' && new Date(l.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) !== today) return false
      if (filter === 'follow' && !(l.follow_up_on && l.follow_up_on <= today && !['lost', 'dropped'].includes(l.status))) return false
      if (filter !== 'all' && filter !== 'today' && filter !== 'follow' && l.status !== filter) return false
      if (!needle) return true
      return [l.name, l.phone, l.city ?? '', l.note ?? '', l.goal ?? ''].some((v) => v.toLowerCase().includes(needle))
    })
  }, [leads, q, filter, today])

  const count = (f: Filter) =>
    f === 'all' ? leads.length : f === 'today' || f === 'follow' ? undefined : leads.filter((l) => l.status === f).length

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'follow', label: 'Follow up due' },
    ...STATUSES.map((s) => ({ id: s.id as Filter, label: s.label })),
  ]

  return (
    <>
      <div className="toolbar">
        <div className="search-wrap">
          <Search size={18} />
          <input className="search" type="search" placeholder="Search name, phone, notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" />
        </div>
        <button className="icon-btn" onClick={loadLeads} aria-label="Refresh">
          <RefreshCw size={18} />
        </button>
      </div>
      <div className="chips" role="group" aria-label="Filter">
        {filters.map((f) => {
          const c = count(f.id)
          return (
            <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
              {c !== undefined ? ` · ${c}` : ''}
            </button>
          )
        })}
      </div>
      {leadsError && <p className="err">Couldn't load leads: {leadsError}</p>}
      {leadsLoading && !leads.length ? (
        <Skeletons />
      ) : shown.length ? (
        <div className="list wide">
          {shown.map((l) => (
            <LeadRow key={l.id} lead={l} onOpen={() => setOpen(l)} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <Inbox size={36} />
          <p>{leads.length ? 'No leads match this filter.' : 'No leads yet. Form sign-ups land here, and you can add WhatsApp leads with the + button.'}</p>
        </div>
      )}
      <button className="fab" onClick={() => setAdding(true)} aria-label="Add a lead">
        <Plus size={26} />
      </button>
      {open && <LeadEditor lead={open} onClose={() => setOpen(null)} />}
      {adding && <AddLead onClose={() => setAdding(false)} />}
    </>
  )
}
