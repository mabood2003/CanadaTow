# TowLedger

TowLedger is a phone-first web app that helps Alberta towing companies deliver estimates, capture their own consent process, issue invoices and keep one complete record per job. Drivers use it at the roadside; the office uses the same app on a laptop.

**Product boundary:** each towing company controls its forms, rates, wording and workflows. TowLedger provides tools to deliver, capture, organize and retain the resulting records. It doesn't decide which legal rules apply to a job.

## What's in the prototype

Everything runs on the device (localStorage) with a fictional demo company, **Summit Towing Ltd.** Supabase, real text/email sending and server PDFs come later.

| Area | Where |
| --- | --- |
| Company setup (owner, desktop): profile & logo, rate cards, job categories → workflows A–D, consent template with version history and enabled methods, document templates, team | `/admin` |
| Driver flow (phone): home → who requested → company workflow → customer → vehicle & job → estimate → preview & delivery (incl. dead-phone fallback) → consent → ready to proceed → tow → invoice | `/` then **New Tow** |
| Customer link (no login): branded estimate, the company's consent wording, invoice on the same link, Download PDF / Email copy | `/e/<token>`, `/i/<token>` |
| Job record: estimate, delivery record, consent evidence (template version + exact wording), invoice, photos, timeline, notes, "Needs attention" state, export package (.zip) | `/jobs/<id>` |
| Audit trail (desktop, append-only) | `/jobs/<id>/audit` |
| Office jobs list: workflow column, driver/status/date filters, search | `/office` |
| Interview mode: start as owner, three scripted scenarios, simulate offline, one-tap reset | `/demo` |

Guardrails (unit-tested): the tow can't start until the company's configured pre-tow steps are done; payment can't be recorded before the invoice is issued; issued estimates, consents and invoices never change (corrections create new versions); every change writes an audit row.

The look matches the TowLedger website (cream, forest green, signal lime).

## Run locally

```bash
cd app
npm install
npm run dev
```

Open `http://localhost:3000`. To try it on a phone on the same Wi-Fi, open `http://<your-computer-ip>:3000` (add the IP to `allowedDevOrigins` in `next.config.ts` if it isn't `192.168.1.78`).

For an interview demo, open **Interview mode** (`/demo`), tap **Start as the owner** to show Company setup, then **Start scenario** on your phone. **Reset demo** restores the sample jobs.

## Test and verify

```bash
cd app
npm test            # Vitest: totals, GST, workflow gate, consent versions, invoice-before-payment, audit, export
npm run build
npm run test:e2e    # Playwright on a phone + desktop viewport (needs the build; uses your installed Chrome)
```

Screenshot tour for design review: `SHOTS=<folder> npx playwright test --project=screens`.
