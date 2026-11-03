import { useEffect, useState } from 'react'

export function parseHash(h = location.hash) {
  const raw = h.replace(/^#\/?/, '')
  const [path, qs] = raw.split('?')
  return { parts: (path ?? '').split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs ?? '') }
}

export function useRoute() {
  const [r, setR] = useState(() => parseHash())
  useEffect(() => {
    const on = () => {
      setR(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

export function go(path: string) {
  const h = '#' + (path.startsWith('/') ? path : '/' + path)
  if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange'))
  else location.hash = h
}

export const href = (path: string) => '#' + (path.startsWith('/') ? path : '/' + path)
