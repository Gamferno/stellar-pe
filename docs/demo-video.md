# 🎬 StellarPe — Product Demo Walkthrough & Video Guide

> **Live Application Demo & High-Definition Walkthrough Suite**  
> Complete interactive recordings showcasing end-to-end merchant onboarding, SEP-7 QR generation, Soroban smart contract payment execution, SEP-38/24 off-ramp settlement, user feedback collection, and mobile POS responsiveness.

---

## 📹 Video Walkthrough Index

| Segment | Topic | File (Animated WebP) | 1080p MP4 Download | Key Actions & Protocols |
|:---|:---|:---|:---|:---|
| **01** | **Merchant Onboarding & POS Dashboard** | [`full_demo_01_landing.webp`](./full_demo_01_landing.webp) | [`full_demo_01_landing.mp4`](./full_demo_01_landing.mp4) | Freighter connect, testnet resolution, unsettled balance, POS metrics |
| **02** | **Dynamic SEP-7 QR Generator** | [`full_demo_02_qr_generator.webp`](./full_demo_02_qr_generator.webp) | [`full_demo_02_qr_generator.mp4`](./full_demo_02_qr_generator.mp4) | Custom USD amount input, Freighter Address vs Lobstr SEP-7 mode, copy memo, SVG export |
| **03** | **Instant Customer Payment & Soroban** | [`full_demo_03_instant_payment.webp`](./full_demo_03_instant_payment.webp) | [`full_demo_03_instant_payment.mp4`](./full_demo_03_instant_payment.mp4) | QR scan simulation, Soroban `record_payment` contract call, $< 4$s detection, StellarExpert link |
| **04** | **1-Tap Bank Settlement (SEP-38/24)** | [`full_demo_04_settlement.webp`](./full_demo_04_settlement.webp) | [`full_demo_04_settlement.mp4`](./full_demo_04_settlement.mp4) | Live SEP-38 quote, 4-stage pipeline (Soroban Lock $\to$ Anchor Quote $\to$ IMPS Rail $\to$ UTR Receipt) |
| **05** | **User Feedback & Real-Time Analytics** | [`full_demo_05_feedback_analytics.webp`](./full_demo_05_feedback_analytics.webp) | [`full_demo_05_feedback_analytics.mp4`](./full_demo_05_feedback_analytics.mp4) | Post-settlement 5-star rating, qualitative review submission, live aggregate rating update |
| **06** | **Mobile Responsiveness (375px)** | [`full_demo_06_mobile.webp`](./full_demo_06_mobile.webp) | [`full_demo_06_mobile.mp4`](./full_demo_06_mobile.mp4) | iPhone 375px viewport, touch ergonomics, mobile QR display, sticky actions |

---

## 🔍 Detailed Walkthrough Breakdown

### Segment 01: Merchant Onboarding & POS Dashboard
- **File**: `docs/full_demo_01_landing.webp` / `docs/full_demo_01_landing.mp4`
- **Description**: Demonstrates how a non-technical merchant accesses the dark-mode POS terminal (`#0B0E14`), clicks *Explore Demo Merchant*, connects their Stellar wallet (`GAAYOENQOYZAGPAMBOVDDIE7LFXRH6Z4QKFPX4X5RGADDVKV33P4QNEP`), and immediately views their unsettled balance (`$20.50 USDC` / `₹1,711.75 INR`) alongside real-time business statistics.
- **Protocols**: Stellar Horizon Account Resolver, Freighter Wallet Integration.

### Segment 02: Dynamic SEP-7 QR Code Generator & Mode Switcher
- **File**: `docs/full_demo_02_qr_generator.webp` / `docs/full_demo_02_qr_generator.mp4`
- **Description**: The merchant types `$25.00 USDC` and clicks *Generate QR Code*. The system renders a crisp vector QR code and allows toggling between **Freighter Address Mode** (raw `G...` address with memo) and **Lobstr Mode** (standardized `web+stellar:pay?destination=...&amount=25.00&memo=...` SEP-7 deep link). Includes 1-tap clipboard copy with animated green feedback and high-resolution SVG export.
- **Protocols**: SEP-0007 (Stellar URI Scheme), SVG QR Generation.

