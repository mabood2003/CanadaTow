# CanadaTow

TowLedger is a phone-first Alberta towing workflow prototype designed to support estimate, consent, invoice, and record-keeping for consumer-directed tows.

## Prototype status

This repository now includes a working full-flow prototype covering milestones 1 through 7, including:

- app setup and phone-ready shell
- requester and workflow screens
- consent capture flow and tow details
- estimate builder, review and customer link
- consent method and tow gate
- tow in progress and invoice flow
- compliance file, problem state and office jobs list
- offline banner and demo scenarios

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
