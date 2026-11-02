// Darts LMS admin actions that need the service role: create student logins and reset passwords.
// Callers must be signed in with app_metadata.lms_admin = true, except "bootstrap", which needs a one-time token from lms_bootstrap.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bootstrap-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const url = Deno.env.get('SUPABASE_URL')!
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Readable temporary password: 3 words-ish chunks + digits, no confusing characters.
function tempPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  let s = ''
  for (let i = 0; i < 8; i++) s += abc[bytes[i] % abc.length]
  const n = ((bytes[8] << 8) | bytes[9]) % 9000 + 1000
  return `${s.slice(0, 4)}-${s.slice(4)}-${n}`
}

async function findUserByEmail(email: string) {
  const { data: prof } = await service.from('lms_profiles').select('user_id').ilike('email', email).maybeSingle()
  if (prof) return prof.user_id as string
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => (x.email ?? '').toLowerCase() === email)
    if (u) return u.id
    if (data.users.length < 200) break
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad JSON' }, 400)
  }
  const action = String(body.action ?? '')

  try {
    // One-time: give the allow-listed admin emails a login with the admin flag.
    if (action === 'bootstrap') {
      // The one-time token lives in lms_bootstrap (RLS on, no policies: only the service role can read it).
      const given = req.headers.get('x-bootstrap-token') ?? ''
      const { data: tok } = await service.from('lms_bootstrap').select('token').eq('token', given).maybeSingle()
      if (!given || !tok) return json({ error: 'Not allowed' }, 403)
      await service.from('lms_bootstrap').delete().eq('token', given)
      const { data: admins } = await service.from('learn_admins').select('email')
      const out: Record<string, string> = {}
      for (const a of admins ?? []) {
        const email = String(a.email).toLowerCase()
        const existing = await findUserByEmail(email)
        if (existing) {
          await service.auth.admin.updateUserById(existing, { app_metadata: { lms_admin: true } })
          out[email] = 'flag set (existing login kept)'
        } else {
          const password = tempPassword()
          const { error } = await service.auth.admin.createUser({
            email, password, email_confirm: true, app_metadata: { lms_admin: true }, user_metadata: { must_change_password: true },
          })
          if (error) throw error
          out[email] = password
        }
      }
      return json({ ok: true, admins: out })
    }

    // Everything else: the caller must be an admin.
    const auth = req.headers.get('Authorization') ?? ''
    const jwt = auth.replace(/^Bearer\s+/i, '')
    const { data: who, error: whoErr } = await service.auth.getUser(jwt)
    if (whoErr || !who.user || who.user.app_metadata?.lms_admin !== true) return json({ error: 'Admins only' }, 403)

    if (action === 'create_student') {
      const name = String(body.name ?? '').trim().slice(0, 100)
      const email = String(body.email ?? '').trim().toLowerCase()
      const phone = String(body.phone ?? '').replace(/[^0-9+]/g, '').slice(0, 20)
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Name and a valid email are needed' }, 400)
      let userId = await findUserByEmail(email)
      let password: string | null = null
      if (!userId) {
        password = tempPassword()
        const { data, error } = await service.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { name, must_change_password: true },
        })
        if (error) throw error
        userId = data.user.id
      }
      const { data: existing } = await service.from('lms_profiles').select('user_id').eq('user_id', userId).maybeSingle()
      if (!existing) {
        const { error } = await service.from('lms_profiles').insert({ user_id: userId, name, email, phone: phone || null, must_change_password: Boolean(password) })
        if (error) throw error
      } else {
        await service.from('lms_profiles').update({ name, phone: phone || null }).eq('user_id', userId)
      }
      return json({ ok: true, user_id: userId, temp_password: password, existing: !password })
    }

    if (action === 'reset_password') {
      const userId = String(body.user_id ?? '')
      const password = tempPassword()
      const { error } = await service.auth.admin.updateUserById(userId, { password, user_metadata: { must_change_password: true } })
      if (error) throw error
      await service.from('lms_profiles').update({ must_change_password: true }).eq('user_id', userId)
      return json({ ok: true, temp_password: password })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
