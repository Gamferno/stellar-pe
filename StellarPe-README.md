# StellarPe — QR Merchant Settlement Layer on Stellar

> Accept digital dollars. Get rupees. No crypto knowledge required.

**Stellar Journey to Mastery — Level 4 (Green Belt) Submission**

[![Stellar](https://img.shields.io/badge/Built%20on-Stellar-brightgreen)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Smart%20Contracts-Soroban-blue)](https://soroban.stellar.org)
[![Network](https://img.shields.io/badge/Network-Testnet-orange)]()

---

## Table of Contents
- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Why Stellar](#why-stellar)
- [Target Users](#target-users)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Smart Contract](#smart-contract)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [User Onboarding & Proof of Usage](#user-onboarding--proof-of-usage)
- [Feedback Collection](#feedback-collection)
- [Analytics & Monitoring](#analytics--monitoring)
- [Mobile Responsiveness](#mobile-responsiveness)
- [Screenshots](#screenshots)
- [Live Demo](#live-demo)
- [Roadmap](#roadmap)
- [Submission Checklist](#submission-checklist)
- [License](#license)

---

## Overview

**StellarPe** is a QR-based point-of-sale settlement layer that lets small merchants (campus canteens, hostel stalls, local shops) accept stablecoin (USDC) payments from customers who hold digital dollars but no local bank rail — international students, exchange-program students, NRI relatives, and remote-paid freelancers — and instantly settle those earnings into a familiar operating currency via Stellar's anchor network.

The merchant never has to hold, understand, or manage crypto. They scan out a QR, get paid on-chain in seconds, and cash out through a hosted withdrawal flow exactly the way they'd expect from any digital payment app.

## Problem Statement

International/exchange students, NRI relatives, and remote-paid freelancers around Indian college campuses frequently hold digital dollars (USDC/USDT) with no easy way to spend them locally. To pay a canteen or shop today, they'd have to first route through a centralized exchange to convert to INR — a process that takes hours to days and costs 1–3% in fees — so in practice they simply don't spend it locally, and merchants lose that revenue entirely. There is no simple point-of-sale that lets a merchant accept a stablecoin QR payment and receive INR in their bank account the same day, without needing to understand or hold crypto themselves.

## Why Stellar

- **Speed & cost:** Stellar settles in seconds at under 1 US cent per 100,000 operations — payment confirmation is near-instant at the point of sale, unlike traditional crypto rails.
- **Anchors:** Stellar's anchor network is purpose-built to connect the network to local banking rails, letting merchant earnings convert "back to a single operating currency" — this is a named use case (Merchant Settlement) in Stellar's own payments documentation.
- **Atomic settlement via Soroban:** the contract only marks a sale "closed" once payment is confirmed on-chain, removing chargeback risk entirely — something card/UPI rails can't offer.
- **Standardized on-ramp/off-ramp flow:** SEP-10 (auth), SEP-38 (quote), and SEP-24 (hosted withdrawal) are open, well-documented standards, meaning the settlement layer isn't locked to one anchor or one country as the product grows.

## Target Users

| Segment | Description |
|---|---|
| **Primary** | Small merchants near campuses/areas with international footfall (canteens, hostels, stationery shops, cafes) who want to accept digital-dollar payments without learning crypto. |
| **Secondary** | International/exchange students and remote-paid freelancers holding stablecoins with no easy way to spend them locally. |
| **Tertiary** | Stellar anchors, who gain real merchant-settlement transaction volume in a market currently underserved. |

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐         ┌────────────────────┐
│   Customer       │  scan   │   Merchant PWA        │  REST   │   Backend Service   │
│  (Stellar Wallet │────────▶│   (React + Tailwind)  │────────▶│   (Node + Fastify)  │
│   / Freighter)   │  sign   │   QR gen, live status │         │   SEP-10/38/24      │
└─────────────────┘         └──────────────────────┘         └─────────┬──────────┘
                                        ▲                               │
                                        │ event poll                   │ auth / quote / withdraw
                                        │                               ▼
                              ┌──────────────────────┐        ┌────────────────────┐
                              │  Soroban Contract      │        │   Anchor (SEP-24)   │
                              │  (settlement + events) │◀───────│  SDF reference /     │
                              │  Testnet                │  fund │  sandbox anchor      │
                              └──────────────────────┘        └────────────────────┘
                                        │
                                        ▼
                              ┌──────────────────────┐
                              │   SQLite               │
                              │   merchants, txns,     │
                              │   feedback, events log  │
                              └──────────────────────┘
```

**Data flow:**
1. Customer scans merchant's QR (amount + contract address) and signs a stablecoin transfer with their wallet.
2. The Soroban contract receives the transfer, logs it against the merchant ID + timestamp, and emits a `PaymentReceived` event.
3. The merchant PWA polls Stellar RPC, detects the event, and instantly shows "Paid ✅".
4. Merchant taps **Settle to Bank** → backend requests a SEP-38 quote → initiates SEP-24 hosted withdrawal → merchant completes the anchor's webview flow.
5. Anchor webhook confirms settlement → backend updates transaction status → merchant sees "Settled" in their dashboard.

## Tech Stack

- **Smart Contract:** Soroban (Rust)
- **Frontend:** React + Tailwind CSS (PWA, mobile-first)
- **Backend:** Node.js + Fastify
- **Database:** SQLite
- **Wallet Integration:** Freighter (Stellar Wallet Kit)
- **Anchor Integration:** SEP-10, SEP-38, SEP-24 against SDF reference/sandbox anchor
- **Monitoring:** Sentry (error tracking) + PostHog or self-hosted event logging (product analytics)
- **Deployment:** [TODO: e.g. Vercel (frontend) + Railway/Render (backend)]

## Smart Contract

**Network:** Stellar Testnet
**Contract ID:** `[TODO: paste deployed contract address here]`
**Explorer link:** `[TODO: https://stellar.expert/explorer/testnet/contract/<CONTRACT_ID>]`

### Core functions

| Function | Description |
|---|---|
| `record_payment(merchant_id, payer, amount, asset)` | Called on receipt of a stablecoin transfer; validates auth, stores the sale record, emits `PaymentReceived`. |
| `get_merchant_balance(merchant_id)` | Returns the merchant's current unsettled on-chain balance. |
| `mark_settled(merchant_id, amount, tx_ref)` | Called by the backend once an off-chain SEP-24 withdrawal is confirmed, to reconcile state. |

### Events

- `PaymentReceived { merchant_id, payer, amount, timestamp }`
- `SettlementConfirmed { merchant_id, amount, anchor_tx_ref }`

## Project Structure

```
stellarpe/
├── contracts/
│   └── settlement/
│       ├── src/lib.rs
│       ├── src/test.rs
│       └── Cargo.toml
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.sep10.js
│   │   │   ├── quote.sep38.js
│   │   │   └── withdraw.sep24.js
│   │   ├── services/
│   │   │   ├── stellarEventListener.js
│   │   │   └── anchorClient.js
│   │   ├── db/schema.sql
│   │   └── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── QRGenerator.jsx
│   │   │   ├── PaymentStatus.jsx
│   │   │   ├── SettleButton.jsx
│   │   │   └── FeedbackForm.jsx
│   │   ├── hooks/useFreighter.js
│   │   ├── pages/Dashboard.jsx
│   │   └── App.jsx
│   └── package.json
├── docs/
│   └── screenshots/
├── README.md
└── LICENSE
```

## Getting Started

```bash
# Clone
git clone https://github.com/<your-username>/stellarpe.git
cd stellarpe

# Contract
cd contracts/settlement
stellar contract build
stellar contract deploy --network testnet --source <your-key>

# Backend
cd ../../backend
npm install
cp .env.example .env   # add anchor URL, contract ID, DB path
npm run dev

# Frontend
cd ../frontend
npm install
npm run dev
```

**Environment variables (backend `.env`):**
```
STELLAR_NETWORK=testnet
CONTRACT_ID=<deployed contract id>
ANCHOR_HOME_DOMAIN=testanchor.stellar.org
SEP10_SIGNING_KEY=<your key>
DATABASE_PATH=./data/stellarpe.sqlite
SENTRY_DSN=<optional>
```

## User Onboarding & Proof of Usage

**Target:** 10+ real users with verifiable wallet interactions.

Suggested pilot group:
- 3–5 merchant accounts (canteen/stall owners on campus, or friends role-playing merchants for the pilot).
- 5–10 payer accounts (classmates using testnet Freighter wallets funded via Friendbot) making real QR-scan payments.

**Proof to collect for submission:**
- Screenshot list of on-chain transaction hashes per user (linkable on [stellar.expert testnet explorer](https://stellar.expert/explorer/testnet)).
- A simple `users.csv` or table logged in the backend: `wallet_address, first_interaction_date, num_transactions`.
- Screen recording of at least 2–3 different wallets completing a full pay → settle cycle.

## Feedback Collection

- In-app feedback form after a successful "Settled" state (`FeedbackForm.jsx`) — a 1–5 rating + free-text field, stored in a `feedback` table (`user_wallet, rating, comment, timestamp`).
- Alternative/backup: a short Google Form linked from the dashboard, with responses exported into the submission.
- Submission should include a **feedback summary**: e.g., *"8 of 10 users rated the settlement flow 4★ or higher; main friction point noted was wallet connection on first use."*

## Analytics & Monitoring

- **Error tracking:** Sentry free tier — wrap backend routes and frontend error boundaries.
- **Product analytics:** PostHog (free tier) or a lightweight self-logged `events` table (`event_name, wallet_address, metadata, timestamp`) tracking: `qr_generated`, `payment_signed`, `payment_confirmed`, `settlement_initiated`, `settlement_confirmed`.
- Screenshot the analytics dashboard (PostHog) or a simple query output from the `events` table for the submission checklist.

## Mobile Responsiveness

Built mobile-first with Tailwind CSS breakpoints — QR display, payment status, and settlement flow are all tested on a phone-width viewport, since most merchants and student payers will use this on a phone rather than a desktop. Screenshot both desktop and mobile views for submission.

## Screenshots

*(Add after build — required for submission)*

- [ ] Product UI — merchant dashboard, QR generation screen
- [ ] Payment flow — customer scanning and signing
- [ ] Mobile responsive views (dashboard + payment flow on phone width)
- [ ] Analytics/monitoring dashboard (PostHog or Sentry)
- [ ] Settlement confirmation screen

## Live Demo

- **Live app:** `[TODO: deployment URL]`
- **Demo video:** `[TODO: video link — Loom/YouTube unlisted, 3–5 min walkthrough of full flow]`
- **Contract explorer link:** `[TODO]`

## Roadmap

- **MVP (Level 4 — this submission):** Soroban settlement contract on Testnet, merchant PWA with QR generation and live status, full SEP-10/38/24 flow demoed end-to-end against the SDF sandbox anchor, 10+ real users onboarded.
- **User acquisition (Level 5–6):** Expand pilot to 30+ real payers and 5–10 real merchants near campus; iterate on onboarding friction from feedback; publish progress on X under #StellarJourneyToMastery.
- **Mainnet vision (Level 6–7):** Launch on Mainnet, pursue a real INR-capable anchor partnership, complete a security review of the settlement contract, expand merchant coverage across multiple campuses/local markets.

## Submission Checklist

- [ ] Public GitHub repository
- [ ] README with complete documentation *(this file)*
- [ ] Minimum 15+ meaningful commits
- [ ] Live demo link
- [ ] Contract deployment address (Testnet)
- [ ] Screenshots: Product UI, mobile responsive design, analytics/monitoring
- [ ] Demo video link
- [ ] Proof of 10+ user wallet interactions
- [ ] Basic user feedback summary

## License

MIT — see [LICENSE](./LICENSE)
