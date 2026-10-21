# DARTS AI learn v5

Version 5 of **learn.dartsai.in**, rebuilt as an RSV app (React + Supabase + Vercel).

- **Sales page** for the AI × Shopify 7-Day Starter (₹499 to join, ₹500 after Day 2, or ₹999 once), mobile first, in English and Malayalam (`?lang=ml` or the EN / മല switch).
- **Lead form**: "Join for ₹499" saves name + WhatsApp number to Supabase, then sends the buyer to the existing Shopify checkout. "Ask on WhatsApp" saves the lead and opens WhatsApp with their question.
- **Admin** at `/#admin` (Roshan only): leads list with status, ₹499 / ₹500 / ₹999 payment ticks, follow-up dates, notes and one-tap WhatsApp drafts in the lead's language; students and money owed; stats (funnel, leads per day, sources) and sales page settings (seats, checkout link).
- Installable PWA, light and dark theme.

Payments stay on Shopify. This app never touches the Shopify store, theme or DNS.

## What's where

```
index.html            meta tags, theme pre-paint script
vite.config.ts        React + PWA + chunk groups (react / vendor / charts)
vercel.json           SPA rewrite, cache headers
src/data/content.ts   all sales copy, English + Malayalam, and the fixed facts (price, dates, WhatsApp)
src/lib/              supabase clients, zustand store, formatting, safe localStorage
src/components/       top bar, lead form sheet, countdown, shared UI
src/views/Home.tsx    the sales page
src/views/Admin.tsx   admin shell (lazy chunk) + admin/ screens
supabase/migrations/  tables, row-level security, triggers
docs/                 plan and hand-over notes
```

## Run it

```
npm install
cp .env.example .env.local   # fill in the two values
npm run dev                  # http://localhost:5173
npm run build                # type-check + production build into dist/
```

## Environment variables

| Name | What |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key (public by design; RLS protects the data) |

No secret keys are used anywhere in this app.

## Database

All tables are prefixed `learn_` (see `supabase/migrations/`):

| Table | Public | Admin |
|---|---|---|
| `learn_leads` | insert only, limited columns, can't set payment fields | read, update, delete |
| `learn_settings` | read | insert, update |
| `learn_admins` | nothing | read |

`learn_private.is_admin()` checks the signed-in email against `learn_admins`. A stranger who signs up sees nothing. Add another admin from the Supabase SQL editor:

```sql
insert into public.learn_admins (email) values ('someone@example.com');
```
