-- StellarPe Database Schema
-- SQLite

-- Registered merchants
CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,                        -- e.g. "merchant_001"
    name TEXT NOT NULL,
    wallet_address TEXT NOT NULL UNIQUE,        -- Stellar G... public key
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- On-chain payment records (mirrored from Soroban events)
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    payer_address TEXT NOT NULL,
    amount_stroops INTEGER NOT NULL,            -- USDC in stroops (7 decimals)
    asset TEXT NOT NULL DEFAULT 'USDC',
    stellar_tx_hash TEXT,                       -- Stellar network TX hash
    contract_tx_index INTEGER,                  -- index returned by record_payment
    status TEXT NOT NULL DEFAULT 'pending',     -- pending | confirmed | settled
    anchor_tx_ref TEXT,                         -- SEP-24 transaction ref
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- SEP-24 withdrawal sessions
CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,                        -- SEP-24 transaction id
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    amount_stroops INTEGER NOT NULL,
    quote_id TEXT,                              -- SEP-38 quote id
    status TEXT NOT NULL DEFAULT 'pending',     -- pending | completed | failed
    anchor_url TEXT,                            -- hosted flow URL shown to merchant
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- In-app feedback (1–5 rating + free text)
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id TEXT REFERENCES merchants(id),
    payer_address TEXT,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- Lightweight analytics event log
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,                   -- qr_generated | payment_signed | payment_confirmed | settlement_initiated | settlement_confirmed
    merchant_id TEXT,
    wallet_address TEXT,
    metadata TEXT,                              -- JSON blob
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_merchant ON events(merchant_id);
