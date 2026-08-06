# WordPress Beginner Course — Class 3 Lesson Plan

**Class 3: Installing WordPress & First Setup (on Hostinger)**

⏱ Duration: 60 minutes · 🎯 Level: Absolute beginner · 🖥 Format: Online, screen-share demo + students follow along

---

## 🎯 Learning Objectives

By the end of this class, every student should be able to:

1. Install WordPress on their own hosting using Hostinger's Auto Installer
2. Log in to their WordPress admin (`/wp-admin`)
3. Configure the 3 essential first settings (General, Permalinks, Reading)
4. Explain the difference between **Posts** and **Pages**
5. Create their first Page and first Post

## ✅ Prerequisites (before class starts)

- Every student has an active Hostinger account (from Class 1)
- They know their Hostinger login
- Ask at the start of class: *"Everyone logged into hPanel? Type YES in chat"*

---

## 🕐 Class Timeline (60 min)

### Block 1 — WordPress Installation on Hostinger (15 min)

**Talking points / script:**

> "Last class we saw the WordPress dashboard on my site. Today YOU get your own live website on the internet. We're going to install WordPress together — it takes about 2 minutes."

**Live demo steps (share your screen):**

1. Log in to **hPanel** → **Websites** tab
2. Click **Auto Installer** → choose **WordPress**
3. Fill in:
   - Website name (e.g., "My First Site")
   - Admin username → ⚠️ **NEVER use** `admin` (explain: hackers try this first)
   - Strong password → save it somewhere safe (password manager / notebook)
4. Leave everything else default → click **Install**
5. Wait ~2 minutes → show the success screen
6. Open the live site URL → **point out the padlock icon (SSL)** — tie back to Class 1

**Say this:**

> "See the padlock? That's the free SSL from Hostinger. It means your site is secure and visitors see it as trustworthy."

🧯 *If a student gets stuck here, tell them to type "STUCK" in chat — handle it in the Q&A buffer, don't derail the flow.*

---

### Block 2 — First Login & Essential Settings (15 min)

**Step 1: Log in (3 min)**

- Go to `yourdomain.com/wp-admin`
- Log in with the username/password created earlier
- Quick tour reminder: *"This is the dashboard you saw in Class 2 — but now it's YOURS"*

**Step 2: Settings → General (3 min)**

- Set **Site Title** and **Tagline**
- Set **Timezone** (important for post scheduling later!)

**Step 3: Settings → Permalinks (5 min)** ⭐ *most important setting*

- Change from "Plain" to **"Post name"**
- **Say this:**

  > "Compare these two URLs: `yoursite.com/?p=123` vs `yoursite.com/my-first-post`. The second one is readable for humans AND for Google. Always set this BEFORE you publish content, otherwise old links break later."

**Step 4: Settings → Reading (2 min)**

- Optional: tick *"Discourage search engines from indexing this site"* while we're still learning/building
- Tell them we'll untick it on the last day of the course

**Step 5: Save all settings** — show where the Save button is (beginners miss it!)

---

### Block 3 — Posts vs Pages: The Big Concept (15 min)

> 💡 This is the #1 beginner confusion point. Spend the full 15 minutes here.

**Simple explanation (use this analogy):**

> "Think of a book. **Pages** are like the cover, preface, and 'about the author' — they always stay in the same place. **Posts** are like diary entries — newest one appears first, and they pile up over time."

**Side-by-side comparison (share this on screen):**

| | **Pages** | **Posts** |
|---|---|---|
| Purpose | Static content | Blog/news entries |
| Examples | Home, About, Contact | Articles, tutorials, news |
| Date? | No | Yes (sorted newest first) |
| Categories/tags? | No | Yes |
| Shows in blog feed? | No | Yes |

**Live demos:**

1. **Create a Page:** Pages → Add New → title "About Me" → type 2–3 lines → **Publish** → show it live on the front end
2. **Create a Post:** Posts → Add New → title "My First Post" → write a short paragraph → **Publish** → show it on the site
3. **Show the difference live:** visit both URLs — point out that the post has a date, the page doesn't

