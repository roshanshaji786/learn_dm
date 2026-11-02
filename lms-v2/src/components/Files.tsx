import { useRef, useState } from 'react'
import { FileText, Upload, Trash, Download, FileVideo, FileImage } from 'lucide-react'
import { supabase, errText } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import { useStore } from '../lib/store'

const BUCKET = 'lms-materials'
const MAX = 50 * 1024 * 1024

type F = { name: string; size: number; type: string }

const label = (n: string) => n.replace(/^\d{10,}-/, '')
const size = (b: number) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')
const icon = (t: string) => (t.startsWith('video') ? <FileVideo size={20} /> : t.startsWith('image') ? <FileImage size={20} /> : <FileText size={20} />)

async function list(lessonId: string): Promise<F[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(lessonId, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
  if (error) throw error
  return (data ?? []).filter((o) => o.id && o.name !== '.emptyFolderPlaceholder').map((o) => ({ name: o.name, size: Number(o.metadata?.size ?? 0), type: String(o.metadata?.mimetype ?? '') }))
}

async function open(lessonId: string, name: string, say: (t: string, b?: boolean) => void) {
  const w = window.open('', '_blank')
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(`${lessonId}/${name}`, 3600)
  if (error) {
    w?.close()
    return say(errText(error), true)
  }
  if (w) w.location.href = data.signedUrl
  else location.href = data.signedUrl
}

// Students: files Roshan uploaded to this lesson (readable only when the lesson is open for them).
export function LessonFiles({ lessonId, title }: { lessonId: string; title: string }) {
  const say = useStore((s) => s.say)
  const { data } = useLoad(() => list(lessonId), [lessonId])
  if (!data?.length) return null
  return (
    <>
      <h2 className="h-sub">{title}</h2>
      <div className="list">
        {data.map((f) => (
          <button className="item" key={f.name} onClick={() => void open(lessonId, f.name, say)}>
            <span className="ic">{icon(f.type)}</span>
            <span style={{ minWidth: 0 }}>
              <div className="t ellipsis">{label(f.name)}</div>
              <div className="s">{size(f.size)}</div>
            </span>
            <Download size={18} className="muted" />
          </button>
        ))}
      </div>
    </>
  )
}

// Admin: upload and remove lesson files.
export function AdminFiles({ lessonId }: { lessonId: string }) {
  const say = useStore((s) => s.say)
  const { data, reload } = useLoad(() => list(lessonId), [lessonId])
  const [busy, setBusy] = useState('')
  const input = useRef<HTMLInputElement>(null)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    for (const file of Array.from(files)) {
      if (file.size > MAX) {
        say(`${file.name} is over 50 MB. Put big videos on YouTube (unlisted) or Google Drive and paste the link as the recording.`, true)
        continue
      }
      setBusy(file.name)
      const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-90)
      const { error } = await supabase.storage.from(BUCKET).upload(`${lessonId}/${Date.now()}-${safe}`, file, { contentType: file.type || undefined })
      if (error) say(`${file.name}: ${errText(error)}`, true)
    }
    setBusy('')
    if (input.current) input.current.value = ''
    await reload()
    say('Uploaded')
  }
  async function remove(name: string) {
    if (!confirm(`Delete ${label(name)}?`)) return
    const { error } = await supabase.storage.from(BUCKET).remove([`${lessonId}/${name}`])
    if (error) return say(errText(error), true)
    await reload()
  }

  return (
    <div className="card">
      {data?.length ? (
        <div className="list" style={{ marginBottom: 12 }}>
          {data.map((f) => (
            <div className="item" key={f.name} style={{ cursor: 'default' }}>
              <span className="ic">{icon(f.type)}</span>
              <button className="linkish" style={{ minWidth: 0, color: 'var(--text)', justifyContent: 'flex-start', padding: 0 }} onClick={() => void open(lessonId, f.name, say)}>
                <span style={{ minWidth: 0, textAlign: 'left' }}>
                  <div className="t ellipsis">{label(f.name)}</div>
                  <div className="s">{size(f.size)}</div>
                </span>
              </button>
              <button className="icon-btn plain" aria-label="Delete file" onClick={() => void remove(f.name)}>
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="small muted" style={{ marginBottom: 12 }}>
          No files yet. Add notes, PDFs, slides, worksheets or short videos (up to 50 MB each).
        </p>
      )}
      <input ref={input} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} />
      <button type="button" className="btn btn-ghost btn-block" disabled={!!busy} onClick={() => input.current?.click()}>
        <Upload size={16} /> {busy ? `Uploading ${label(busy)}…` : 'Upload files'}
      </button>
      <p className="tiny muted mt8">Students see these only when the lesson is open for them and their fee isn't overdue.</p>
    </div>
  )
}
