# Livestock Market Transaction Registration System

Angular 21 + Tailwind CSS frontend, TypeScript Netlify Functions backend, Supabase Auth, PostgreSQL (with RLS), and private Supabase Storage.

## 1. What is implemented

Frontend (`src/app`):

- Login, session restore, role guards (admin/collector)
- Dashboard with real counts, animal-type chart, 6-month activity chart, per-collector chart, recent transactions
- Mobile-first transaction registration: seller, buyer, animal, middleman, buyer/seller photo capture with client-side compression, left/right animal marking canvases (pointer/touch), duplicate-submit guard, localStorage draft recovery
- Transaction search: name/phone/receipt text search, animal, status, date range, pagination
- Backup export from Search Records: **Excel/CSV** and **PDF**, honouring the active filters (up to 5000 rows)
- Toast notifications, skeleton loading, button spinners, password visibility toggle, custom accessible dropdowns
- Mobile app experience: bottom tab bar with icons, sticky app bar, safe-area (notch) padding, 46 px touch targets, 16 px inputs (no iOS zoom), tables that become labelled cards, sticky “Register” action on the transaction form, web manifest (`Add to Home Screen`, standalone display)
- Settings page for **every** signed-in user: change own password (current password re-verified first). Admin additionally sees market/receipt branding.
- Transaction details + digital receipt: all sections, photos, markings, QR, print (A4 print stylesheet), PDF download (jsPDF), copy receipt number, WhatsApp share
- Admin: edit transaction, void transaction with mandatory reason, **delete transaction** (receipt-number confirmation, audit copy kept, private images removed), middleman management, collector account creation (with camera photo) / activation, audit log viewer, market settings
- Images are downscaled and re-encoded before upload: buyer/seller photos target **≤ 60 KB** (720 px max), collector photos **≤ 40 KB** (480 px max), markings ~600×360 JPEG — keeps uploads fast on weak mobile networks
- Collectors see only their own transactions (backend + RLS enforced)

Backend (`netlify/functions`):

- `create-collector` (admin only, Supabase Admin API)
- `create-transaction` (calls atomic PostgreSQL RPC)
- `search-transactions` (ownership-aware, filtered, paginated)
- `update-transaction` (admin only, writes audit entry)
- `void-transaction` (admin only, mandatory reason, writes audit entry)
- `delete-transaction` (admin only, copies the row into `audit_logs`, cascades animal identifications, removes private storage objects)
- `signed-images` (short-lived signed URLs for the private bucket, max 10 paths)

Database (`supabase/migrations`):

- Schema, enums, indexes, private bucket, RLS policies, atomic receipt sequence + `create_livestock_transaction` RPC, fixes migration

## 2. Honest status

Working and verified:

- `npm run build` (Angular production build) passes
- `npm run typecheck:functions` (all server functions) passes
- Publish directory and `env.js` emission verified in `dist/frontend/browser`

Not yet verified because it requires your own live Supabase project:

- Actual migration execution, RLS behaviour at runtime, storage signing, end-to-end registration
- Visual/touch testing on a real Android device

No automated test suite exists yet (Angular CLI was scaffolded with `--skip-tests`). The manual test plan in section 6 covers the required workflows.

## 3. Supabase setup (once)

1. Create a free project at supabase.com.
2. Project Settings → API: copy the Project URL and the publishable/anon key. Copy the service-role key separately (server only).
3. SQL Editor: **fastest path** — open `supabase/setup.sql`, copy the whole file, paste it into a new query and Run. It is idempotent and equivalent to migrations 0001–0007.
   Alternatively run each file in `supabase/migrations/` in filename order (`...0001` … `0007`).
   If you already have a working database, run only the migrations you have not applied yet — e.g. `202611240007_receipt_codes.sql` adds the per-animal receipt series.
4. Authentication → Providers: enable Email. Turn off public sign-ups (Authentication → Settings) so collectors cannot self-register.
5. Create the first administrator. **There is no default/seeded admin login** — you must create one.
   - Fastest way (uses the service-role key from `.env`):
     ```powershell
     npm run admin:create -- --email admin@market.local --password "ChangeMe123" --name "Market Administrator"
     ```
     The script creates the Auth user, confirms the email, and upserts the `profiles` row with `role='admin'`.
   - Manual way: Authentication → Users → Add user (email + password), then run in SQL Editor:
     ```sql
     insert into public.profiles (auth_user_id, full_name, role, is_active)
     values ('PASTE-AUTH-USER-UUID', 'Market Administrator', 'admin', true);
     ```
   Use whatever email/password you supply here to sign in. Collectors are created later from the admin UI (Data Collectors page), not from seed data.
   - If the CLI and Node are unavailable, `supabase/seed-admin.sql` does the same entirely in SQL (edit the password inside it first).
6. Storage: migration `0002` creates the private `livestock-private` bucket and its policies. Confirm it is listed as private.
7. Optional local data: run `supabase/seed.sql`.

Never put the service-role key in `public/env.js`, Angular code, or Git.

## 4. Local configuration

1. `npm install`
2. Edit `public/env.js`:
   ```js
   window.__env = {
     SUPABASE_URL: "https://<project>.supabase.co",
     SUPABASE_ANON_KEY: "<publishable-key>"
   };
   ```
3. Create `.env` in the repo root (already git-ignored):
   ```
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```
   `.env.example` documents the variables.

## 5. How to test locally

Run the full stack (frontend + functions on one origin):

```powershell
npm run dev:netlify
```

Open `http://localhost:8888`. To try it on a real phone on the same Wi-Fi:

```powershell
npm run dev:lan
```

