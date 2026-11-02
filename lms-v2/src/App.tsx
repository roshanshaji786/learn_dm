import { lazy, Suspense } from 'react'
import { useRoute } from './lib/route'
import { useStore } from './lib/store'
import { hasBackend } from './lib/supabase'
import { Toast, Spinner } from './components/ui'
import Home from './views/public/Home'
import CoursePage from './views/public/CoursePage'
import Verify from './views/public/Verify'
import Login from './views/public/Login'
import StudentApp from './views/student/StudentApp'

const AdminApp = lazy(() => import('./views/admin/AdminApp'))

export default function App() {
  const { parts, query } = useRoute()
  const ready = useStore((s) => s.ready)
  const session = useStore((s) => s.session)
  const isAdmin = useStore((s) => s.isAdmin)
  const [p0, ...rest] = parts

  let view
  if (!hasBackend) view = <div className="wrap app-main">This app needs its Supabase settings.</div>
  else if (p0 === 'course') view = <CoursePage slug={rest[0] ?? ''} />
  else if (p0 === 'verify') view = <Verify code={rest[0] ?? query.get('id') ?? ''} />
  else if (p0 === 'login') view = <Login next={query.get('next') ?? ''} admin={query.get('as') === 'admin'} />
  else if (p0 === 'app' || p0 === 'admin') {
    if (!ready) view = <Spinner />
    else if (!session) view = <Login next={'/' + parts.join('/')} />
    else if (p0 === 'admin')
      view = isAdmin ? (
        <Suspense fallback={<Spinner />}>
          <AdminApp parts={rest} />
        </Suspense>
      ) : (
        <StudentApp parts={[]} />
      )
    else view = <StudentApp parts={rest} />
  } else view = <Home />

  return (
    <>
      {view}
      <Toast />
    </>
  )
}
