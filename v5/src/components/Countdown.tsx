import { useEffect, useState } from 'react'
import { ui, type Lang } from '../data/content'

export function Countdown({ to, lang }: { to: string; lang: Lang }) {
  const target = new Date(to).getTime()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, target - now)
  if (left === 0) return <p>{ui.started[lang]}</p>
  const parts = [
    [Math.floor(left / 86400000), ui.d[lang]],
    [Math.floor(left / 3600000) % 24, ui.h[lang]],
    [Math.floor(left / 60000) % 60, ui.m[lang]],
    [Math.floor(left / 1000) % 60, ui.s[lang]],
  ] as const
  return (
    <div>
      <div className="eyebrow">{ui.startsIn[lang]}</div>
      <div className="count" role="timer" aria-live="off">
        {parts.map(([n, label]) => (
          <div key={label}>
            <b>{String(n).padStart(2, '0')}</b>
            <small>{label}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
