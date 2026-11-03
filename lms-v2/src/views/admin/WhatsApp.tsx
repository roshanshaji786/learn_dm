import { useEffect, useMemo, useState } from 'react'
import { Send, Plus, Trash, Users, Check, SkipForward, Search } from 'lucide-react'
import { supabase, errText } from '../../lib/supabase'
import { useLoad } from '../../lib/useLoad'
import { useStore } from '../../lib/store'
import { go } from '../../lib/route'
import { when, time, day, waLink, waNumber, money, todayIST } from '../../lib/format'
import { useTitle, Skel, Empty, Sheet, Field } from '../../components/ui'
import { all, loadRoster, paid, type Lesson, type WaGroup } from './data'
import type { WaRow } from '../../lib/types'

const APP = 'https://lms.roshanshaji.com'

export default function WhatsApp({ tab, preset }: { tab?: string; preset?: string }) {
  useTitle('WhatsApp')
  const t = tab === 'queue' || tab === 'groups' ? tab : 'compose'
  return (
    <>
      <div className="page-h">
        <h1>WhatsApp</h1>
      </div>
      <div className="chips">
        <button aria-pressed={t === 'compose'} onClick={() => go('/admin/wa')}>
          Compose
        </button>
        <button aria-pressed={t === 'queue'} onClick={() => go('/admin/wa/queue')}>
          Send queue
        </button>
        <button aria-pressed={t === 'groups'} onClick={() => go('/admin/wa/groups')}>
          Groups
        </button>
      </div>
      {t === 'compose' && <Compose lessonId={tab === 'compose' ? preset : undefined} />}
      {t === 'queue' && <Queue />}
      {t === 'groups' && <Groups />}
    </>
  )
}

