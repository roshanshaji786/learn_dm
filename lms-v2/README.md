# Darts LMS v2 (lms.roshanshaji.com)

React 19 + TypeScript + Vite PWA, Supabase (Postgres, Auth, Storage, one Edge Function), hosted on Vercel's free Hobby plan.

Live: https://lms.roshanshaji.com · Admin: https://lms.roshanshaji.com/#/admin

## What's in it

- **Public:** home page, course page with "Enrol on WhatsApp", certificate check (`#/verify/DAA-XXXXXXXX`), login. English and Malayalam (`?lang=ml` or the EN/മല switch).
- **Student app (`#/app`):** Today (next live class, countdown, Join, add to calendar, fee balance with Pay by UPI), Learn (modules and lessons with lock states), lesson page (Join, recording with a moving name/phone watermark, notes, assignment upload, mark complete), Tasks, Me (payments with receipt PDFs, certificate PDF, language, theme, change password). Installable as an app.
- **Admin (`#/admin`):** dashboard (students, collected, dues, upcoming classes, overdue fees, gradebook and payments CSV), students (add with a login, payments, receipts, fee and due date, new password, fee reminder on WhatsApp), courses (course, modules, lessons: live time, Meet link, recording, unlock rules, assignment), attendance per class, marking, WhatsApp (compose with {name}/{link}/{balance}, tap-to-send queue, groups, history), settings.

## How the rules work (enforced in the database, not just the app)

- Row-level security on every `lms_` table. Admin = a login whose `app_metadata.lms_admin` is true (only the server can set it).
- Lesson content (Meet link, recording, notes) is readable only when the lesson is open for that student and their fee is not overdue (`due_date` passed with a balance).
- Join goes through `lms_join()`, which checks access, logs attendance and returns the Meet link.
- Students can't change fees, payments, marks, their admin note or their email. Files go to the private `lms-submissions` bucket, in a folder per student.
- Certificates: `lms_claim_certificate()` needs every published lesson complete and no balance. Anyone can check one with `lms_verify()`.

## Logins

There is no email sending. Adding a student creates the login with a temporary password and shows a WhatsApp message to send it. Students set their own password under Me. "New password" on a student makes a fresh temporary one.

## Shared Supabase project

Tables live in the existing **ecocart-v5** project (free plan allows 2 projects), all prefixed `lms_` plus the `lms_private` schema. Never touch the other tables there.

## Develop

```
cp .env.example .env.local   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (publishable key)
npm install
npm run dev
```

Migrations: `supabase/migrations/`. Edge function: `supabase/functions/lms-admin` (deployed with verify_jwt off; it checks the admin flag itself).

Vercel project `darts-lms`, root directory `lms-v2`. Pushes deploy automatically (pushes to `main` go to production).

## Known limits

- Meet links are pasted per lesson; nothing creates them automatically.
- WhatsApp messages are sent by tapping each one (free WhatsApp has no sending API).
- Free plans: Supabase pauses a project after a week with no traffic, and has 500 MB database / 1 GB file storage.
- Supabase advisor notes two unindexed foreign keys (info level, fine at this size).
