const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export const money = (n: number) => inr.format(n)

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return shortDate(iso)
}

// Accepts 10-digit Indian numbers with or without +91 / 0; returns digits with country code, or null.
export function normalisePhone(raw: string): string | null {
  let d = raw.replace(/[^0-9]/g, '')
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 10) return '91' + d
  if (d.length === 12 && d.startsWith('91')) return d
  if (d.length >= 8 && d.length <= 15 && raw.trim().startsWith('+')) return d
  return null
}

export function prettyPhone(d: string) {
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`
  return '+' + d
}

export const waLink = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
