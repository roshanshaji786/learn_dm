import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { questions } from '../../data/register'
import { prettyPhone, timeAgo, waLink } from '../../lib/format'
import { supabase } from '../../lib/supabase'

type Registration = {
  id: string
  created_at: string
  name: string
  phone: string
  district: string | null
  who: string
  age: string | null
  interests: string[]
  goal: string | null
  budget: string | null
  heard_from: string | null
  note: string | null
  lang: 'en' | 'ml'
  utm: string | null
}

const cols = ['created_at', 'name', 'phone', 'district', 'who', 'age', 'interests', 'goal', 'budget', 'heard_from', 'note', 'lang', 'utm'] as const

function toCsv(rows: Registration[]) {
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n')
}

export default function Forms() {
  const [rows, setRows] = useState<Registration[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('learn_registrations')
      .select(cols.join(',') + ',id')
      .order('created_at', { ascending: false })
      .limit(2000)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRows((data ?? []) as unknown as Registration[])
      })
  }, [])

  // Answer counts per question, most common first: the audience picture.
  const breakdown = useMemo(() => {
    if (!rows) return []
    return questions.map((q) => {
      const m = new Map<string, number>()
      rows.forEach((r) => {
        const v = r[q.key]
        ;(Array.isArray(v) ? v : v ? [v] : []).forEach((x) => m.set(x, (m.get(x) ?? 0) + 1))
      })
      return { q, counts: [...m.entries()].sort((a, b) => b[1] - a[1]) }
    })
  }, [rows])

  const download = () => {
    if (!rows) return
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `registrations-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  if (error) return <p className="empty">Couldn't load the form answers: {error}</p>
  if (!rows) return <div className="skel" />

  return (
    <>
      <div className="toolbar">
        <h1 className="h-sub" style={{ margin: 0, flex: 1 }}>
          {rows.length} registration{rows.length === 1 ? '' : 's'}
        </h1>
        <button className="btn btn-ghost btn-sm" onClick={download} disabled={!rows.length}>
          <Download size={16} /> CSV
        </button>
      </div>
      <p className="muted" style={{ fontSize: 14 }}>
        Form link: <b>{location.origin}/register</b>. Every answer also appears in Leads (source "register").
      </p>
      {!rows.length ? (
        <p className="empty">No answers yet. Share the form link with your leads.</p>
      ) : (
        <>
          {breakdown.map(({ q, counts }) => (
            <section key={q.key}>
              <h2 className="h-sub">{q.label.en}</h2>
              <div className="funnel">
                {counts.length ? (
                  counts.map(([label, n]) => (
                    <div key={label} className="bar-row">
                      <span>{label}</span>
                      <i style={{ width: `${(n / rows.length) * 100}%` }} />
                      <b>{n}</b>
                    </div>
                  ))
                ) : (
                  <p className="muted">No answers</p>
                )}
              </div>
            </section>
          ))}
          <h2 className="h-sub">Latest answers</h2>
          <div className="list">
            {rows.slice(0, 100).map((r) => (
              <a key={r.id} className="lead-row" style={{ textDecoration: 'none', color: 'inherit' }} href={waLink(r.phone, `Hi ${r.name}, thanks for registering with DARTS AI Academy!`)} target="_blank" rel="noopener">
                <span className="nm">{r.name}</span>
                <span className="sub">
                  {[r.who, r.district, r.interests.join(', '), r.budget].filter(Boolean).join(' · ')}
                  {r.note ? ` · “${r.note}”` : ''}
                </span>
                <span className="right">
                  <span className="status new">{timeAgo(r.created_at)}</span>
                  <span className="paid" style={{ color: 'var(--muted)' }}>{prettyPhone(r.phone)}</span>
                </span>
              </a>
            ))}
          </div>
        </>
      )}
    </>
  )
}
