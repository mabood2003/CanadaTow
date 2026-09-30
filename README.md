# TowLedger

TowLedger helps Alberta towing companies deliver estimates, capture their own consent process, issue invoices and keep one complete record per job. It ships as **two installable apps** from one codebase:

- **TowLedger Driver** (`/driver`): the operator app for the phone. It covers starting a tow, the estimate, consent, tow times and the invoice at the roadside. Drivers see only their own jobs.
- **TowLedger Owner** (`/owner`): for running the company, on a phone or a laptop. It shows every job, what needs attention, who's on the road, unpaid invoices, the team and company setup. Owners can also run a tow themselves.

Each app has its own name, icon, manifest and URL scope, so both can sit on one home screen. The customer link (`/e/<token>`, `/i/<token>`) needs no app or login.

**Product boundary:** each towing company controls its forms, rates, wording and workflows. TowLedger provides tools to deliver, capture, organize and retain the resulting records. It doesn't decide which legal rules apply to a job.

## What's in the prototype

Everything runs on the device (localStorage) with a fictional demo company, **Summit Towing Ltd.** Supabase, real sign-in, real text/email sending and server PDFs come later.

| Area | Where |
| --- | --- |
| App chooser | `/` |
| **Driver app**: home (New Tow, your job in progress, recent jobs), My jobs (open / complete / search), Account (call the office, yard, company process, install, sign out) | `/driver`, `/driver/jobs`, `/driver/account` |
| Driver flow: who requested → company workflow → customer → vehicle & job → estimate → preview & delivery (incl. dead-phone fallback) → consent → ready to proceed → tow → invoice | `/driver/jobs/<id>/…` |
| **Owner app**: dashboard (needs attention with fix-it, on the road now, waiting for customer, unpaid invoices, company activity) | `/owner` |
| Owner jobs: workflow column, driver / status / date / unpaid filters, search; filters can be set from the URL (`?status=attention`, `?driver=…`) | `/owner/jobs` |
| Job record and audit trail (both apps) | `…/jobs/<id>`, `…/jobs/<id>/audit` |
| Team: what each driver is doing now, open jobs, last activity, invite / resend | `/owner/team` |
| Company setup: profile & logo, rate cards, job categories → workflows A–D, consent template with version history, document templates | `/owner/settings` |
| Customer link: branded estimate, the company's consent wording, invoice on the same link | `/e/<token>`, `/i/<token>` |
| Interview mode: start as owner, three scripted scenarios, simulate offline, one-tap reset | `/demo` |

**Sign-in (pilot stand-in):** each app has its own session on the device. Open the app and pick your name (drivers in the driver app, owners in the owner app). An invited driver accepts the invite by signing in. Email sign-in links come with the backend.

Guardrails (unit-tested): the tow can't start until the company's configured pre-tow steps are done; payment can't be recorded before the invoice is issued; issued estimates, consents and invoices never change (corrections create new versions); every change writes an audit row.

The Stage 1 URLs (`/office`, `/admin/…`, `/jobs/…`) redirect to their new homes.

## Run locally

```bash
cd app
npm install
npm run dev
```

Open `http://localhost:3000` and choose an app. To try it on a phone on the same Wi-Fi, open `http://<your-computer-ip>:3000/driver` or `/owner` (add the IP to `allowedDevOrigins` in `next.config.ts` if it isn't `192.168.1.78`).

**Installing on a phone:** open `/driver` or `/owner`, then use Android Chrome's **Install app** or iPhone Safari's **Share → Add to Home Screen**. Android only offers a real install over HTTPS (localhost counts). On a plain `http://192.168…` address it adds a shortcut instead. The microphone and location have the same HTTPS requirement.

For an interview demo, open **Interview mode** (`/demo`), tap **Start as the owner** to show Company setup, then **Start scenario** on your phone. **Reset demo** restores the sample jobs.

## Test and verify

```bash
cd app
npm test            # Vitest: totals, GST, workflow gate, consent versions, invoice-before-payment, audit, export, owner dashboard
npm run build
npm run test:e2e    # Playwright: driver app + main flow on a phone, owner app on a laptop and a phone (needs the build; uses your installed Chrome)
```

Screenshot tour for design review: `SHOTS=<folder> npx playwright test --project=screens`.
