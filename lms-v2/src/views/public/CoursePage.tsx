import { ArrowLeft, MessageCircle, CalendarDays } from 'lucide-react'
import { pub } from '../../lib/supabase'
import { useLoad, must } from '../../lib/useLoad'
import { useT } from '../../lib/i18n'
import { useStore } from '../../lib/store'
import { money, waLink, when } from '../../lib/format'
import type { Course, Lesson, Module } from '../../lib/types'
import { PublicHeader, PublicFooter } from './Header'
import { CourseCard } from './Home'
import { Skel, Empty, useTitle } from '../../components/ui'

export default function CoursePage({ slug }: { slug: string }) {
  const t = useT()
  const wa = useStore((s) => s.settings.whatsapp)
  const { data, loading } = useLoad(async () => {
    const c = must(await pub.from('lms_courses').select('*').eq('slug', slug).maybeSingle()) as Course | null
    if (!c) return null
    const [m, l] = await Promise.all([
      pub.from('lms_modules').select('*').eq('course_id', c.id).order('sort'),
      pub.from('lms_lessons').select('id,module_id,title,sort,live_start,duration_min').eq('course_id', c.id).order('sort'),
    ])
    return { c, mods: must(m) as Module[], lessons: must(l) as Lesson[] }
  }, [slug])
  useTitle(data?.c.title ?? '')
  const upcoming = (data?.lessons ?? []).filter((l) => l.live_start && new Date(l.live_start).getTime() > Date.now()).slice(0, 5)

  return (
    <>
      <PublicHeader />
      <main className="wrap" style={{ paddingTop: 12 }}>
        <a className="linkish" href="#/">
          <ArrowLeft size={18} /> {t('back')}
        </a>
        {loading && !data ? (
          <Skel n={3} />
        ) : !data ? (
          <Empty>{t('nothing')}</Empty>
        ) : (
          <>
            <img src={data.c.cover_url || '/img/adm-cover.jpg'} alt="" className="hero-img" style={{ boxShadow: 'none', marginTop: 4 }} />
            <h1 style={{ fontSize: 'clamp(26px, 7vw, 40px)', marginTop: 18 }}>{data.c.title}</h1>
            <p className="muted mt8" style={{ fontSize: 17 }}>
              {data.c.subtitle} {data.c.description}
            </p>
            <CourseCard c={data.c} mods={data.mods} wa={wa} full />
            {upcoming.length > 0 && (
              <>
                <h2 className="h-sub">
                  <CalendarDays size={20} /> Upcoming live classes
                </h2>
                <div className="list">
                  {upcoming.map((l) => (
                    <div className="item noicon" key={l.id} style={{ cursor: 'default' }}>
                      <div>
                        <div className="t">{l.title}</div>
                        <div className="s">{when(l.live_start)} IST</div>
                      </div>
                      <span className="badge brand">{l.duration_min} min</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
      <PublicFooter />
      {data && (
        <div className="buybar">
          <div className="info">
            <b>{money(data.c.fee)}</b>
            {t('fullFee')}
          </div>
          <a className="btn btn-wa" href={waLink(wa, t('waEnrol', { c: data.c.title }))} target="_blank" rel="noopener">
            <MessageCircle size={20} />
            {t('enrolWa')}
          </a>
        </div>
      )}
    </>
  )
}
