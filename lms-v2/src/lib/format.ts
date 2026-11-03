const IST = 'Asia/Kolkata'

export function money(n: number | null | undefined) {
  const v = Number(n ?? 0)
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: v % 1 ? 2 : 0 })
}

export function day(iso: string | null | undefined) {
  if (!iso) return ''
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00+05:30') : new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST })
}

export function dayYear(iso: string | null | undefined) {
  if (!iso) return ''
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00+05:30') : new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST })
}

export function time(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: IST })
}

export function when(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const key = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: IST })
  const tomorrow = new Date(today.getTime() + 86400000)
  const label = key(d) === key(today) ? 'Today' : key(d) === key(tomorrow) ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST })
  return `${label}, ${time(iso)}`
}

export function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST })
}

// datetime-local value (IST) <-> ISO
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`
}

export function fromLocalInput(v: string) {
  if (!v) return null
  return new Date(v + ':00+05:30').toISOString()
}

export function waNumber(phone: string | null | undefined) {
  const d = (phone ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length === 10) return '91' + d
  if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1)
  return d
}

export function waLink(phone: string | null | undefined, text = '') {
  const n = waNumber(phone)
  return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

export function embedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/))([\w-]{11})/)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1`
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

export function csv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? '')
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }).join(',')).join('\n')
}

export function download(name: string, text: string, type = 'text/csv') {
  const blob = new Blob([text], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
