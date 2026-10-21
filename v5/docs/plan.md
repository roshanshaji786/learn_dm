# v5 plan (Phase 0)

Built overnight 21–22 Oct 2026 from the RSV master prompt. Roshan confirmed the app is learn.dartsai.in v5.

## Answers used for section 1

| Placeholder | Value |
|---|---|
| APP_NAME | DARTS AI learn v5 |
| APP_SLUG | dartsai-learn-v5 |
| DESCRIPTION | Mobile sales page for the ₹499 AI × Shopify 7-Day Starter, with lead capture and a private leads / students / payments dashboard for Roshan |
| USERS | Buyers: Kerala, mostly Android phones from Meta ads. Admin: Roshan on his phone |
| FEATURES | 1. Sales page EN + ML 2. Lead form → Shopify checkout 3. Leads list with WhatsApp drafts 4. Students and ₹500 follow-up 5. Stats + settings |
| DATA_MODEL | leads (name, phone, place, goal, language, source, utm, status, paid ₹499 / ₹500 / ₹999, follow-up date, notes), settings, admins |
| PUBLIC_DATA | sales copy, seats total/taken, batch start, checkout link |
| PRIVATE_DATA | leads and payments |
| AUTH_MODE | email + password for Roshan (magic link as a fallback), allow-listed in `learn_admins` |
| DOMAIN | the `*.vercel.app` URL for now (no DNS changes) |
| SUPABASE_REGION | ap-south-1 (Mumbai) |
| BRAND | DARTS purple (#6d28d9 / #8b5cf6) on deep violet, Poppins display, Inter body, Anek Malayalam |
| LANGUAGE_AND_CURRENCY | English + Malayalam, ₹, dates as 24 Oct |
| NEEDS_3D | no |
| OFFLINE | the sales page opens from cache; settings fall back to built-in defaults |
| DO_NOT_TOUCH | learn.dartsai.in Shopify store, theme and DNS; ecocart.co.in; roshanshaji.com; EcoCart's own tables in the shared Supabase project |

## Screens

Public
- `#/` sales page: hero, countdown + seats, 7 days, instructor, what you get, trial promise, price, FAQ, sticky Join / WhatsApp bar
- Join sheet (name, WhatsApp, place, what you sell) → Shopify checkout
- Ask sheet → WhatsApp with the question

Admin (`#admin`, bottom tabs)
- Leads: search, filters (today, follow-up due, each status), add a WhatsApp lead, lead sheet with status, payments, notes, call / chat, 4 WhatsApp drafts
- Students: joined count, collected, ₹500 still due
- Stats: funnel, leads per day, sources, sales page settings, sign out

## Deviations from the master prompt (and why)

- **Supabase project is shared.** The free plan allows 2 active projects and both were in use, so the tables live in the `ecocart-v5` project with a `learn_` prefix and their own `learn_private` schema. Moving later = run the migration in a new project, copy rows, change two env vars.
- **Admin auth is email + password** rather than only a magic link, because the shared project's redirect URLs belong to EcoCart and a magic link may land on the wrong site. The magic link button is still there.
- **No bottom tab bar on the sales page.** A sticky Join / WhatsApp bar sells better there; the admin has the tab bar.
- **Domain** stays on vercel.app until Roshan decides to move learn.dartsai.in off Shopify.
