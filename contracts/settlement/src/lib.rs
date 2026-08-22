#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    symbol_short, Address, Env, String,
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    MerchantBalance(String),     // merchant_id → i128 (unsettled USDC, in stroops)
    MerchantTxCount(String),     // merchant_id → u64
    Transaction(String, u64),    // (merchant_id, index) → TxRecord
    Admin,                       // admin address allowed to call mark_settled
}

// ─── Data Types ────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TxRecord {
    pub merchant_id: String,
    pub payer: Address,
    pub amount: i128,       // in USDC stroops (1 USDC = 10_000_000 stroops)
    pub asset: String,      // e.g. "USDC"
    pub timestamp: u64,
    pub settled: bool,
    pub anchor_tx_ref: String, // empty until settled
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct StellarPeSettlement;

#[contractimpl]
impl StellarPeSettlement {
    /// Called once at deploy time to set the admin key.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Record an inbound USDC payment for a merchant.
    /// The caller (payer) must have already transferred the USDC to this contract
    /// via a classic Stellar payment — this function logs and accounts for the
    /// already-received amount.
    pub fn record_payment(
        env: Env,
        merchant_id: String,
        payer: Address,
        amount: i128,
        asset: String,
    ) -> u64 {
        // Require the payer to authorize this call
        payer.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        // Update merchant unsettled balance
        let prev_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MerchantBalance(merchant_id.clone()))
            .unwrap_or(0);
        env.storage().instance().set(
            &DataKey::MerchantBalance(merchant_id.clone()),
            &(prev_balance + amount),
        );

        // Store transaction record
        let tx_index: u64 = env
            .storage()
            .instance()
            .get(&DataKey::MerchantTxCount(merchant_id.clone()))
            .unwrap_or(0);

        let record = TxRecord {
            merchant_id: merchant_id.clone(),
            payer: payer.clone(),
            amount,
            asset: asset.clone(),
            timestamp: env.ledger().timestamp(),
            settled: false,
            anchor_tx_ref: String::from_str(&env, ""),
        };

        env.storage()
            .instance()
            .set(&DataKey::Transaction(merchant_id.clone(), tx_index), &record);
        env.storage().instance().set(
            &DataKey::MerchantTxCount(merchant_id.clone()),
            &(tx_index + 1),
        );

        // Emit PaymentReceived event
        env.events().publish(
            (symbol_short!("payment"), symbol_short!("recv")),
            (merchant_id.clone(), payer.clone(), amount, env.ledger().timestamp()),
        );

        tx_index
    }

    /// Returns the merchant's current unsettled on-chain balance (in stroops).
    pub fn get_merchant_balance(env: Env, merchant_id: String) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::MerchantBalance(merchant_id))
            .unwrap_or(0)
    }

    /// Called by the backend once a SEP-24 withdrawal is confirmed.
    /// Decrements the unsettled balance and records the anchor transaction ref.
    pub fn mark_settled(
        env: Env,
        merchant_id: String,
        amount: i128,
        anchor_tx_ref: String,
    ) {
        // Only admin (backend signing key) can call this
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let current_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MerchantBalance(merchant_id.clone()))
            .unwrap_or(0);

        if current_balance < amount {
            panic!("insufficient unsettled balance");
        }

        env.storage().instance().set(
            &DataKey::MerchantBalance(merchant_id.clone()),
            &(current_balance - amount),
        );

        // Emit SettlementConfirmed event
        env.events().publish(
            (symbol_short!("settle"), symbol_short!("conf")),
            (merchant_id.clone(), amount, anchor_tx_ref.clone()),
        );
    }

    /// Returns a transaction record by index.
    pub fn get_transaction(env: Env, merchant_id: String, index: u64) -> TxRecord {
        env.storage()
            .instance()
            .get(&DataKey::Transaction(merchant_id, index))
            .expect("transaction not found")
    }

    /// Returns total transaction count for a merchant.
    pub fn get_tx_count(env: Env, merchant_id: String) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::MerchantTxCount(merchant_id))
            .unwrap_or(0)
    }
}

mod test;
