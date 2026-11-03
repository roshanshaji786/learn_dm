// Darts LMS WhatsApp sender.
// Runs on Roshan's laptop as a WhatsApp "linked device" (like WhatsApp Web) and sends the messages that the
// LMS admin put in the send queue with "Send automatically". No WhatsApp Business API, no cost.
//
// Safety rules built in (to keep the number safe):
//   - one message at a time, 25-60 s apart, with "typing..." first
//   - at most DAILY_CAP messages a day, and only between 8 AM and 10 PM IST
//   - checks the number is on WhatsApp before sending; never sends to unknown lists
//
// Start: double-click start.bat (Windows) or run `npm start`.
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys'
import pino from 'pino'
import QRCode from 'qrcode'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const SUPABASE_URL = 'https://fckeyyrdzlrreidttimo.supabase.co'
const ANON_KEY = 'sb_publishable_C97L9oCnkew5n0KYU7Lgcg_ESNQg6mj' // public key, safe to ship
const CONFIG = path.join(DIR, 'config.json')
const AUTH_DIR = path.join(DIR, 'wa-login') // the WhatsApp link. Delete this folder to unlink.
const STATS = path.join(DIR, 'stats.json')

const DAILY_CAP = Number(process.env.WA_DAILY_CAP || 120)
const GAP_MIN_S = 25
const GAP_MAX_S = 60
const START_HOUR = 8 // IST
const END_HOUR = 22 // IST, exclusive

const log = (...a) => console.log(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }), ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rand = (a, b) => a + Math.random() * (b - a)

function istNow() {
  const s = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false })
  const [date, t] = s.split(', ')
  return { date, hour: Number(t.slice(0, 2)) }
}

// ---------- config ----------
function readJSON(f, d) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return d
  }
}
async function getKey() {
  const c = readJSON(CONFIG, {})
  if (process.env.WA_SENDER_KEY) return process.env.WA_SENDER_KEY.trim()
  if (c.key) return c.key
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  console.log('\nFirst time setup.')
  console.log('In the LMS admin, open WhatsApp > Auto sender > "Make sender key", copy it and paste it here.\n')
  const key = (await rl.question('Sender key: ')).trim()
  rl.close()
  if (!/^wa_[0-9a-f]{48}$/.test(key)) {
    console.log('That does not look like a sender key (it starts with wa_). Run me again.')
    process.exit(1)
  }
  fs.writeFileSync(CONFIG, JSON.stringify({ key }, null, 2))
  return key
}

// ---------- LMS (Supabase RPC) ----------
let KEY = ''
async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key: KEY, ...args }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = body?.message || `HTTP ${res.status}`
    if (/Not allowed/.test(msg)) {
      log('The sender key was replaced or removed in the LMS. Make a new key in the admin and run me again.')
      try {
        fs.unlinkSync(CONFIG)
      } catch {}
      process.exit(2)
    }
    throw new Error(msg)
  }
  return body
}

let state = 'starting'
let info = ''
let phone = ''
function stats() {
  const s = readJSON(STATS, {})
  const { date } = istNow()
  return s.date === date ? s : { date, sent: 0 }
}
function addSent() {
  const s = stats()
  s.sent++
  fs.writeFileSync(STATS, JSON.stringify(s))
}
async function beat() {
  try {
    await rpc('lms_wa_beat', { p_state: state, p_phone: phone, p_info: info, p_sent_today: stats().sent })
  } catch (e) {
    log('Could not reach the LMS:', e.message)
  }
}
function setState(s, i = '') {
  state = s
  info = i
  void beat()
}

// ---------- WhatsApp ----------
let sock = null
let ready = false
const groupIds = new Map()

