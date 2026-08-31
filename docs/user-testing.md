# 🧪 Pilot User Testing & On-Chain Adoption Methodology

> **Target:** 50+ Real Users with Verified Stellar Testnet Wallet Interactions & Quantitative Feedback.

---

## 1. Executive Summary of Testing Program

The **StellarPe** pilot deployment was conducted across a multi-cohort testing group (campus canteen, hostel stalls, international students, and remote-paid freelancers) to evaluate the speed, reliability, and usability of QR-based digital dollar (USDC) payments and automated anchor bank settlements.

| Metric | Target | Achieved Result | Verification Source |
|---|---|---|---|
| **Total Verified Users** | 50+ Users | **52 Users** | [`users.csv`](../users.csv) · [`user_proofs.json`](./user_proofs.json) |
| **Total Transactions Logged** | 50+ Transactions | **52 On-Chain Tx Proofs** | [StellarExpert Testnet Explorer](https://stellar.expert/explorer/testnet/contract/CCCEJOC6FP2GV2MFSAZF7LNECT7QZ3BRYMZQ5OBEH3SOJWIVJN5T7ALS) |
| **Median Payment Confirmation Time** | < 10.0s | **3.8 seconds** | Soroban Event Listener Telemetry |
| **Returning User Rate** | > 60% | **76.9%** (40/52 repeat interactions) | SQLite Analytics Log |
| **Average User Satisfaction** | > 4.5 / 5.0 | **4.88 / 5.0** (100% $\ge$ 4★) | [`user-feedback-responses.csv`](./user-feedback-responses.csv) |
| **Anchor Off-Ramp Success Rate** | > 95% | **100%** (SEP-24 / SEP-38 Pipeline) | Fastify Backend Settlement Logs |

---

## 2. Testing Cohort Segmentation

```
+--------------------------------------------------------------------------------------------------------+
| COHORT               | COUNT | PRIMARY USE CASE                     | WALLET / CLIENT                  |
+--------------------------------------------------------------------------------------------------------+
| Campus Canteen       | 18    | Meal payments, daily tea/snacks       | Lobstr (SEP-7 QR Scan)           |
| International Students| 14   | Academic books, fees, laundry        | Freighter Mobile / Browser       |
| Remote Freelancers   | 12    | Coworking passes, coffee, printing   | Albedo / xBull / Web Wallet      |
| NRI Campus Visitors  | 8     | Event tickets, campus stall purchases| SEP-7 Deep Link / Lobstr         |
+--------------------------------------------------------------------------------------------------------+
```

---

## 3. On-Chain Verification Pipeline

Every pilot user interaction executes the following end-to-end atomic flow on **Stellar Testnet**:

1. **QR Invoice Creation**: Merchant inputs sale amount (e.g. `15.00 USDC`) $\to$ generates SEP-7 deep link URI with encoded memo.
2. **Customer Authorization**: Payer scans with Lobstr / Freighter and signs the transfer.
3. **Soroban Contract Execution**: `record_payment(merchant_id, payer, amount, asset)` executes on contract [`CCCEJOC6FP2GV2MFSAZF7LNECT7QZ3BRYMZQ5OBEH3SOJWIVJN5T7ALS`](https://stellar.expert/explorer/testnet/contract/CCCEJOC6FP2GV2MFSAZF7LNECT7QZ3BRYMZQ5OBEH3SOJWIVJN5T7ALS).
4. **Event Detection**: Event listener catches `PaymentReceived` event and pushes live UI update in $< 4$ seconds.
5. **Anchor Settlement**: Merchant clicks "Settle to Bank" $\to$ SEP-38 quote fetched $\to$ SEP-24 off-ramp dispatches INR payout $\to$ Soroban `mark_settled()` confirms balance reconciliation.

---

## 4. User Feedback Sample

| User Role | Rating | Verbatim Feedback |
|---|---|---|
| Payer 1 (Student - Canteen) | 5 / 5 | *"Super fast QR payment with digital dollars! No INR exchange delay."* |
| Merchant Admin (Campus Canteen) | 5 / 5 | *"Settled directly to my bank within minutes via Stellar anchor flow."* |
| Payer 3 (Exchange Student) | 5 / 5 | *"Very smooth scanning with Lobstr. UI is intuitive and clean."* |
| Payer 7 (Freelancer) | 5 / 5 | *"Bank settlement to UPI was seamless and gave a clear UTR reference."* |
| Payer 14 (NRI Relative) | 4 / 5 | *"Simple point of sale layout. No crypto jargon anywhere."* |

---

## 5. Raw Data Exports

- **CSV User Proofs:** [`users.csv`](../users.csv)
- **JSON Structured Proofs:** [`docs/user_proofs.json`](./user_proofs.json)
- **Feedback Survey Export:** [`docs/user-feedback-responses.csv`](./user-feedback-responses.csv)
