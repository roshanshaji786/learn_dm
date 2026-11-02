# Darts LMS Pro

A free WordPress plugin that adds "Pro" features to the free **Tutor LMS**, built for Darts AI Academy (learn.roshanshaji.com). The only cost is the Hostinger plan you already have, plus Razorpay's fee on online payments if you use them.

## What it adds

| Area | Features |
| --- | --- |
| Payments | Manual enrolment (UPI, cash, bank), part payments with due dates, PDF receipts numbered `DAA-YYYY-###` and emailed automatically, lessons lock when a balance is overdue (with a tap-to-pay UPI button and a WhatsApp link), Razorpay/WooCommerce orders recorded automatically, refunds removed |
| Live classes | Class date, time and Google Meet link per lesson, a Join button that opens 10 minutes before, countdown, "Add to Google Calendar", optional one-click Meet links through the free Google Calendar API, recordings (YouTube unlisted, Google Drive, Vimeo) embedded after class |
| Attendance | Logged automatically when a student clicks Join, manual ticks, attendance %, CSV export |
| Drip and order | Unlock by date, X days after enrolment, or 1 hour before the live class; lessons in sequence; course prerequisites |
| Assignments | Instructions per lesson, answer, link and file upload (private, 10 MB), marks and feedback, "return for redo", due dates |
| Certificates | A4 PDF certificate issued automatically on course completion (optional minimum attendance), unique ID, public verify page, revoke and restore |
| Gradebook | Progress, quiz average, assignment average, attendance and balance per student, CSV export |
| Notifications | Welcome with set-password link, enrolment, receipt, class reminder, fee reminders, assignment marked, certificate, new lesson (optional), and pre-filled WhatsApp messages in the admin |
| Bundles and credit | Enrolling in one course can enrol in others; a course fee can count as credit toward another course (personal WooCommerce coupon, or applied automatically on manual enrolment) |
| WhatsApp | Send any link (Meet, lesson, recording, form, payment) to a course, students with dues, picked students, or your saved batch groups. Free mode opens WhatsApp with each personalised message ready and you tap Send ("Send next" walks the list, rows tick as you go). Optional automatic sending to students through the paid WhatsApp Cloud API. Sent history per campaign |
| Students | "My Learning Hub" in the Tutor dashboard: upcoming classes with Join, progress, payments and receipts, assignments, certificates, a WhatsApp help button |
| Language | EN / മലയാളം switch (`?lang=ml`) for the plugin's screens and common Tutor labels |
| Protection | No right-click or copy on lesson pages, and a moving watermark with the student's name and phone on videos |
| App | Installable PWA: home-screen icon, offline page, opens to the Learning Hub |
| Admin | Dashboard with money collected, dues, today's classes, overdue list, latest payments and a getting-started checklist |

## Install on Hostinger

1. In hPanel, create the subdomain `learn.roshanshaji.com` and install WordPress on it (Auto Installer). Keep it separate from roshanshaji.com.
2. In WordPress: Plugins → Add New → install and activate **Tutor LMS** (free).
3. Plugins → Add New → Upload Plugin → choose `darts-lms-pro.zip` → Activate.
4. Settings → Permalinks → Post name → Save.
5. Darts LMS → Settings: academy name, logo, brand colour, UPI ID, WhatsApp number.
6. For online payments (optional): install **WooCommerce** and **Razorpay for WooCommerce** (both free), then Tutor LMS → Settings → Monetization → WooCommerce.
7. For email delivery, install **WP Mail SMTP** (free) with your Hostinger mailbox.
8. Optional: connect Google Calendar in Darts LMS → Settings for one-click Meet links (steps are on that screen).

## Daily use

- **Create a course** in Tutor LMS (topics and lessons).
- **Darts LMS → Course setup**: fee, order, prerequisites, bundle, credit, certificate rule, and for each lesson the live class time, Meet link, recording, drip and assignment.
- **Students & payments**: enrol someone who paid by UPI, record later instalments, open receipts, message on WhatsApp.
- **Live classes**: see each class, then tick attendance.
- **Assignments**: mark and give feedback.
- **WhatsApp**: paste a link, pick a template, choose students and/or groups, then "Prepare messages" and tap through. Save batch groups under WhatsApp → Groups. Live classes has a "Send on WhatsApp" button per class.
- **Gradebook** and **Certificates**: track results and export CSVs.

## Build the zip

```bash
cd lms-plugin && ./build.sh   # writes dist/darts-lms-pro.zip (includes the PDF library)
```

The `vendor/` folder (Dompdf) isn't committed. `build.sh` installs it with Composer.

## Notes

- Works with Tutor LMS 4.x (tested on 4.2.0) and WordPress 6.4+ / PHP 8.0+.
- Data lives in six tables (`wp_dlms_*`) plus `_dlms_*` post meta. Deactivating the plugin keeps all data.
- Assignment files go to `wp-content/uploads/dlms-private/`, which is blocked from direct web access; downloads are permission-checked.
- Unlisted YouTube/Drive links can still be shared by a determined student; the watermark discourages it.
- WhatsApp: the free mode never sends anything by itself; you tap Send in WhatsApp for each chat. Automatic sending needs a WhatsApp Business Cloud API number, an approved template with two body variables (name, link), and Meta's per-message charge. WhatsApp has no API for posting into normal groups, so groups are always one tap.
