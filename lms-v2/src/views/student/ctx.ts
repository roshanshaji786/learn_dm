import { createContext, useContext } from 'react'
import { useStore } from '../../lib/store'
import type { Profile } from '../../lib/types'

// Admin "view as student": the student screens render someone else's data, read-only.
export type StudentView = { base: string; preview: boolean; profile: Profile | null }
export const StudentCtx = createContext<StudentView | null>(null)

export function useView(): StudentView {
  const c = useContext(StudentCtx)
  const profile = useStore((s) => s.profile)
  return c ?? { base: '/app', preview: false, profile }
}

export const PREVIEW_MSG = 'Preview only: students do this from their own login'