### Segment 03: Instant Customer Payment & Soroban Execution
- **File**: `docs/full_demo_03_instant_payment.webp` / `docs/full_demo_03_instant_payment.mp4`
- **Description**: Simulates a customer scanning the QR code and submitting an on-chain payment. The Soroban smart contract executes `record_payment(merchant, payer, amount, asset)` on Stellar Testnet ledger. The frontend payment listener captures the confirmation in $< 4$ seconds, updates the live balance, and displays the direct transaction explorer link to StellarExpert.
- **Protocols**: Soroban Rust Smart Contract (`CCCEJOC6FP2GV2MFSAZF7LNECT7QZ3BRYMZQ5OBEH3SOJWIVJN5T7ALS`), Horizon SSE Event Stream.

### Segment 04: 1-Tap Bank Settlement via Stellar Anchor (SEP-38 & SEP-24)
- **File**: `docs/full_demo_04_settlement.webp` / `docs/full_demo_04_settlement.mp4`
- **Description**: Merchant initiates settlement to off-ramp USDC to INR. The modal displays a real-time SEP-38 anchor FX quote (`1 USDC = ₹83.50 INR`). Upon clicking *Confirm & Settle*, the 4-stage pipeline stepper executes live:
  1. **Soroban Smart Contract Execution**: Locks unsettled balance on-chain via `mark_settled()`.
  2. **Stellar Anchor Handshake (SEP-24 / SEP-38)**: Obtains off-ramp session authentication.
  3. **Inter-Bank Clearance (IMPS / UPI Rail)**: Routes payout to beneficiary VPA (`canteen.merchant@upi`).
  4. **Bank Confirmation & Reconciliation**: Issues official Bank IMPS UTR Reference (`UTR: IMPS2026...`).
- **Protocols**: SEP-0024 (Interactive Deposit & Withdrawal), SEP-0038 (Anchor RFQ & FX Rates), Soroban Settlement State Machine.

### Segment 05: In-App User Feedback & Real-Time Analytics
- **File**: `docs/full_demo_05_feedback_analytics.webp` / `docs/full_demo_05_feedback_analytics.mp4`
- **Description**: Following successful settlement, the merchant is presented with an interactive feedback module. Selecting 5 stars highlights the star row in gold; the cashier inputs qualitative product feedback (*"Super fast settlement to UPI via Stellar anchor!"*) and submits. The backend SQLite ledger immediately recalculates aggregate ratings and updates the POS analytics cards in real time.
- **Data Integration**: Connects with the [50-User Feedback Dataset](../docs/user-onboarding-feedback.csv) and [Live Google Sheet](https://docs.google.com/spreadsheets/d/1eKBwsXOFj4yKcJeSGzq-qwSa0wQsWjaeWOTdyn2NG0A/edit?usp=sharing).

### Segment 06: Mobile Cashier Responsiveness (375px iPhone Viewport)
- **File**: `docs/full_demo_06_mobile.webp` / `docs/full_demo_06_mobile.mp4`
- **Description**: Demonstrates full mobile responsive design on a 375x812 viewport. Tests mobile touch targets, responsive card stacking, mobile QR display mode (for showing directly to customers across a counter), and compact navigation.

---

## 🛠️ How to Re-generate Walkthrough Recordings Locally

The demo recordings are fully automated using a custom Puppeteer screen capture and FFmpeg encoding engine:

```bash
# 1. Start the backend API server
node backend/src/server.js &

# 2. Start the Vite frontend
npm run dev --prefix frontend -- --port 5173 &

# 3. Run the automated recording engine
cd backend && node record_authentic_demos.mjs
```

All 6 segments will be captured frame-by-frame and encoded into:
- Looping Animated WebP (`docs/full_demo_*.webp` for GitHub README embedding)
- 1080p MP4 (`docs/full_demo_*.mp4` for external media players)
