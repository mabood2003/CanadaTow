# TowLedger — build brief for Claude Code

TowLedger is a phone-first web app (PWA) that helps Alberta tow operators follow the
Vehicle Towing and Storage Regulation (in force April 1, 2026). Drivers use it at the roadside;
the office uses the same app on a laptop. Ontario comes later.

Repo: https://github.com/mabood2003/CanadaTow · App name everywhere: **TowLedger**.

Build milestone by milestone. After each one: run the app, run the tests, commit, and stop so
we can review on our phones before continuing.

## The one question the product must answer

"If my company gets a consumer-directed Alberta tow tomorrow, does this make it easier for my
driver and office to complete the estimate, consent, invoice and records correctly?"
Anything that doesn't serve that question stays out.

## Alberta rules the app supports

Source: https://www.alberta.ca/vehicle-towing-and-storage-regulation

1. **Consent before towing**, recorded as written, electronic or audio. Store who consented,
   their relationship to the vehicle, method, date and time.
2. **Written estimate before the tow**, in a form the customer keeps (text/email link, shown on
   the driver's device, or printed). Includes towing and storage costs, the consenting person's
   name and a contact detail, and the business name and address.
3. **Itemized invoice before payment**: customer, business, vehicle, service locations,
   dates and times, itemized costs.
4. **Keep estimates, consents and invoices at least 3 years.** Electronic records allowed.
5. **Notify the owner if the vehicle is moved** to another location.
6. **Police / government-directed tows** follow a different workflow; the reason is recorded.

## Don't hard-code uncertain law

- Job classification comes from a **config table** (`request_types`), not code. Each type has
  `workflow: consumer | exempt | to_confirm` and `legal_status: confirmed | to_be_confirmed`.
  Seed: owner/customer → consumer (confirmed); police, municipality/government → exempt (confirmed);
  private-property owner, motor club, insurance, owner's representative, other → to_confirm.
  `to_confirm` jobs default to the full consumer workflow and are labelled
  "Classification to be confirmed" internally. Never tell the user a job "is exempt" unless confirmed.
- **No "10% over estimate" rule.** If the invoice differs from the consented estimate, show a
  neutral warning — "Final amount differs from estimate — confirm customer authorization" — and
  offer a re-consent step. Don't block on a percentage until counsel confirms one.
- Never call the app "compliant" in the UI. Say "built for Alberta's towing rules."

## Guardrails (the core value — test these)

- **Tow gate:** "Start tow / Vehicle secured" is locked until estimate sent ✓, consent captured ✓,
  destination confirmed ✓ — unless the job's workflow is exempt. Before that, show a red banner:
  "Do not begin tow — consent missing."
- **Invoice before payment:** "Record payment" is locked until the invoice is issued.
- Issued estimates, consents and invoices are immutable; changes create a new version.
- Every state change writes an append-only audit log row (who, what, when, device).

## Screens (from our prototype plan)

Driver (phone):
1. **Home** — company logo/name, driver name, one big "New Tow" button, 2–3 recent jobs with
   status chips (Complete / Missing invoice / Waiting for consent). No dashboards or maps.
2. **Who requested this tow?** — big tap targets: Vehicle owner/customer, Owner's representative,
   Motor club / roadside assistance, Insurance company, Police, Municipality/government,
   Private-property owner, Other. Plus "Who contacted/invited your company?" (for the 200 m
   collision-scene rule).
3. **Workflow screen** — shows the steps that apply: "Consumer workflow: Estimate → Consent → Tow →
   Invoice → Record" or "Different/exempt workflow — reason recorded."
4. **Consenting person** — name, mobile, email (optional), relationship (Owner / Driver / Family
   member / Insurance rep / Motor-club rep / Other), "Customer is physically present" checkbox.
   Not present → steer toward link or audio consent.
5. **Vehicle and tow details** — plate + province, make, model, colour, pickup ("Use current
   location" if permitted), requested destination, "Destination confirmed by customer" checkbox.
6. **Estimate builder** — auto-built from the rate card (hook-up, km × rate, winching,
   after-hours, storage per day); add/remove items; clear estimated total with GST.
7. **Estimate review** — exactly what the customer receives; send by Text, Email,
   Show on this device, or Print (Print can be a placeholder for now).
8. **Customer estimate page** `/e/[token]` — no login or app; company, items, total,
   destination, storage rate, plain-language rights note, "I consent" and "I have a question".
9. **Consent method** — customer taps link / signs on driver's phone / audio consent recorded /
   paper form photographed. Always record name, relationship, method, date and time.
10. **Ready to tow** — green checklist: Estimate sent ✓ Consent captured ✓ Destination confirmed ✓
    → "Tow may begin."
11. **Tow in progress** — pickup, destination, customer, estimate, consent status; timestamp
    buttons: Arrived, Vehicle secured, Departed, Delivered. "Destination changed" asks who
    authorized it and why, and records the notice to the owner.
12. **Invoice builder** — auto-filled from the job; edit quantities or add a charge; the neutral
    difference warning; big "Issue invoice before recording payment."
13. **Customer invoice page** — same link: invoice number, details, line items, total,
    Download PDF. No payments.
14. **Completed job / compliance file** — "Compliance file complete" with ✓ Estimate, Copy
    delivered, Consent, Invoice, Vehicle details, Locations/times, Archived. Buttons: view
    estimate, consent, invoice, audit trail; Export job file (zip).
15. **Problem state** — same screen for an incomplete job: "Compliance incomplete: invoice not
    issued" / "Consent evidence missing," with the fix-it action.

Office (laptop or phone):
16. **Jobs list** — date, vehicle, driver, request type, estimate, consent, invoice, status;
    search by plate or customer name; click opens screen 14/15.

Offline:
17. **Offline banner** — "Offline — job saved on this device and will sync when connection
    returns." Customer can't receive text/email → show on driver's device, print or paper photo.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS; installable PWA (Serwist service worker).
- Zod schemas shared by forms and server actions.
- Supabase in the **Canada (Central)** region: Postgres, Auth (email magic link), Storage for
  photos, audio and PDFs. Row-level security so each company sees only its own data.
- Offline: IndexedDB (Dexie) for jobs + a sync queue; photos/audio queue and upload later.
- Signature pad on canvas (PNG + metadata). Audio via MediaRecorder.
- PDFs server-side (@react-pdf/renderer); store a SHA-256 hash of each PDF.
- Texts via Twilio (Canadian number), email via Resend. In development, log instead of sending.
- Tests: Vitest (totals, GST, guardrails, classification), Playwright (main flow on a phone viewport).

## Data model

companies (name, address, phone, gst_number, logo) · users (company_id, role: owner | driver) ·
rate_cards · storage_yards (name, address, hours) · request_types (label, workflow, legal_status) ·
jobs (request_type_id, invited_by, exempt_reason, status, pickup, destination,
destination_confirmed, timestamps arrived/secured/departed/delivered) · customers ·
vehicles (plate, province, make, model, year, colour) · estimates (versioned, items, totals,
delivered_via, delivered_at, public_token) · consents (estimate_id, name, relationship, present,
method: link | signature | audio | paper_photo, at, evidence_path) · destination_changes
(authorized_by, reason, notified_at) · photos · invoices + items (issued_at) · payments ·
audit_log (append-only).

Money in integer cents. GST 5%. Store UTC, display America/Edmonton.

## Milestones

1. **Setup** — Next.js + Supabase + Tailwind + PWA shell, auth, company onboarding (profile,
   rate card, one yard), invite drivers, seed a demo company with sample jobs (one complete,
   one problem-state). README with setup steps.
2. **Screens 1–5** — home, requester, workflow, consenting person, vehicle/tow details.
3. **Screens 6–10** — estimate builder, review/send, customer page, consent methods, tow gate.
4. **Screens 11–13** — tow in progress (incl. destination change), invoice, customer invoice page.
5. **Screens 14–16** — compliance file, problem state, office jobs list, export.
6. **Offline** — screen 17 and the sync queue.
7. **Interview mode** — a demo company with two scripted scenarios (collision tow a customer
   called in; a motor-club/insurer breakdown tow with preset rates) and a private-property/police
   case, resettable in one tap.

## Not in the pilot

Ontario, dispatch, route optimization, live GPS, payments, QuickBooks, scheduling, truck
maintenance, CRM, analytics, native app-store builds, elaborate settings, French.

## Working rules

- Ask before adding a dependency not listed here.
- Secrets in `.env.local`; commit `.env.example`.
- Small commits per milestone; keep the README current.
