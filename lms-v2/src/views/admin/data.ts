import { supabase } from '../../lib/supabase'
import { must } from '../../lib/useLoad'
import type { Course, Enrolment, Lesson, Module, Payment, Profile, Submission, WaGroup } from '../../lib/types'

export const all = async <T,>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>) => must(await q) as T

export type Roster = {
  profiles: Profile[]
  enrolments: Enrolment[]
  payments: Payment[]
  courses: Course[]
}

export async function loadRoster(): Promise<Roster> {
  const [profiles, enrolments, payments, courses] = await Promise.all([
    all<Profile[]>(supabase.from('lms_profiles').select('*').order('created_at', { ascending: false })),
    all<Enrolment[]>(supabase.from('lms_enrolments').select('*').order('created_at')),
    all<Payment[]>(supabase.from('lms_payments').select('*').order('paid_on', { ascending: false })),
    all<Course[]>(supabase.from('lms_courses').select('*').order('sort')),
  ])
  return { profiles, enrolments, payments, courses }
}

export function paid(r: { payments: Payment[] }, enrolmentId: string) {
  return r.payments.filter((p) => p.enrolment_id === enrolmentId).reduce((a, p) => a + Number(p.amount), 0)
}

export async function loadCourseTree(courseId?: string) {
  const qc = supabase.from('lms_courses').select('*').order('sort')
  const qm = supabase.from('lms_modules').select('*').order('sort')
  const ql = supabase.from('lms_lessons').select('*').order('sort')
  const [courses, modules, lessons] = await Promise.all([
    all<Course[]>(courseId ? qc.eq('id', courseId) : qc),
    all<Module[]>(courseId ? qm.eq('course_id', courseId) : qm),
    all<Lesson[]>(courseId ? ql.eq('course_id', courseId) : ql),
  ])
  const order = new Map(modules.map((m, i) => [m.id, i]))
  lessons.sort((a, b) => (order.get(a.module_id) ?? 0) - (order.get(b.module_id) ?? 0) || a.sort - b.sort)
  return { courses, modules, lessons }
}

export type { Course, Enrolment, Lesson, Module, Payment, Profile, Submission, WaGroup }

export function loginMessage(name: string, phone: string, pin: string) {
  return `Hi ${name.split(' ')[0]}, welcome to Darts AI Academy! 🎉

Your learning app: https://lms.roshanshaji.com/#/login
WhatsApp number: ${phone.replace(/\D/g, '').slice(-10)}
PIN: ${pin}

Your classes, recordings, notes, assignments and fee receipts are all there. Add the app to your home screen so classes are one tap away. Please keep your PIN private.`
}