---

### Block 4 — Cleanup (10 min)

**Say this:**

> "WordPress comes with sample content, like a new house with some leftover boxes. Let's clear them out."

**Do together:**

1. Delete the **"Hello World"** post (Posts → Trash)
2. Delete the **"Sample Page"**
3. Delete the default **comments**
4. (Optional demo only) Mention Plugins screen: *"See these pre-installed plugins? We'll talk about plugins later — don't delete anything yet"*

**Mini recap quiz (2 min, chat-based):**

- *"Where do we change the URL structure?"* → Settings → Permalinks
- *"Home/About/Contact — posts or pages?"* → Pages
- *"Blog articles — posts or pages?"* → Posts

---

### Block 5 — Q&A Buffer + Homework (5 min)

- Answer the "STUCK" students (usually login/password issues)
- Assign homework (see below)
- **Teaser for Class 4:** *"Next class we make your site beautiful — themes!"*

---

## 📋 Homework Sheet (share with students)

### Class 3 Homework — Due before Class 4 ✅

| # | Task | ✓ |
|---|---|---|
| 1 | Install WordPress on YOUR hosting (Hostinger Auto Installer) | ☐ |
| 2 | Log in to `/wp-admin` with your credentials | ☐ |
| 3 | Set your Site Title & Tagline (Settings → General) | ☐ |
| 4 | Set Permalinks to "Post name" | ☐ |
| 5 | Create a Page called **"About Me"** (write 3–4 lines about yourself) | ☐ |
| 6 | Create a Post called **"Why I'm Learning WordPress"** | ☐ |
| 7 | Delete the Hello World post and Sample Page | ☐ |

**⭐ Bonus challenge:** Create a second page called "Contact" (content can be simple text for now).

**📸 Submission:** Post a screenshot of your live website's front page in the class group/chat.

---

## 🧯 Common Issues & Quick Fixes (for the teacher)

| Problem | Fix |
|---|---|
| Student forgot admin password | hPanel → WordPress → overview → change password, OR "Lost your password?" link |
| Site shows "Not Secure" | hPanel → SSL → check status; SSL can take a few minutes after install |
| Student can't find wp-admin | Remind: it's `yourdomain.com/wp-admin` — check for typos |
| Install stuck/fails | Delete the install (hPanel → WordPress → Manage → Delete) and re-run Auto Installer |
| White screen / cached view | Ctrl+F5 or open in incognito |

---

# 📅 Full 2-Week Syllabus (context for where Class 3 fits)

| Day | Class | Topic | Key Deliverable |
|---|---|---|---|
| 1 | Hosting Basics | Domains, hosting, DNS basics, Hostinger hPanel tour | — |
| 2 | WP Dashboard Intro | Tour of wp-admin, what each menu does | — |
| 3 | **Install & First Setup** ⬅️ *this one* | Auto Installer, settings, posts vs pages | Live site + 1 page + 1 post |
| 4 | Themes | Installing/activating themes, block vs classic themes, Site Editor basics | Theme chosen & activated |
| 5 | Block Editor Deep Dive | Gutenberg: blocks, patterns, columns, images | Nicely formatted post |
| 6 | Building a Home Page | Full page layout together: hero, sections, buttons | Finished Home page |
| 7 | Navigation & Branding | Menus, header/footer, logo, site identity, favicon | Complete site navigation |
| 8 | Plugins | What/why plugins, install essentials (security, SEO) | 2–3 plugins installed |
| 9 | Forms & Media | Contact form plugin, image optimization, media library | Working contact form |
| 10 | Final Project | Each student builds a small site (e.g., a baby-products store like "BabyCocoon") | 🎓 Finished website |

**Tip:** Record every class and share the recording + this lesson plan's homework sheet in your class group. Beginners rewatch demos a LOT.
