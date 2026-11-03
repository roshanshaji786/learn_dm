export type Course = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  highlights: string[]
  fee: number
  fee_note: string | null
  cover_url: string | null
  published: boolean
  cert_enabled: boolean
  sort: number
}

export type Module = { id: string; course_id: string; title: string; summary: string | null; sort: number }

export type UnlockMode = 'open' | 'date' | 'days' | 'before_class'

export type Lesson = {
  id: string
  course_id: string
  module_id: string
  title: string
  sort: number
  live_start: string | null
  duration_min: number
  unlock_mode: UnlockMode
  unlock_at: string | null
  unlock_days: number | null
  has_assignment: boolean
  assign_max: number | null
  assign_due_days: number | null
  published: boolean
}

export type LessonContent = {
  lesson_id: string
  notes: string | null
  meet_link: string | null
  recording_url: string | null
  assign_text: string | null
}

export type Profile = {
  user_id: string
  name: string
  email: string
  phone: string | null
  lang: 'en' | 'ml'
  must_change_password: boolean
  note: string | null
  created_at: string
}

export type Enrolment = {
  id: string
  user_id: string
  course_id: string
  status: 'active' | 'completed' | 'cancelled'
  total_fee: number
  due_date: string | null
  created_at: string
}

export type Payment = {
  id: string
  enrolment_id: string
  amount: number
  paid_on: string
  method: string
  reference: string | null
  receipt_no: string
  created_at: string
}

export type LessonState = {
  lesson_id: string
  opens_at: string | null
  unlocked: boolean
  fee_locked: boolean
  completed: boolean
  attended: boolean
}

export type Submission = {
  id: string
  user_id: string
  lesson_id: string
  answer: string | null
  link: string | null
  file_path: string | null
  status: 'submitted' | 'graded' | 'redo'
  marks: number | null
  feedback: string | null
  submitted_at: string
  graded_at: string | null
}

export type Certificate = { id: string; code: string; user_id: string; course_id: string; issued_at: string; revoked: boolean }

export type WaGroup = { id: string; name: string; invite_url: string | null }

export type WaRow = {
  id: string
  campaign: string
  kind: 'user' | 'group'
  user_id: string | null
  label: string
  target: string | null
  message: string
  status: 'pending' | 'sent' | 'skipped' | 'no_phone'
  created_at: string
  sent_at: string | null
}

export type Settings = Record<string, string>