function Compose({ lessonId }: { lessonId?: string }) {
  const say = useStore((s) => s.say)
  const { data } = useLoad(async () => {
    const [r, groups, lesson] = await Promise.all([
      loadRoster(),
      all<WaGroup[]>(supabase.from('lms_wa_groups').select('*').order('name')),
      lessonId ? supabase.from('lms_lessons').select('*').eq('id', lessonId).single() : Promise.resolve({ data: null }),
    ])
    let link = ''
    if (lessonId) link = (await supabase.from('lms_lesson_content').select('meet_link').eq('lesson_id', lessonId).maybeSingle()).data?.meet_link ?? ''
    return { r, groups, lesson: lesson.data as Lesson | null, link }
  }, [lessonId])
  const [msg, setMsg] = useState('')
  const [link, setLink] = useState('')
  const [aud, setAud] = useState<string>('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [groups, setGroups] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!data) return
    if (data.lesson) {
      setLink(data.link)
      setAud('course:' + data.lesson.course_id)
      setMsg(
        `Hi {name} 👋\n\nToday's live class: *${data.lesson.title}*\n🕘 ${data.lesson.live_start ? `${day(data.lesson.live_start)}, ${time(data.lesson.live_start)} IST` : ''}\n\nJoin from the app (marks your attendance): ${APP}/#/app/lesson/${data.lesson.id}${data.link ? '\nOr join directly: {link}' : ''}\n\nSee you there!`,
      )
    } else if (data.r.courses[0] && !aud) setAud('course:' + data.r.courses[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const today = todayIST()
  const audience = useMemo(() => {
    if (!data) return []
    const r = data.r
    const active = r.enrolments.filter((e) => e.status !== 'cancelled')
    let ids: string[] = []
    if (aud.startsWith('course:')) ids = active.filter((e) => e.course_id === aud.slice(7)).map((e) => e.user_id)
    else if (aud === 'due') ids = active.filter((e) => Number(e.total_fee) - paid(r, e.id) > 0).map((e) => e.user_id)
    else if (aud === 'overdue') ids = active.filter((e) => e.due_date && e.due_date < today && Number(e.total_fee) - paid(r, e.id) > 0).map((e) => e.user_id)
    else if (aud === 'all') ids = r.profiles.map((p) => p.user_id)
    const set = new Set([...ids, ...picked])
    return r.profiles.filter((p) => set.has(p.user_id))
  }, [data, aud, picked, today])

  if (!data) return <Skel n={4} />

  function personal(name: string, uid: string) {
    const r = data!.r
    const bal = r.enrolments.filter((e) => e.user_id === uid && e.status !== 'cancelled').reduce((a, e) => a + Number(e.total_fee) - paid(r, e.id), 0)
    return msg.replaceAll('{name}', name.split(' ')[0]).replaceAll('{link}', link).replaceAll('{balance}', money(bal))
  }

  async function queue() {
    if (!msg.trim()) return say('Write a message first', true)
    const campaign = crypto.randomUUID()
    const rows = [
      ...audience.map((p) => ({ campaign, kind: 'user', user_id: p.user_id, label: p.name, target: waNumber(p.phone) || null, message: personal(p.name, p.user_id), status: waNumber(p.phone) ? 'pending' : 'no_phone' })),
      ...data!.groups.filter((g) => groups.has(g.id)).map((g) => ({ campaign, kind: 'group', user_id: null, label: g.name, target: g.invite_url, message: msg.replaceAll('{name}', 'everyone').replaceAll('{link}', link).replaceAll('{balance}', ''), status: 'pending' })),
    ]
    if (!rows.length) return say('Pick who to send to', true)
    setBusy(true)
    const r = await supabase.from('lms_wa_queue').insert(rows)
    setBusy(false)
    if (r.error) return say(errText(r.error), true)
    go('/admin/wa/queue')
  }

  const ql = q.trim().toLowerCase()
  return (
    <>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => setMsg('Hi {name} 👋\n\n')}>
          Blank
        </button>
        <button type="button" onClick={() => setMsg(`Hi {name}, a gentle reminder that {balance} is still due for your course. You can pay by UPI to 7012045854@apl and send me the screenshot here. Thank you! 🙏`)}>
          Fee reminder
        </button>
        <button type="button" onClick={() => setMsg(`Hi {name}, the recording and notes for today's class are now in the app: ${APP}/#/app/learn`)}>
          Recording ready
        </button>
      </div>
      <Field label="Message" hint="{name} becomes each student's first name, {link} the link below, {balance} their fee balance.">
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={8} maxLength={3800} />
      </Field>
      <Field label="Link for {link} (Meet or anything else)">
        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" />
      </Field>

      <h2 className="h-sub">Send to</h2>
      <div className="chips">
        {data.r.courses.map((c) => (
          <button key={c.id} aria-pressed={aud === 'course:' + c.id} onClick={() => setAud(aud === 'course:' + c.id ? '' : 'course:' + c.id)}>
            {c.title.length > 26 ? c.title.slice(0, 24) + '…' : c.title}
          </button>
        ))}
        <button aria-pressed={aud === 'due'} onClick={() => setAud(aud === 'due' ? '' : 'due')}>
          Fee due
        </button>
        <button aria-pressed={aud === 'overdue'} onClick={() => setAud(aud === 'overdue' ? '' : 'overdue')}>
          Overdue
        </button>
        <button aria-pressed={aud === 'all'} onClick={() => setAud(aud === 'all' ? '' : 'all')}>
          Everyone
        </button>
      </div>
      <details className="card" style={{ padding: '4px 14px' }}>
        <summary className="linkish">
          <Users size={16} /> Add people one by one {picked.size ? `(${picked.size})` : ''}
        </summary>
        <div className="search-wrap" style={{ margin: '6px 0 10px' }}>
          <Search size={18} />
          <input className="search" type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="list" style={{ maxHeight: 300, overflowY: 'auto', paddingBottom: 10 }}>
          {data.r.profiles
            .filter((p) => !ql || p.name.toLowerCase().includes(ql) || (p.phone ?? '').includes(ql))
            .map((p) => (
              <label className="att" key={p.user_id}>
                <span className="ellipsis">{p.name}</span>
                <input
                  type="checkbox"
                  checked={picked.has(p.user_id)}
                  onChange={(e) => {
                    const n = new Set(picked)
                    if (e.target.checked) n.add(p.user_id)
                    else n.delete(p.user_id)
                    setPicked(n)
                  }}
                />
              </label>
            ))}
        </div>
      </details>
      {data.groups.length > 0 && (
        <>
          <h2 className="h-sub">Groups</h2>
          <div className="list">
            {data.groups.map((g) => (
              <label className="att" key={g.id}>
                <span className="ellipsis">{g.name}</span>
                <input
                  type="checkbox"
                  checked={groups.has(g.id)}
                  onChange={(e) => {
                    const n = new Set(groups)
                    if (e.target.checked) n.add(g.id)
                    else n.delete(g.id)
                    setGroups(n)
                  }}
                />
              </label>
            ))}
          </div>
        </>
      )}
      <p className="small muted mt12">
        {audience.length} student{audience.length === 1 ? '' : 's'}
        {audience.filter((p) => !waNumber(p.phone)).length ? ` (${audience.filter((p) => !waNumber(p.phone)).length} without a number)` : ''}
        {groups.size ? ` + ${groups.size} group${groups.size > 1 ? 's' : ''}` : ''}
      </p>
      {audience[0] && msg && (
        <>
          <h2 className="h-sub">Preview</h2>
          <pre className="card prose small" style={{ margin: 0 }}>
            {personal(audience[0].name, audience[0].user_id)}
          </pre>
        </>
      )}
      <button className="btn btn-primary btn-block mt16" onClick={queue} disabled={busy}>
        <Send size={18} /> Add to send queue
      </button>
      <p className="tiny muted center mt8">WhatsApp doesn't allow automatic sending for free, so the queue opens each chat with the message ready. You tap Send.</p>
    </>
  )
}

function Queue() {
  const say = useStore((s) => s.say)
  const { data, reload, setData } = useLoad(() => all<WaRow[]>(supabase.from('lms_wa_queue').select('*').order('created_at', { ascending: false }).limit(400)), [])
  if (!data) return <Skel n={4} />
  const pending = data.filter((r) => r.status === 'pending')
  const camps = [...new Set(data.map((r) => r.campaign))]

  async function mark(r: WaRow, status: WaRow['status']) {
    setData(data!.map((x) => (x.id === r.id ? { ...x, status, sent_at: new Date().toISOString() } : x)))
    const u = await supabase.from('lms_wa_queue').update({ status, sent_at: status === 'sent' ? new Date().toISOString() : null }).eq('id', r.id)
    if (u.error) {
      say(errText(u.error), true)
      await reload()
    }
  }
  function send(r: WaRow) {
    if (r.kind === 'user') window.open(waLink(r.target, r.message), '_blank')
    else {
      void navigator.clipboard?.writeText(r.message).catch(() => {})
      window.open(`https://wa.me/?text=${encodeURIComponent(r.message)}`, '_blank')
      say('Pick the group in WhatsApp. The message is also copied.')
    }
    void mark(r, 'sent')
  }
  async function clear(c: string) {
    if (!confirm('Delete this batch from the history?')) return
    await supabase.from('lms_wa_queue').delete().eq('campaign', c)
    await reload()
  }

  return (
    <>
      <h2 className="h-sub">
        To send <span>{pending.length}</span>
      </h2>
      {pending.length ? (
        <div className="list">
          {pending.map((r) => (
            <div className="item noicon" key={r.id} style={{ cursor: 'default' }}>
              <span style={{ minWidth: 0 }}>
                <div className="t ellipsis">
                  {r.kind === 'group' ? '👥 ' : ''}
                  {r.label}
                </div>
                <div className="s">{r.message.replace(/\s+/g, ' ').slice(0, 60)}</div>
              </span>
              <span className="row nowrap">
                <button className="icon-btn plain" aria-label="Skip" onClick={() => void mark(r, 'skipped')}>
                  <SkipForward size={18} />
                </button>
                <button className="btn btn-sm btn-wa" onClick={() => send(r)}>
                  <Send size={16} /> Send
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<Check size={32} />}>Nothing waiting. Compose a message to start a batch.</Empty>
      )}
      {camps.length > 0 && <h2 className="h-sub">History</h2>}
      <div className="list">
        {camps.slice(0, 20).map((c) => {
          const rs = data.filter((r) => r.campaign === c)
          const count = (s: string) => rs.filter((r) => r.status === s).length
          return (
            <div className="item noicon" key={c} style={{ cursor: 'default' }}>
              <span style={{ minWidth: 0 }}>
                <div className="t ellipsis">{rs[0].message.replace(/\s+/g, ' ').slice(0, 50)}</div>
                <div className="s">
                  {when(rs[0].created_at)} · {count('sent')} sent · {count('pending')} waiting{count('skipped') ? ` · ${count('skipped')} skipped` : ''}
                  {count('no_phone') ? ` · ${count('no_phone')} no number` : ''}
                </div>
              </span>
              <button className="icon-btn plain" aria-label="Delete batch" onClick={() => void clear(c)}>
                <Trash size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

function Groups() {
  const say = useStore((s) => s.say)
  const { data, reload } = useLoad(() => all<WaGroup[]>(supabase.from('lms_wa_groups').select('*').order('name')), [])
  const [edit, setEdit] = useState<Partial<WaGroup> | null>(null)
  if (!data) return <Skel n={3} />
  async function save(e: React.FormEvent) {
    e.preventDefault()
    const row = { name: edit!.name!.trim(), invite_url: edit!.invite_url?.trim() || null }
    const r = edit!.id ? await supabase.from('lms_wa_groups').update(row).eq('id', edit!.id) : await supabase.from('lms_wa_groups').insert(row)
    if (r.error) return say(errText(r.error), true)
    setEdit(null)
    await reload()
  }
  async function del(g: WaGroup) {
    if (!confirm(`Remove ${g.name}?`)) return
    await supabase.from('lms_wa_groups').delete().eq('id', g.id)
    await reload()
  }
  return (
    <>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Save your class WhatsApp groups here so you can include them when you send a message.
      </p>
      {data.length ? (
        <div className="list">
          {data.map((g) => (
            <div className="item noicon" key={g.id}>
              <button className="linkish" style={{ justifyContent: 'flex-start', color: 'var(--text)', minWidth: 0 }} onClick={() => setEdit(g)}>
                <span className="ellipsis">{g.name}</span>
              </button>
              <button className="icon-btn plain" aria-label="Delete" onClick={() => void del(g)}>
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<Users size={32} />}>No groups saved yet.</Empty>
      )}
      <button className="btn btn-ghost btn-block mt12" onClick={() => setEdit({ name: '', invite_url: '' })}>
        <Plus size={16} /> Add group
      </button>
      {edit && (
        <Sheet title={edit.id ? 'Edit group' : 'Add group'} onClose={() => setEdit(null)}>
          <form onSubmit={save}>
            <Field label="Group name">
              <input required value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={100} />
            </Field>
            <Field label="Invite link (optional)" hint="chat.whatsapp.com/… so you can share it with new students">
              <input type="url" value={edit.invite_url ?? ''} onChange={(e) => setEdit({ ...edit, invite_url: e.target.value })} />
            </Field>
            <button className="btn btn-primary btn-block">Save</button>
          </form>
        </Sheet>
      )}
    </>
  )
}
