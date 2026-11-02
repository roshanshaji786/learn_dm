import { supabase } from '../../lib/supabase'
import { must } from '../../lib/useLoad'
import type { Certificate, Course, Enrolment, Lesson, LessonState, Module, Payment, Submission } from '../../lib/types'

export type StudentData = {
  enrolments: Enrolment[]
  courses: Course[]
  modules: Module[]
  lessons: Lesson[]
  states: Record<string, LessonState>
  payments: Payment[]
  submissions: Submission[]
  certificates: Certificate[]
}

export async function loadStudent(userId: string): Promise<StudentData> {
  const enrolments = (must(await supabase.from('lms_enrolments').select('*').eq('user_id', userId).neq('status', 'cancelled').order('created_at')) as Enrolment[]) ?? []
  const ids = enrolments.map((e) => e.course_id)
  if (!ids.length) return { enrolments, courses: [], modules: [], lessons: [], states: {}, payments: [], submissions: [], certificates: [] }
  const [c, m, l, p, s, ce, ...st] = await Promise.all([
    supabase.from('lms_courses').select('*').in('id', ids).order('sort'),
    supabase.from('lms_modules').select('*').in('course_id', ids).order('sort'),
    supabase.from('lms_lessons').select('*').in('course_id', ids).eq('published', true).order('sort'),
    supabase.from('lms_payments').select('*').in('enrolment_id', enrolments.map((e) => e.id)).order('paid_on', { ascending: false }),
    supabase.from('lms_submissions').select('*').eq('user_id', userId),
    supabase.from('lms_certificates').select('*').eq('user_id', userId),
    ...ids.map((id) => supabase.rpc('lms_my_lessons', { p_course: id })),
  ])
  const states: Record<string, LessonState> = {}
  for (const r of st) for (const row of (must(r) as LessonState[]) ?? []) states[row.lesson_id] = row
  const modules = must(m) as Module[]
  const order = new Map(modules.map((x, i) => [x.id, i]))
  const lessons = (must(l) as Lesson[]).sort((a, b) => (order.get(a.module_id) ?? 0) - (order.get(b.module_id) ?? 0) || a.sort - b.sort)
  return {
    enrolments,
    courses: must(c) as Course[],
    modules,
    lessons,
    states,
    payments: must(p) as Payment[],
    submissions: must(s) as Submission[],
    certificates: must(ce) as Certificate[],
  }
}

export function paidFor(d: StudentData, enrolmentId: string) {
  return d.payments.filter((p) => p.enrolment_id === enrolmentId).reduce((a, p) => a + Number(p.amount), 0)
}

// The class to show on Today: one that is on now, or the next one coming.
export function nextLive(lessons: Lesson[]) {
  const now = Date.now()
  return lessons
    .filter((l) => l.live_start && new Date(l.live_start).getTime() + l.duration_min * 60000 > now)
    .sort((a, b) => new Date(a.live_start!).getTime() - new Date(b.live_start!).getTime())[0]
}

export function joinOpen(l: Lesson) {
  if (!l.live_start) return false
  const s = new Date(l.live_start).getTime()
  const now = Date.now()
  return now >= s - 10 * 60000 && now <= s + l.duration_min * 60000
}

export function gcalLink(l: Lesson, course: string) {
  const s = new Date(l.live_start!)
  const e = new Date(s.getTime() + l.duration_min * 60000)
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${l.title} · ${course}`,
    dates: `${f(s)}/${f(e)}`,
    details: `Live class. Join from the Darts AI Academy app: ${location.origin}/#/app/lesson/${l.id}`,
  })
  return `https://calendar.google.com/calendar/render?${q}`
}

export function upiLink(upi: string, amount: number, name: string, note: string) {
  const q = new URLSearchParams({ pa: upi, pn: name, am: String(Math.round(amount * 100) / 100), cu: 'INR', tn: note.slice(0, 60) })
  return `upi://pay?${q}`
}

export async function joinClass(lessonId: string) {
  // Open the tab first so phone browsers don't block it as a popup.
  const w = window.open('', '_blank')
  const { data, error } = await supabase.rpc('lms_join', { p_lesson: lessonId })
  if (error || !data) {
    w?.close()
    throw new Error(error?.message || 'No class link yet')
  }
  if (w) w.location.href = data as string
  else location.href = data as string
}
