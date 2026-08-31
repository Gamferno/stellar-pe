# 📊 StellarPe Pitch Deck Guide & Slide Notes

> **Interactive HTML Presentation:** [Launch `docs/pitch-deck.html`](./pitch-deck.html)

---

## Slide 1: Title & Tagline
- **Headline:** StellarPe — Accept digital dollars. Get rupees. No crypto knowledge required.
- **Key Metrics:** 52+ Verified Users · < 4s Soroban Settlement · 4.88/5.0 Pilot Satisfaction
- **Speaker Note:** Welcome everyone. Today we are presenting StellarPe — a point-of-sale settlement layer built on Stellar and Soroban that empowers everyday campus merchants to accept stablecoins instantly.

---

## Slide 2: The Problem
- **Headline:** The Local Spending Friction
- **Core Issues:**
  - Off-ramp delays (1–3 days via traditional centralized exchanges)
  - Hidden FX markups & wire fees (2–4%)
  - Merchant technical complexity (seed phrases, gas fees, crypto volatility)
- **Speaker Note:** International students, exchange researchers, and remote freelancers hold USDC, but local canteens and shops can only take local fiat. Converting takes days and incurs high fees.

---

## Slide 3: The Solution
- **Headline:** QR Point-of-Sale Settlement Layer
- **3-Step Flow:**
  1. Dynamic SEP-7 QR Code generation in USDC
  2. Soroban smart contract verification on Stellar Testnet
  3. 1-Tap Anchor Bank Off-Ramp via SEP-38 & SEP-24
- **Speaker Note:** StellarPe allows merchants to generate a payment QR in seconds, validates payments on-chain with Soroban, and routes the funds directly to bank accounts via Stellar's anchor network.

---

## Slide 4: Architecture & Standards
- **Headline:** Powered by Stellar & Soroban
- **Contracts & Protocols:**
  - Soroban Settlement Contract (`CCCEJOC6FP...`) with `record_payment` and `mark_settled`
  - SEP-7 (Payment URIs)
  - SEP-10 (Cryptographic Auth)
  - SEP-38 (FX Quotes)
  - SEP-24 (Hosted Off-Ramp)
- **Speaker Note:** We leverage standard Stellar Enhancement Proposals to ensure complete wallet interoperability without vendor lock-in.

---

## Slide 5: Pilot Traction & Proof
- **Headline:** 52+ Verified Testnet Users
- **Data Points:**
  - 52 unique user records logged in [`users.csv`](../users.csv) and [`user_proofs.json`](./user_proofs.json)
  - 76.9% repeat usage rate across pilot test cohort
  - 100% successful off-ramp simulation rate
- **Speaker Note:** Our pilot proved that students and canteens prefer sub-4-second QR payments over complex conversions.

---

## Slide 6: Competitive Advantage
- **Headline:** Why StellarPe Wins
- **Differentiators:**
  - Zero crypto knowledge required for merchants
  - Universal SEP-7 wallet compatibility (Lobstr, Freighter, xBull)
  - Sub-cent on-chain transaction fees
- **Speaker Note:** Traditional POS terminals charge 2-3% and do not support crypto. StellarPe settles at near-zero fees with full fiat payout.

---

## Slide 7: Revenue Model
- **Headline:** Sustainable Monetization
- **Revenue Streams:**
  - 0.35% fiat off-ramp settlement fee
  - Anchor FX spread revenue-sharing
  - B2B POS hardware & enterprise analytics tier
- **Speaker Note:** Transparent, micro-fee monetization aligned with merchant transaction volume.

---

## Slide 8: Roadmap
- **Headline:** Product & Expansion Horizon
- **Milestones:**
  - Q3 2026: Soroban testnet deployment, SEP integration, 50+ user testing (Completed ✅)
  - Q4 2026: Mainnet launch, production anchor partnership, Telegram POS bot
  - Q1 2027: Campus soundbox audio device, university chain expansion
- **Speaker Note:** Clear milestones leading to mainnet deployment and university campus rollouts.

---

## Slide 9: Conclusion
- **Headline:** Let's Build the Future of Commerce
- **Call to Action:** Source repository at [github.com/Gamferno/stellar-pay](https://github.com/Gamferno/stellar-pay)