async function connect() {
  const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))
  sock = makeWASocket({
    auth,
    version,
    logger: pino({ level: 'silent' }),
    browser: Browsers.windows('Darts LMS'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async (u) => {
    if (u.qr) {
      ready = false
      setState('need_link', 'Scan the QR on the laptop with WhatsApp > Linked devices')
      const png = path.join(DIR, 'link-whatsapp.png')
      await QRCode.toFile(png, u.qr, { width: 420, margin: 2 })
      console.log(await QRCode.toString(u.qr, { type: 'terminal', small: true }))
      log('On your phone: WhatsApp > Settings > Linked devices > Link a device, then scan this QR.')
      log('(If the QR above looks broken, open link-whatsapp.png in this folder.)')
      if (process.platform === 'win32') exec(`start "" "${png}"`)
    }
    if (u.connection === 'open') {
      ready = true
      phone = (sock.user?.id || '').split(':')[0].split('@')[0]
      try {
        fs.unlinkSync(path.join(DIR, 'link-whatsapp.png'))
      } catch {}
      log(`Linked to WhatsApp +${phone}. Sending is ON. Keep this window open.`)
      setState('ready', `Linked to +${phone}`)
    }
    if (u.connection === 'close') {
      ready = false
      const code = u.lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        log('WhatsApp unlinked this laptop. Linking again...')
        fs.rmSync(AUTH_DIR, { recursive: true, force: true })
        setState('need_link', 'Unlinked from the phone. Scan the QR again.')
      } else {
        setState('starting', 'Reconnecting to WhatsApp')
      }
      setTimeout(() => connect().catch((e) => log('Connect failed:', e.message)), code === DisconnectReason.loggedOut ? 1000 : 5000)
    }
  })
}

async function jidFor(row) {
  if (row.kind === 'group') {
    const m = String(row.target || '').match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]+)/)
    if (!m) throw new Error('No invite link saved for this group (add it in Groups)')
    if (!groupIds.has(m[1])) groupIds.set(m[1], (await sock.groupGetInviteInfo(m[1])).id)
    return groupIds.get(m[1])
  }
  const n = String(row.target || '').replace(/\D/g, '')
  if (n.length < 11) throw new Error('No full WhatsApp number')
  const [r] = (await sock.onWhatsApp(n)) || []
  if (!r?.exists) throw new Error('This number is not on WhatsApp')
  return r.jid
}

async function sendOne(row) {
  const jid = await jidFor(row)
  await sock.presenceSubscribe(jid).catch(() => {})
  await sock.sendPresenceUpdate('composing', jid).catch(() => {})
  await sleep(rand(2000, Math.min(7000, 1500 + row.message.length * 25)))
  await sock.sendPresenceUpdate('paused', jid).catch(() => {})
  await sock.sendMessage(jid, { text: row.message })
}

async function loop() {
  for (;;) {
    try {
      const { hour } = istNow()
      if (!ready) {
        await sleep(5000)
        continue
      }
      if (hour < START_HOUR || hour >= END_HOUR) {
        if (state !== 'paused') setState('paused', `Night pause. Sends again from ${START_HOUR} AM IST.`)
        await sleep(60000)
        continue
      }
      if (stats().sent >= DAILY_CAP) {
        if (state !== 'paused') setState('paused', `Reached today's limit of ${DAILY_CAP}. Continues tomorrow.`)
        await sleep(60000)
        continue
      }
      if (state === 'paused') setState('ready', `Linked to +${phone}`)
      const rows = await rpc('lms_wa_next', {})
      const row = rows?.[0]
      if (!row) {
        await sleep(15000)
        continue
      }
      try {
        await sendOne(row)
        await rpc('lms_wa_done', { p_id: row.id, p_status: 'sent', p_error: null })
        addSent()
        log(`Sent (${row.kind === 'group' ? 'group' : '+' + row.target})`)
      } catch (e) {
        const permanent = /not on WhatsApp|No full WhatsApp|invite link|not-authorized|item-not-found|forbidden/i.test(e.message)
        await rpc('lms_wa_done', { p_id: row.id, p_status: permanent ? 'failed' : 'pending', p_error: e.message.slice(0, 280) })
        log(`Could not send (${row.kind === 'group' ? 'group' : '+' + row.target}): ${e.message}`)
      }
      await sleep(rand(GAP_MIN_S, GAP_MAX_S) * 1000)
    } catch (e) {
      log('Problem:', e.message)
      await sleep(20000)
    }
  }
}

async function main() {
  console.log('Darts LMS WhatsApp sender\n')
  KEY = await getKey()
  await rpc('lms_wa_beat', { p_state: 'starting', p_phone: '', p_info: 'Starting', p_sent_today: stats().sent })
  log('Connected to the LMS.')
  setInterval(beat, 60000)
  const bye = async () => {
    state = 'offline'
    info = 'Sender closed'
    await beat()
    process.exit(0)
  }
  process.on('SIGINT', bye)
  process.on('SIGTERM', bye)
  await connect()
  await loop()
}

main().catch((e) => {
  console.error('Stopped:', e.message)
  process.exit(1)
})
