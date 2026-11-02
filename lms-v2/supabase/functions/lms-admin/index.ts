// Darts LMS actions that need the service role: PIN login, create student logins, set PINs and reset passwords.
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

function randomPin() {
  return String(crypto.getRandomValues(new Uint16Array(1))[0] % 9000 + 1000)
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

    // PIN login: admin (PIN only) or student (WhatsApp number + PIN). Returns a one-time token the app exchanges for a session.
    if (action === 'pin_login') {
      const role = body.role === 'admin' ? 'admin' : 'student'
      const pin = String(body.pin ?? '')
      const phone = String(body.phone ?? '')
      if (!/^\d{4,8}$/.test(pin)) return json({ error: 'Enter your PIN' }, 400)
      const { data, error } = await service.rpc('lms_pin_check', { p_role: role, p_phone: phone, p_pin: pin })
      if (error) throw error
      const row = (data ?? [])[0] as { user_id: string | null; status: string } | undefined
      const st = row?.status ?? 'unknown'
      if (st === 'locked') return json({ error: 'Too many wrong tries. Wait 15 minutes and try again.' }, 429)
      if (st === 'disabled') return json({ error: 'This PIN is blocked after too many wrong tries. Ask Roshan for a new PIN.' }, 423)
      if (st !== 'ok' || !row?.user_id) {
        await new Promise((r) => setTimeout(r, 600))
        return json({ error: role === 'admin' ? 'Wrong PIN' : 'Wrong number or PIN' }, 401)
      }
      const { data: u, error: ue } = await service.auth.admin.getUserById(row.user_id)
      if (ue || !u.user?.email) throw ue ?? new Error('Login not found')
      const { data: link, error: le } = await service.auth.admin.generateLink({ type: 'magiclink', email: u.user.email })
      if (le) throw le
      return json({ ok: true, token_hash: link.properties.hashed_token })
    }

    // Everything else: the caller must be an admin.
    const auth = req.headers.get('Authorization') ?? ''
    const jwt = auth.replace(/^Bearer\s+/i, '')
    const { data: who, error: whoErr } = await service.auth.getUser(jwt)
    if (whoErr || !who.user || who.user.app_metadata?.lms_admin !== true) return json({ error: 'Admins only' }, 403)

    if (action === 'create_student') {
      const name = String(body.name ?? '').trim().slice(0, 100)
      const phone = String(body.phone ?? '').replace(/[^0-9+]/g, '').slice(0, 20)
      const digits = phone.replace(/\D/g, '').slice(-10)
      // Email is optional: students log in with their WhatsApp number + PIN, so a placeholder address is used when none is given.
      let email = String(body.email ?? '').trim().toLowerCase()
      if (!email && digits.length === 10) email = `${digits}.${crypto.randomUUID().slice(0, 6)}@students.roshanshaji.com`
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Name and a 10-digit WhatsApp number (or an email) are needed' }, 400)
      let userId: string | null = null
      if (!String(body.email ?? '').trim() && digits.length === 10) {
        // Same WhatsApp number already a student: reuse that login.
        const { data: same } = await service.from('lms_profiles').select('user_id').like('phone', `%${digits}`).limit(1)
        userId = same?.[0]?.user_id ?? null
      }
      if (!userId) userId = await findUserByEmail(email)
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
      let pin: string | null = null
      if (body.with_pin !== false && digits.length === 10) {
        pin = String(body.pin ?? '') || randomPin()
        const { error } = await service.rpc('lms_pin_set', { p_user: userId, p_pin: pin, p_admin: false })
        if (error) throw error
        await service.from('lms_profiles').update({ must_change_password: false }).eq('user_id', userId)
      }
      return json({ ok: true, user_id: userId, temp_password: password, pin, existing: !password })
    }

    if (action === 'set_pin') {
      const userId = String(body.user_id ?? '') || who.user.id
      const self = userId === who.user.id
      const pin = String(body.pin ?? '') || randomPin()
      const { error } = await service.rpc('lms_pin_set', { p_user: userId, p_pin: pin, p_admin: self })
      if (error) throw error
      if (!self) await service.from('lms_profiles').update({ must_change_password: false }).eq('user_id', userId)
      return json({ ok: true, pin })
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
