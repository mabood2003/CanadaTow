# CanadaTow

TowLedger is a phone-first Alberta towing workflow prototype designed to support estimate, consent, invoice, and record-keeping for consumer-directed tows.

## Prototype status

This repository includes a full interactive TowLedger prototype for the Alberta tow workflow, including:

- app setup and phone-ready shell
- company onboarding and operator profile setup
- requester and workflow screens
- consent capture flow and tow details
- estimate builder, review and customer link
- consent method and tow gate
- tow status and invoice flow
- compliance records and office jobs list
- offline banner and demo scenarios

The home screen includes a company setup panel so the business profile, yard, and invited drivers are part of the operating workflow instead of a static mockup.

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

For example, on this machine the local network preview is:

```text
http://192.168.1.78:3000
```

## Test and verify

```bash
cd app
npm test
npm run build
```
