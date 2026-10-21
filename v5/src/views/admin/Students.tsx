import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { money } from '../../lib/format'
import { useStore } from '../../lib/store'
import type { Lead } from '../../lib/supabase'
import { LeadEditor } from './LeadEditor'
import { LeadRow, Skeletons } from './Leads'

export const paidTotal = (l: Lead) => (l.paid_999 ? 999 : (l.paid_499 ? 499 : 0) + (l.paid_500 ? 500 : 0))

export default function Students() {
  const { leads, leadsLoading, settings } = useStore()
  const [open, setOpen] = useState<Lead | null>(null)
  const students = leads.filter((l) => l.paid_499 || l.paid_999)
  const owing = students.filter((l) => !l.paid_999 && !l.paid_500 && l.status !== 'dropped')
  const collected = students.reduce((s, l) => s + paidTotal(l), 0)

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <b>{students.length}<small style={{ fontSize: 15, color: 'var(--muted)' }}> / {settings.seatsTotal}</small></b>
          <span>students joined</span>
        </div>
        <div className="kpi">
          <b>{money(collected)}</b>
          <span>collected</span>
        </div>
        <div className="kpi">
          <b>{owing.length}</b>
          <span>still to pay ₹500</span>
        </div>
        <div className="kpi">
          <b>{students.filter((l) => l.paid_999 || l.paid_500).length}</b>
          <span>paid in full</span>
        </div>
      </div>
      <h3 className="h-sub">Students</h3>
      {leadsLoading && !leads.length ? (
        <Skeletons />
      ) : students.length ? (
        <div className="list wide">
          {students.map((l) => (
            <LeadRow
              key={l.id}
              lead={l}
              onOpen={() => setOpen(l)}
              extra={
                <span className="paid" style={{ color: l.paid_999 || l.paid_500 ? 'var(--ok)' : 'var(--warn)' }}>
                  {l.paid_999 || l.paid_500 ? 'Paid ₹999' : l.status === 'dropped' ? 'Stopped after Day 2' : '₹500 due'}
                </span>
              }
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          <GraduationCap size={36} />
          <p>No students yet. When someone pays, open their lead and tick “Paid ₹499”.</p>
        </div>
      )}
      {open && <LeadEditor lead={open} onClose={() => setOpen(null)} />}
    </>
  )
}