Then open `http://<your-pc-ip>:8888` on the phone (allow Node through Windows Firewall on private networks). On Android Chrome use “Add to Home Screen” for a full-screen, app-like experience.

Angular-only (UI work; function calls will 404):

```powershell
npm start
```

Then `http://localhost:4200`.

Sanity checks:

```powershell
npm run build
npm run typecheck:functions
```

### First-run checklist

1. Log in as the administrator.
2. Market Settings → set market name, location, district, LGA, state, receipt prefix → Save.
3. Middlemen → add two middlemen.
4. Data Collectors → create a collector with a temporary password (min 8 chars).
5. Log out, log in as that collector.
6. Register Transaction:
   - date/time pre-filled
   - choose animal type and middleman
   - seller + buyer details
   - attach a photo for each (camera or gallery)
   - draw markings on the left and right canvases
   - submit → receipt number appears using the animal series: `C-0001` (camel), `DK-0001` (donkey), `H-0001` (horse)
7. Open the receipt (View receipt): verify photos, markings, QR, Print, Download PDF, Copy number, WhatsApp.
8. Log back in as admin: Transactions appear on the dashboard; search by receipt number, by seller/buyer/middleman name, by animal, by date range.
9. Admin → open a transaction → edit a field → save; then void another with a reason. Confirm Audit Logs recorded the actions.
10. Permission checks: as collector, the Middlemen/Collectors/Audit/Settings links are absent, and calling `/api` endpoints directly returns 403. Search only returns that collector's records.
11. Concurrency: register two transactions quickly from two browsers; receipt numbers must be sequential and unique (PostgreSQL sequence inside the RPC).
12. Offline/retry: fill the form, kill the network, submit → error message shown and the form data resumes from the local draft on reload. No receipt number is issued until the database commits.
13. Password change: Settings → enter current password, a new one (min 8 chars) and confirm → success toast. Sign out and back in with the new password. Works for both the admin and a collector; a collector never sees the branding form.
14. Backup: Search Records → set filters → **Export Excel** (`.csv`, opens in Excel) and **Export PDF** (landscape A4 table). Both use the current filters, up to 5000 rows.
15. Collector photo: Data Collectors → *Collector photo* opens the device camera (mobile) or file picker; the preview shows the compressed size (~40 KB) → create the account → the list shows the avatar from a signed URL.

## 6. Troubleshooting (local)

| Symptom | Cause | Fix |
|---|---|---|
| Login shows **"Failed to fetch"** | `public/env.js` still has the placeholder `https://your-project.supabase.co`, or Supabase is unreachable | Put your real project URL + publishable key in `public/env.js`, restart, reload the page |
| `npm run dev:netlify` exits immediately with `Could not acquire required 'port': '8888'` | A previous Netlify dev process is still running | `Get-NetTCPConnection -LocalPort 8888 -State Listen` then `Stop-Process -Id <PID> -Force`, or run `npx netlify dev --offline --port 8899` |
| `Port 4200 is already in use` | Orphaned `ng serve` from an earlier run | `npm run dev:reset` (also runs automatically before `dev:netlify`) |
| Functions return 500 with `Supabase server environment variables are not configured` | `.env` is empty | Fill `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` and restart |
| Functions return 401 `Unauthorized` | Expected for calls without a valid session token | Log in first; the browser sends the Supabase access token |
| `permission denied for table profiles` (SQLSTATE **42501**) | Tables were created without role grants | Run `supabase/migrations/202611240005_grants.sql`, or the combined `supabase/fix-admin.sql` which also seeds the first admin |
| `Unauthorized collector` when saving a transaction | The transaction RPC was executed with the service-role key, so `auth.uid()` was `NULL` inside the function | Run `supabase/migrations/202611240006_fix_rpc_auth.sql`, then restart the dev server (`create-transaction` now passes the verified collector id) |
| `Unauthorized collector` persists **after** that fix | The database still has the old function body (migration never committed) | Run `npm run db:check` — if it reports `STALE FUNCTION`, paste `supabase/migrations/202611240007_receipt_codes.sql` into the Supabase SQL editor and re-run the check until every line is `PASS` |

Quick verification that the stack is healthy (app up, functions reachable, auth enforced):

```powershell
$r = Invoke-WebRequest 'http://localhost:8888/' -UseBasicParsing; $r.StatusCode   # 200
# unauthenticated function call must return 401, not a network error
curl.exe -s -o - -w "`n%{http_code}`n" -X POST http://localhost:8888/.netlify/functions/create-transaction -H "Content-Type: application/json" -d "{}"
```

## 7. Deployment to Netlify

1. Push the repository to GitHub/GitLab.
2. Netlify → Add new site → Import an existing project.
3. Build command `npm run build`; publish directory `dist/frontend/browser`; functions directory `netlify/functions` (already in `netlify.toml`).
4. Site configuration → Environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
5. Deploy. After the first deploy, replace `public/env.js` values with production values and redeploy (browser config is a static file, not a build secret).
6. In Supabase Authentication → URL Configuration, add your Netlify domain.

## 8. Known limitations / next steps

- `public/env.js` holds the browser-safe Supabase URL and publishable key. It is intentionally committed with placeholders; it is not a secret.
- Receipt QR codes point to the authenticated `/transactions/:receipt` route, so scanning by an unauthenticated person does not expose personal data.
- Charts aggregate the most recent 500 transactions client-side; exact totals come from database counts.
- Server-side validation covers required fields, animal type, roles, and file constraints (5 MB, JPEG/PNG/WebP in the bucket policy). Rich per-field validation on the server can be extended.
- Automated tests (Playwright/Vitest) are not included yet.

