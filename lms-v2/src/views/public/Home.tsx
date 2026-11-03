import { Check, ChevronRight, Video, CirclePlay, ClipboardList, Receipt, Award, Smartphone, MessageCircle } from 'lucide-react'
import { pub } from '../../lib/supabase'
import { useLoad, must } from '../../lib/useLoad'
import { useT } from '../../lib/i18n'
import { useStore } from '../../lib/store'
import { money, waLink } from '../../lib/format'
import type { Course, Module } from '../../lib/types'
import { PublicHeader, PublicFooter } from './Header'
import { Skel, useTitle } from '../../components/ui'

export function useCatalog() {
  return useLoad(async () => {
    const courses = must(await pub.from('lms_courses').select('*').eq('published', true).order('sort')) as Course[]
    const ids = courses.map((c) => c.id)
    const modules = ids.length ? (must(await pub.from('lms_modules').select('*').in('course_id', ids).order('sort')) as Module[]) : []
    return { courses, modules }
  }, [])
}

export default function Home() {
  const t = useT()
  useTitle('')
  const wa = useStore((s) => s.settings.whatsapp)
  const { data, loading } = useCatalog()
  const c = data?.courses[0]
  const mods = data?.modules.filter((m) => m.course_id === c?.id) ?? []
  const enrol = waLink(wa, t('waEnrol', { c: c?.title ?? 'the course' }))
  const ask = waLink(wa, t('waAsk'))

  return (
    <>
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="wrap">
            <div>
              <span className="eyb">
                <i />
                {t('enrolling')}
              </span>
              <h1>
                {c ? (
                  <>
                    {c.title.replace(/ with AI$/, '')} <em>with AI</em>
                  </>
                ) : (
                  'Darts AI Academy'
                )}
              </h1>
              <p className="lead">
                {c?.subtitle} {c?.description}
              </p>
              <div className="btns">
                <a className="btn btn-wa" href={enrol} target="_blank" rel="noopener">
                  <MessageCircle size={20} />
                  {t('enrolWa')}
                </a>
                <a className="btn btn-ghost" href="#learn">
                  {t('seeLearn')}
                </a>
              </div>
              <div className="facts">
                <div>
                  <b>{c ? money(c.fee) : '—'}</b>
                  {t('fullFee')}
                </div>
                <div>
                  <b>
                    {mods.length || 8} {t('modules')}
                  </b>
                  {t('modulesSub')}
                </div>
                <div>
                  <b>{t('live')}</b>
                  {t('mlEn')}
                </div>
              </div>
            </div>
            <img className="hero-img" src={c?.cover_url || '/img/adm-cover.jpg'} alt="" width={1200} height={675} />
          </div>
        </section>

        <section className="section" id="learn">
          <div className="wrap">
            <p className="k">{t('theCourse')}</p>
            <h2>{t('courseH')}</h2>
            <p className="sub">{t('courseSub')}</p>
            {loading && !data ? (
              <div className="mt24">
                <Skel n={2} />
              </div>
            ) : (
              data?.courses.map((co) => (
                <CourseCard key={co.id} c={co} mods={data.modules.filter((m) => m.course_id === co.id)} wa={wa} />
              ))
            )}
          </div>
        </section>

        <section className="section alt">
          <div className="wrap">
            <p className="k">{t('howJoin')}</p>
            <h2>{t('howJoinH')}</h2>
            <div className="steps">
              {(['s1', 's2', 's3', 's4'] as const).map((s, i) => (
                <div className="card step" key={s}>
                  <div className="n">{i + 1}</div>
                  <h3>{t(`${s}t` as 's1t')}</h3>
                  <p>{t(`${s}p` as 's1p')}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="about">
              <img src="/img/roshan-480.webp" srcSet="/img/roshan-480.webp 480w, /img/roshan-900.webp 900w" sizes="(min-width: 860px) 360px, 100vw" alt="Roshan Shaji" width={480} height={600} loading="lazy" />
              <div>
                <p className="k">{t('mentor')}</p>
                <h2>Roshan Shaji</h2>
                <p className="sub">{t('mentorBio')}</p>
                <div className="tags">
                  <span>M.Tech CSE · CET Trivandrum alumnus</span>
                  <span>Founder & MD, DanRosh</span>
                  <span>AI trainer</span>
                </div>
                <a className="linkish mt8" href="https://roshanshaji.com" rel="noopener">
                  {t('moreRoshan')} <ChevronRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="section alt">
          <div className="wrap">
            <p className="k">{t('hub')}</p>
            <h2>{t('hubH')}</h2>
            <div className="feats">
              {(
                [
                  ['f1', <Video size={20} key="1" />],
                  ['f2', <CirclePlay size={20} key="2" />],
                  ['f3', <ClipboardList size={20} key="3" />],
                  ['f4', <Receipt size={20} key="4" />],
                  ['f5', <Award size={20} key="5" />],
                  ['f6', <Smartphone size={20} key="6" />],
                ] as const
              ).map(([k, ic]) => (
                <div className="card feat" key={k}>
                  <div className="ic">{ic}</div>
                  <div>
                    <h3>{t(`${k}t` as 'f1t')}</h3>
                    <p>{t(`${k}p` as 'f1p')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap narrow">
            <p className="k">{t('faq')}</p>
            <h2>FAQ</h2>
            <div className="faq">
              {(['1', '2', '3', '4', '5', '6'] as const).map((n) => (
                <details key={n}>
                  <summary>{t(`q${n}` as 'q1')}</summary>
                  <p>{t(`a${n}` as 'a1')}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="wrap">
          <div className="cta">
            <h2>{t('ready')}</h2>
            <p>{t('readyP')}</p>
            <div className="btns">
              <a className="btn btn-wa" href={enrol} target="_blank" rel="noopener">
                <MessageCircle size={20} />
                {t('enrolWa')}
              </a>
              <a className="btn btn-ghost" href={ask} target="_blank" rel="noopener">
                {t('askQ')}
              </a>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  )
}

export function CourseCard({ c, mods, wa, full }: { c: Course; mods: Module[]; wa: string; full?: boolean }) {
  const t = useT()
  return (
    <div className="card lift course-card">
      <div className="l">
        <h3>{c.title}</h3>
        <div className="price">
          <b>{money(c.fee)}</b>
          <span>{c.fee_note}</span>
        </div>
        <ul className="ck">
          {c.highlights.map((h) => (
            <li key={h}>
              <Check size={18} />
              {h}
            </li>
          ))}
        </ul>
        <div className="stack">
          <a className="btn btn-primary btn-block" href={waLink(wa, t('waEnrol', { c: c.title }))} target="_blank" rel="noopener">
            <MessageCircle size={20} />
            {t('enrolWa')}
          </a>
          {!full && (
            <a className="btn btn-ghost btn-block" href={`#/course/${c.slug}`}>
              {t('details')}
            </a>
          )}
        </div>
      </div>
      <div className="r">
        <b>{t('covers')}</b>
        <ol className="mods">
          {mods.map((m, i) => (
            <li key={m.id}>
              <b>{String(i + 1).padStart(2, '0')}</b>
              {m.title}
              {full && m.summary && <p>{m.summary}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
