# Event Registration

Build registration forms for any number of events. Each event gets its own link, design, form fields, fees, payment instructions and admin dashboard.

- **Public form:** `/e/<event-link>`. Visitors fill in the form, pick quantities, upload proof of payment and get a reference code like `REG-7K2M9P`.
- **Success screen:** shows the registration number and a summary of everything submitted (contact details, delegates, items, total), with **Print** and **Save as image**. The image is a PNG drawn in the event's colors, for keeping on a phone or forwarding.
- **Status page:** `/e/<event-link>/status`. Visitors enter their reference code to see whether they're pending, confirmed or rejected, plus any note you left.
- **Admin:** `/admin`. Create, duplicate, publish or close events. Each event has these tabs:
  - **Registrations:** totals, search, receipt viewer, confirm/reject with a note, CSV export.
  - **Form fields:** sections and questions (text, email, phone, number, paragraph, dropdown, multiple choice, checkbox, date). You can set questions as required, half-width and reorder them.
  - **Fees & payment:** price categories, currency, account details, and whether a receipt is required. **Delegate details** asks your own questions once per ticket (2 Regular Delegates → 2 name boxes). Delegates show in each registration's details, the search, and **Export delegates**, a CSV with one row per person for name lists and badges.
  - **Design:** opening animation (on/off and length), colors, font, header banner (image, GIF, or MP4/WebM video up to 50MB) with an overlay color and opacity, logos, date/venue line, success page texts, footer. The header is centred. Includes a live preview.
  - **Emails:** turn emails on or off, set the **From name**, and edit the subject, heading and message of the Received, Confirmed and Rejected emails, with a live preview. The texts can use `{event}`, `{ref}`, `{name}` and `{total}`.
  - **Settings:** event name, link, published/draft, open/closed, delete.
- **Registration Dashboard:** statistics and the table follow filters for every dropdown or multiple-choice question (registration and delegate level). **📊 Create report** opens a printable, customizable report (title, notes, statuses, filters, grouping by category or any dropdown, columns) with per-group lists, subtotals and totals, plus a CSV of the same data.
- **Edit requests:** on the status page, registrants confirm their email or mobile, then edit their answers and delegate details. Changes wait as "Edit requested" until an admin or moderator approves or rejects them, with an old → new comparison. Requires `supabase/migrations/20261114040000_edit_requests.sql`.
- **Check-In tab** (admins and moderators): scan a registrant's QR code with the device camera, or type a registration number or name. Check in each delegate, or a whole group at once, with undo. Only confirmed registrations can be checked in; pending ones get **Confirm & check in**, and rejected ones show a warning. A live counter shows arrivals, and check-ins appear on the dashboard and in both CSVs. QR codes are on the success screen, saved image, printout, emails and status page. The camera needs https (the live site) or localhost. Requires `supabase/migrations/20261114030000_checkin.sql`.
- **Users** (admins only): create logins with a username (or email) and password as **Admin** (full access) or **Moderator** (view registrations and receipts, confirm/reject, notes, export only). You can also change roles, reset passwords and remove users. The database enforces the limits: from the browser, moderators can only change a registration's status and note. Requires `supabase/migrations/20261114020000_roles.sql`.
- **Emails:** registrants get an email when they register, and when you confirm or reject them (with your note). Emails are sent from a Gmail account and go to the form's first Email question. They need `GMAIL_USER` and `GMAIL_APP_PASSWORD`: turn on 2-Step Verification for that Gmail, then create an app password at https://myaccount.google.com/apppasswords. Gmail allows about 500 emails a day. If sending fails, registrations and status changes still save.

Tech: Next.js 16, Supabase (Postgres + Auth + Storage), Tailwind. Deploys on Vercel.

## 1. Create the Supabase project (free)

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. Open **SQL Editor**, paste the whole of `supabase/migrations/20261015000000_init.sql` and click **Run**. This creates the tables, security rules and the two storage buckets.
3. Turn off public sign-ups: **Authentication → Sign In / Providers → Email**, and switch **Allow new users to sign up** off. Admins are created with the script below.
4. Open **Project Settings → API**. Copy `.env.example` to `.env.local` and fill in the URL, the `anon` key and the `service_role` key.

## 2. Run it on your computer

```bash
npm install
```

```bash
npm run create-admin -- you@example.com "a-strong-password"
```

```bash
npm run dev
```

Open http://localhost:3000/admin, sign in and click **+ New event**. Edit it, then turn on **Settings → Published**. To add more admins, run `create-admin` again with another email.

## 3. Put it online (Vercel)

1. Push this folder to a GitHub repository.
2. On [vercel.com](https://vercel.com), go to **Add New → Project**, import the repo, and add the same three environment variables from `.env.local`.
3. Deploy. In Supabase, go to **Authentication → URL Configuration** and set **Site URL** to your Vercel address.

## How it's secured

- Visitors never write to the database directly. Submissions go through `/api/register`. It re-checks every field against the event's form and recalculates the total from your prices, so an edited browser can't change the amount.
- Receipts go to a private bucket that only admins can read. Uploads use one-time signed links, and files are limited to PNG, JPG or PDF up to 5MB.
- Receipt photos are shrunk in the visitor's browser before upload (max 1600px, JPEG), so a 3–12MB phone photo becomes about 100–300KB. Supabase's free 1GB then holds roughly 5,000+ receipts. PDFs are uploaded as-is.
- Only accounts in the `admins` table can see registrations or edit events. This is enforced by database row-level security, not just by hiding pages.
- The status page needs the exact reference code and shows only a masked name.

## Development

- `npm test`: runs the validation tests.
- Local Supabase (needs Docker Desktop running): `npx supabase start`, then use the URL and keys from `npx supabase status` in `.env.local`.
