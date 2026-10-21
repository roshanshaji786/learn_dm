# v5 hand-over (22 Oct 2026)

**Live:** https://dartsai-learn-v5.vercel.app  ·  **Admin:** https://dartsai-learn-v5.vercel.app/#admin  ·  **Malayalam:** https://dartsai-learn-v5.vercel.app/?lang=ml
**Code:** `v5/` on branch `claude/v5-rsv-app-pid7m7` of roshanshaji786/learn_dm, PR #1 into `main`.

## What works (checked on the live site)
- Sales page in English and Malayalam, light and dark, 390 px phone with no sideways scroll, no console errors.
- Join form saves the lead (tested: 201 from Supabase, utm kept) and opens the Shopify checkout link.
- Ask form saves the lead and opens WhatsApp with the question.
- Strangers can't read leads, change settings or see admins (tested with the public key).
- Admin screens (leads, lead sheet, students, stats) checked with sample data in light and dark.
- Lighthouse mobile: Performance 90, Accessibility 96 (contrast then fixed), Best Practices 100, SEO 100.
- Installable (manifest + service worker), deep links work.

## Roshan's steps
1. **Make your admin password (2 minutes).** Open the Admin link → "First time here? Create your password" → email `roshanshaji786@gmail.com` + a password → tap the confirm link in the email once (it may open the EcoCart site; that's fine, the account is confirmed) → back on Admin, sign in.
   - If it says sign-ups are disabled: Supabase → project **ecocart-v5** → Authentication → Users → Add user → your email + password, tick "Auto confirm".
2. **Merge PR #1** on GitHub so `main` holds the app. After that every push to `main` deploys to production by itself.
3. **Test the ₹499 checkout once** from the live page (it uses learn.dartsai.in/cart/49228679119031:1). You can change the link in Admin → Stats → Sales page settings.
4. **Delete the two test rows** ("RLS test", "Claude form test") in Admin → Leads → All → open → Delete lead. They're marked "Not interested".
5. Add the WhatsApp leads from your ads with the + button, so the stats show the real funnel.

## Choices made overnight
- **Shared Supabase project.** Your free plan's 2 slots were taken (baithul-hamd, ecocart-v5), so v5's tables live in **ecocart-v5** as `learn_leads`, `learn_settings`, `learn_admins` plus a `learn_private` schema. EcoCart's tables were not touched. To move later: pause or delete a project, create `dartsai-learn-v5` in Mumbai, run `supabase/migrations/*.sql`, copy rows, change the two Vercel env vars.
- **Email + password sign-in** for admin (magic link also offered), because the shared project's redirect URLs point at EcoCart.
- **vercel.app address**, no DNS change. learn.dartsai.in stays on Shopify.
- Vercel login protection is **off** for this project so the public can open the page.

## Not built yet
- Payments inside the app (Razorpay). Payments still go through Shopify, and you tick "Paid" in the admin.
- Automatic sync of Shopify orders into the students list.
- A ₹500 second-payment link (doesn't exist yet); the ₹500 WhatsApp draft says you'll send it.
- Spam protection on the public form beyond field limits (add a rate limit if junk appears).
- Testimonials section (left out until there are verified student quotes for the Starter).
