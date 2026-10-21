import { CalendarDays, Check, CheckCircle2, Languages, PlayCircle, ShieldCheck, Sparkles, Users, Video, type LucideIcon } from 'lucide-react'
import { Countdown } from '../components/Countdown'
import { WhatsAppIcon } from '../components/ui'
import { days, faqs, includes, ui } from '../data/content'
import { waLink } from '../lib/format'
import { useStore } from '../lib/store'

const icons: Record<(typeof includes)[number]['icon'], LucideIcon> = {
  play: PlayCircle,
  video: Video,
  sparkles: Sparkles,
  users: Users,
  check: CheckCircle2,
  languages: Languages,
}

export default function Home() {
  const { lang, settings, openSheet } = useStore()
  const left = Math.max(0, settings.seatsTotal - settings.seatsTaken)
  const pct = Math.min(100, Math.round((settings.seatsTaken / settings.seatsTotal) * 100))
  const askText =
    lang === 'ml' ? 'Hi Roshan, 7-Day Starter-നെ കുറിച്ച് അറിയണം.' : "Hi Roshan, I'd like to know more about the 7-Day Starter."
  const wa = waLink(settings.whatsapp, askText)
  const join = () => openSheet('join')

  return (
    <main id="main">
      <section className="hero">
        <div className="wrap">
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="eyebrow">{ui.eyebrow[lang]}</div>
            <h1>
              {ui.h1a[lang]} <em>{ui.h1b[lang]}</em>
            </h1>
            <p className="sub">{ui.sub[lang]}</p>
            <ul>
              {[ui.b1, ui.b2, ui.b3].map((b) => (
                <li key={b.en}>
                  <Check size={18} /> {b[lang]}
                </li>
              ))}
            </ul>
            <div className="hero-ctas">
              <button className="btn btn-primary" onClick={join}>
                {ui.join[lang]}
              </button>
              <a className="btn btn-ghost" href="#days" onClick={(e) => { e.preventDefault(); document.getElementById('days')?.scrollIntoView() }}>
                {ui.see7[lang]}
              </a>
            </div>
            <div className="meta-row">
              <span className="chip">
                <CalendarDays size={16} /> {ui.starts[lang]}
              </span>
            </div>
          </div>
          <div className="hero-photo">
            <img
              src="/img/roshan-480.webp"
              srcSet="/img/roshan-480.webp 480w, /img/roshan-900.webp 900w"
              sizes="(min-width: 860px) 420px, 100vw"
              width="480"
              height="705"
              alt="Roshan Shaji teaching a live AI workshop"
              fetchPriority="high"
            />
            <div className="tag">
              <b>Roshan Shaji</b>
              {ui.instructorRole[lang]}
            </div>
          </div>
        </div>
      </section>

      <section className="count-card" aria-label="Countdown and seats">
        <div className="wrap">
          <Countdown to={settings.batchStart} lang={lang} />
          <div className="seats">
            <div className="seats-bar" aria-hidden="true">
              <i style={{ width: `${Math.max(pct, 4)}%` }} />
            </div>
            <p>
              {settings.seatsTaken > 0 ? (
                <>
                  <b>{left}</b> {ui.of[lang]} {settings.seatsTotal} {ui.seatsLeft[lang]}
                </>
              ) : (
                <b>{ui.onlySeats[lang]}</b>
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="stats">
            <div>
              <b>7</b>
              <span>{ui.stat1[lang]}</span>
            </div>
            <div>
              <b>₹499</b>
              <span>{ui.stat2[lang]}</span>
            </div>
            <div>
              <b>0</b>
              <span>{ui.stat3[lang]}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt" id="days">
        <div className="wrap">
          <div className="eyebrow">{ui.daysEyebrow[lang]}</div>
          <h2>{ui.daysTitle[lang]}</h2>
          <p className="lead">{ui.daysText[lang]}</p>
          <ol className="days">
            {days.map((d) => (
              <li className="day" key={d.day}>
                <div className="n">
                  Day<b>{d.day}</b>
                </div>
                <div>
                  <h3>{d.title[lang]}</h3>
                  <small>
                    {d.date[lang]} · 9 PM {d.trial && <span className="pill">{ui.trialTag[lang]}</span>}
                  </small>
                </div>
              </li>
            ))}
          </ol>
          <p className="note-line">
            <Video size={18} /> {ui.recorded[lang]}
          </p>
        </div>
      </section>

      <section className="section" id="instructor">
        <div className="wrap">
          <div className="eyebrow">{ui.instructorEyebrow[lang]}</div>
          <div className="instructor">
            <img src="/img/roshan-480.webp" width="480" height="480" loading="lazy" alt="Roshan Shaji" />
            <div>
              <h3>Roshan Shaji</h3>
              <p className="role">{ui.instructorRole[lang]}</p>
              <p>{ui.instructorBio[lang]}</p>
              <ul className="ticks">
                {[ui.cred1, ui.cred2, ui.cred3].map((c) => (
                  <li key={c.en}>
                    <CheckCircle2 size={18} /> {c[lang]}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="wrap">
          <div className="eyebrow">{ui.getEyebrow[lang]}</div>
          <h2>{ui.getTitle[lang]}</h2>
          <div className="grid-cards">
            {includes.map((f) => {
              const Icon = icons[f.icon]
              return (
                <div className="card feat" key={f.title.en}>
                  <div className="ic">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3>{f.title[lang]}</h3>
                    <p>{f.text[lang]}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section trial">
        <div className="wrap">
          <div className="card">
            <div className="eyebrow">{ui.trialEyebrow[lang]}</div>
            <h2>{ui.trialTitle[lang]}</h2>
            <p>{ui.trialText[lang]}</p>
            <button className="btn btn-primary" onClick={join}>
              {ui.join[lang]}
            </button>
          </div>
        </div>
      </section>

      <section className="section price" id="price">
        <div className="wrap">
          <div className="eyebrow">{ui.priceEyebrow[lang]}</div>
          <h2>{ui.priceTitle[lang]}</h2>
          <div className="price-card">
            <div className="price-row first">
              <b>₹499</b>
              <span>{ui.today[lang]}</span>
            </div>
            <div className="price-row">
              <b>₹500</b>
              <span>{ui.afterDay2[lang]}</span>
            </div>
            <small>
              <Sparkles size={16} /> {ui.priceNote[lang]}
            </small>
            <button className="btn btn-primary btn-block" onClick={join}>
              {ui.join[lang]}
            </button>
            <a className="btn btn-ghost btn-block" href={wa} target="_blank" rel="noopener">
              <WhatsAppIcon size={20} /> {ui.ask[lang]}
            </a>
            <small>
              <ShieldCheck size={16} /> {ui.trust1[lang]}
            </small>
            <small>
              <CheckCircle2 size={16} /> {ui.trust2[lang]}
            </small>
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="wrap">
          <div className="eyebrow">{ui.faqEyebrow[lang]}</div>
          <h2>{ui.faqTitle[lang]}</h2>
          <div className="faq">
            {faqs.map((f, i) => (
              <details key={f.q.en} open={i === 0}>
                <summary>{f.q[lang]}</summary>
                <p>{f.a[lang]}</p>
              </details>
            ))}
          </div>
          <p className="lead" style={{ marginTop: 16 }}>
            {ui.faqMore[lang]}
          </p>
          <button className="btn btn-wa" style={{ marginTop: 12 }} onClick={() => openSheet('ask')}>
            <WhatsAppIcon size={20} /> {ui.ask[lang]}
          </button>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">
          <p>{ui.footer[lang]}</p>
          <p>{ui.shopifyFees[lang]}</p>
          <p>© 2026 DARTS AI Academy · learn.dartsai.in</p>
          <p>
            <a href="#admin">Admin</a>
          </p>
        </div>
      </footer>

      <div className="buybar">
        <div className="info">
          <b>₹499 · 7-Day Starter</b>
          {settings.seatsTaken > 0 ? `${left} ${ui.seatsLeft[lang]}` : ui.onlySeats[lang]}
        </div>
        <button className="btn btn-primary" onClick={join}>
          {ui.join[lang]}
        </button>
        <a className="btn btn-wa" href={wa} target="_blank" rel="noopener" aria-label={ui.ask[lang]}>
          <WhatsAppIcon />
        </a>
      </div>
    </main>
  )
}
