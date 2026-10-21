import { lazy, Suspense, useEffect } from 'react'
import { LeadSheet } from './components/LeadSheet'
import { TopBar } from './components/TopBar'
import { Toast } from './components/ui'
import { parseHash, useStore } from './lib/store'
import { supabase } from './lib/supabase'
import Home from './views/Home'

const Admin = lazy(() => import('./views/Admin'))

export default function App() {
  const { route, setRoute, sheet, loadSettings, checkAdmin } = useStore()

  useEffect(() => {
    const onHash = () => {
      const h = location.hash
      // Supabase auth redirects arrive as #access_token=…; the client reads them, then we land on the admin.
      if (h.includes('access_token=') || h.includes('error_description=')) return
      setRoute(parseHash())
      if (h === '#join') useStore.getState().openSheet('join')
    }
    onHash()
    addEventListener('hashchange', onHash)
    loadSettings()
    return () => removeEventListener('hashchange', onHash)
  }, [setRoute, loadSettings])

  useEffect(() => {
    if (route.view !== 'admin') return
    checkAdmin()
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        checkAdmin()
        if (event === 'SIGNED_IN' && !location.hash.startsWith('#admin')) history.replaceState(null, '', '#admin')
      }
    })
    return () => data.subscription.unsubscribe()
  }, [route.view, checkAdmin])

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      {route.view === 'admin' ? (
        <Suspense fallback={<TopBar />}>
          <Admin tab={route.tab} />
        </Suspense>
      ) : (
        <>
          <TopBar />
          <Home />
        </>
      )}
      {(sheet === 'join' || sheet === 'ask') && <LeadSheet mode={sheet} />}
      <Toast />
    </>
  )
}
