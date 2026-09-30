# CanadaTow

TowLedger is a phone-first Alberta towing workflow designed to support estimate, consent, invoice, and record keeping for consumer-directed tows.

## Milestone 1 — app setup

This repo now includes a working Next.js app shell in the [app](app) folder with:

- a TowLedger branded landing screen for the driver
- a demo company profile and recent job list
- a basic PWA manifest and phone-first layout
- a simple rule engine for GST and tow-gate guardrails
- an initial Vitest check for the key compliance calculations

## Run locally

```bash
cd app
npm install
npm run dev
```

The app listens on `http://localhost:3000` by default. To preview it on a phone on the same network, open:

```text
http://<your-computer-ip>:3000
```

If the phone is on the same Wi‑Fi network as your laptop, this is usually the fastest way to review the app before continuing to the next milestone.

## Test

```bash
cd app
npm test
```
