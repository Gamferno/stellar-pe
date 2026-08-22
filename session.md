# StellarPe — Session Notes (2026-08-15)

## ✅ What Was Done This Session

### Project Structure
The full project was scaffolded at `/home/om/Documents/StellarPay/` with:
- `.gitignore`, `LICENSE` (MIT)
- Three top-level directories: `contracts/`, `backend/`, `frontend/`

---

### Smart Contract (`contracts/settlement/`)
- **`Cargo.toml`** — Soroban SDK v21 dependency config
- **`src/lib.rs`** — Full Soroban settlement contract with:
  - `initialize(admin)` — one-time setup
  - `record_payment(merchant_id, payer, amount, asset)` — logs inbound USDC, emits `PaymentReceived` event
  - `get_merchant_balance(merchant_id)` — returns unsettled balance in stroops
  - `mark_settled(merchant_id, amount, anchor_tx_ref)` — called by backend on SEP-24 confirmation, emits `SettlementConfirmed`
  - `get_transaction(merchant_id, index)` and `get_tx_count(merchant_id)` helpers
- **`src/test.rs`** — 7 unit tests: happy paths, partial settlement, edge case rejections

---

### Backend (`backend/`)
| File | What it does |
|---|---|
| `package.json` | Fastify, better-sqlite3 v11 (Node 25 compatible), @stellar/stellar-sdk, qrcode, dotenv |
| `src/db/schema.sql` | 5 tables: `merchants`, `transactions`, `withdrawals`, `feedback`, `events` |
| `src/server.js` | Fastify server, CORS, DB init from schema, graceful shutdown |
| `src/routes/auth.sep10.js` | SEP-10 challenge/verify — proxies `testanchor.stellar.org`, dev-mode JWT fallback |
| `src/routes/quote.sep38.js` | SEP-38 USDC→INR quote — proxies anchor, mock fallback at ₹83.50/USDC |
| `src/routes/withdraw.sep24.js` | SEP-24 withdrawal initiation + webhook handler |
| `src/routes/merchants.js` | Register, get balance, list txns, QR generation, feedback, analytics events |
| `src/services/stellarEventListener.js` | Polls Soroban RPC every 5s for `PaymentReceived` events → mirrors to SQLite |
| `src/services/anchorClient.js` | Reusable SEP-10/38/24 HTTP wrapper with stellar.toml auto-discovery |
| `.env.example` | Template with all required env vars |

**Dependencies installed & building cleanly on Node v25.9.0.**

---

### Frontend (`frontend/`)
Vite 8 + React 19 PWA.

| File | What it does |
|---|---|
| `src/App.jsx` | React Router root |
| `src/pages/Dashboard.jsx` | Full merchant flow: wallet onboarding → balance card → QR → status → settle → feedback |
| `src/components/QRGenerator.jsx` | Amount input → SVG QR encoding `stellarpe://pay?...` URI + download button |
| `src/components/PaymentStatus.jsx` | Polls backend every 4s, shows animated Pending / Paid ✅ / Settled / Failed |
| `src/components/SettleButton.jsx` | Calls SEP-38 → SEP-24 → opens anchor hosted flow in new tab |
| `src/components/FeedbackForm.jsx` | Interactive 1–5 star rating + freetext stored via API |
| `src/hooks/useFreighter.js` | Freighter wallet connect/disconnect/sign with graceful "not installed" error |
| `src/hooks/useApi.js` | Minimal fetch wrapper with loading/error state |
| `src/index.css` | Full dark-theme design system: glassmorphism balance card, animated pulse/spinner, mobile-first |
| `public/manifest.json` | PWA manifest (theme `#7c6aff`, standalone display) |
| `index.html` | Updated with SEO meta, manifest link, dark theme-color |

**Dependencies installed and ready.**

---

### Tools Installed
- `stellar-cli v27.1.0` installed at `~/.cargo/bin/stellar` (via `cargo install --locked stellar-cli`)
- `rust-wasm` + `wasm-component-ld` installed via pacman
- **However:** WASM build fails because system `rust-wasm` provides `wasm32v1-none` target, but Soroban SDK v21 requires `wasm32-unknown-unknown`

---

## ❌ What Still Needs To Be Done

### 1. Fix WASM Target & Build the Contract
The contract build fails with:
```
error[E0463]: can't find crate for `std`
note: the `wasm32v1-none` target may not support the standard library
```
**Fix:** Install `rustup` to get a standalone Rust toolchain with `wasm32-unknown-unknown`:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env
rustup target add wasm32-unknown-unknown
```
Then build the contract:
```bash
cd /home/om/Documents/StellarPay/contracts/settlement
~/.cargo/bin/stellar contract build
```

### 2. Generate a Testnet Keypair & Fund It
```bash
~/.cargo/bin/stellar keys generate deployer --network testnet
~/.cargo/bin/stellar keys address deployer
# Fund via Friendbot:
curl "https://friendbot.stellar.org?addr=$(~/.cargo/bin/stellar keys address deployer)"
```

### 3. Deploy the Contract
```bash
~/.cargo/bin/stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellarpe_settlement.wasm \
  --source deployer \
  --network testnet
# → Prints a CONTRACT_ID like C...
```

### 4. Configure the Backend
```bash
cd /home/om/Documents/StellarPay/backend
cp .env.example .env
# Edit .env and fill in:
# CONTRACT_ID=<the C... address from step 3>
# ANCHOR_SIGNING_KEY=<G... from deployer keypair>
# ANCHOR_SECRET_KEY=<S... from deployer keypair>
# JWT_SECRET=<32 random hex bytes>
```

### 5. Initialize the Contract
```bash
~/.cargo/bin/stellar contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin <ANCHOR_SIGNING_KEY>
```

### 6. Run Both Servers
```bash
# Terminal 1 — Backend
cd /home/om/Documents/StellarPay/backend
npm run dev   # → http://localhost:3001

# Terminal 2 — Frontend
cd /home/om/Documents/StellarPay/frontend
npm run dev   # → http://localhost:5173
```

### 7. Git Init & First Commit
```bash
cd /home/om/Documents/StellarPay
git init
git add .
git commit -m "feat: initial StellarPe implementation"
```

### 8. Submission Checklist Items Remaining
- [ ] Push to public GitHub, paste repo URL in README
- [ ] Deploy frontend (Vercel) + backend (Railway/Render)
- [ ] Paste live app URL + contract explorer link in README
- [ ] Record a 3–5 min demo video (Loom/YouTube unlisted)
- [ ] Onboard 10+ real testnet users → collect wallet interaction proof
- [ ] Summarise feedback (e.g. "8/10 rated 4★+")
- [ ] Screenshot analytics (`events` table query or PostHog dashboard)
- [ ] Screenshot mobile responsive views

---

## Key File Locations

| What | Path |
|---|---|
| Smart contract | `contracts/settlement/src/lib.rs` |
| Backend entry | `backend/src/server.js` |
| Frontend entry | `frontend/src/pages/Dashboard.jsx` |
| Backend env template | `backend/.env.example` |
| Frontend env | `frontend/.env` |
| DB schema | `backend/src/db/schema.sql` |
| stellar-cli binary | `~/.cargo/bin/stellar` |
