# 📖 Building a Non-Custodial QR Merchant Settlement Layer on Stellar & Soroban

> **Author:** StellarPe Engineering Team  
> **Topic:** Point-of-Sale Commerce, Soroban Smart Contracts, SEP-7, SEP-38, and SEP-24 Anchor Off-Ramp

---

## Introduction

Accepting cryptocurrency at a physical point-of-sale has historically been plagued by two major challenges:
1. **The Merchant Usability Barrier:** Small merchants (canteens, coffee shops, campus stalls) cannot and should not be expected to manage seed phrases, calculate gas limits, or navigate crypto volatility.
2. **The Settlement Lag:** Merchants need local currency in their bank accounts to pay suppliers and operating expenses at the end of the day.

In this tutorial, we explore how **StellarPe** leverages the Stellar Network and Soroban smart contracts to build a frictionless, QR-based settlement layer that allows customers to pay with digital dollars (USDC) while merchants receive instant INR in their bank accounts.

---

## 1. Architecture Overview

StellarPe combines four core building blocks:

```
[ Customer Wallet ] 
       │ (1. Scans SEP-7 QR & signs transfer)
       ▼
[ Soroban Settlement Contract ] ──(2. Emits PaymentReceived Event)──► [ Horizon / RPC Listener ]
       │                                                                      │
       │ (3. State recorded on-chain)                                         │ (4. Updates POS UI < 4s)
       ▼                                                                      ▼
[ Unsettled Merchant Balance ] ──(5. 1-Tap Settle)──► [ SEP-38 FX Quote & SEP-24 Anchor Off-Ramp ]
                                                                      │
                                                                      ▼
                                                          [ Local Bank / UPI Payout ]
```

---

## 2. Dynamic SEP-7 QR Code Generation

To ensure compatibility with mobile wallets like **Lobstr**, **Freighter Mobile**, and **StellarX**, payment requests are encoded using the **SEP-7 URI scheme**:

```javascript
// Constructing the SEP-7 payment deep-link URI
function generateSep7PaymentUri({ merchantWallet, amount, merchantId }) {
  const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  
  return `web+stellar:pay?destination=${merchantWallet}` +
         `&amount=${encodeURIComponent(amount)}` +
         `&asset_code=USDC` +
         `&asset_issuer=${USDC_ISSUER}` +
         `&memo=${encodeURIComponent(merchantId)}` +
         `&memo_type=text`;
}
```

---

## 3. Soroban Settlement Smart Contract

The on-chain settlement logic is written in Rust using Soroban SDK v21.

```rust
#[contractimpl]
impl SettlementContract {
    pub fn record_payment(
        env: Env,
        merchant_id: Symbol,
        payer: Address,
        amount: i128,
        asset: Symbol,
    ) {
        // Enforce cryptographic authorization
        payer.require_auth();

        let mut balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::MerchantBalance(merchant_id.clone()))
            .unwrap_or(0);

        balance += amount;
        env.storage()
            .persistent()
            .set(&DataKey::MerchantBalance(merchant_id.clone()), &balance);

        // Emit on-chain event for real-time frontend detection
        env.events().publish(
            (symbol_short!("pay_rec"), merchant_id),
            (payer, amount, asset),
        );
    }
}
```

---

## 4. Automated Anchor Payout (SEP-38 & SEP-24)

When the merchant taps **"Settle to Bank"**, the backend orchestrates a non-custodial fiat off-ramp:
1. **SEP-38 Rate Lock:** Queries the Stellar anchor for real-time USDC $\to$ INR conversion.
2. **SEP-24 Interactive Off-Ramp:** Authorizes the payout session with `testanchor.stellar.org`.
3. **Soroban State Reconciliation:** Invokes `mark_settled()` on-chain to debit the merchant's unsettled balance and logs the bank UTR reference.

---

## Conclusion

Stellar’s sub-cent transaction costs, sub-5-second finality, and standardized anchor ecosystem make it the premier blockchain for real-world merchant commerce.

Check out the full open-source code at [github.com/Gamferno/stellar-pay](https://github.com/Gamferno/stellar-pay).
