/**
 * Stellar Event Listener
 * Polls the Soroban RPC for PaymentReceived contract events
 * and mirrors them into the local SQLite database.
 */

import { rpc, xdr, scValToNative } from '@stellar/stellar-sdk';

const POLL_INTERVAL_MS = 4000; // Poll every 4 seconds
const CONTRACT_ID = process.env.CONTRACT_ID || '';
const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

const symPayment = xdr.ScVal.scvSymbol('payment').toXDR('base64');
const symRecv = xdr.ScVal.scvSymbol('recv').toXDR('base64');

export function startEventListener(db, logger) {
  logger.info(`Stellar event listener started for contract ${CONTRACT_ID}`);

  const server = CONTRACT_ID ? new rpc.Server(RPC_URL, { allowHttp: false }) : null;
  let lastCursor = loadCursor(db);

  /** 1. Poll Soroban Smart Contract Events */
  const pollSoroban = async () => {
    if (!server || !CONTRACT_ID) return;
    try {
      let eventParams;
      if (lastCursor) {
        eventParams = { cursor: lastCursor, limit: 50 };
      } else {
        const latest = await server.getLatestLedger();
        eventParams = { startLedger: Math.max(1, latest.sequence - 1000), limit: 50 };
      }

      const response = await server.getEvents({
        ...eventParams,
        filters: [
          {
            type: 'contract',
            contractIds: [CONTRACT_ID],
            topics: [[symPayment, symRecv]],
          },
        ],
      });

      for (const event of response.events) {
        const values = scValToNative(event.value);
        if (!Array.isArray(values) || values.length < 4) continue;

        try {
          const merchantId = values[0];
          const payer = values[1];
          const amount = values[2];

          const existing = db.prepare(
            'SELECT id FROM transactions WHERE stellar_tx_hash = ?'
          ).get(event.txHash);

          if (!existing) {
            const merchant = db.prepare('SELECT id FROM merchants WHERE id = ?').get(merchantId);
            if (merchant) {
              db.prepare(`
                INSERT INTO transactions (merchant_id, payer_address, amount_stroops, asset, stellar_tx_hash, status)
                VALUES (?, ?, ?, 'USDC', ?, 'confirmed')
              `).run(merchantId, payer, Number(amount), event.txHash);

              db.prepare(`
                INSERT INTO events (event_name, merchant_id, wallet_address, metadata)
                VALUES ('payment_confirmed', ?, ?, ?)
              `).run(merchantId, payer, JSON.stringify({ tx_hash: event.txHash, amount: Number(amount) }));

              logger.info(`Payment confirmed (Soroban): merchant=${merchantId} amount=${amount} tx=${event.txHash}`);
            }
          }

          lastCursor = event.pagingToken;
          saveCursor(db, lastCursor);
        } catch (parseErr) {
          logger.warn(parseErr, 'Failed to parse Soroban event');
        }
      }
    } catch (err) {
      logger.warn(err, 'Stellar Soroban event poll error');
    }
  };

  /** 2. Poll Horizon Payments for Registered Merchants (e.g. Freighter Mobile direct transfers) */
  const pollHorizon = async () => {
    try {
      const merchants = db.prepare('SELECT id, wallet_address FROM merchants').all();
      for (const m of merchants) {
        if (!m.wallet_address || !m.wallet_address.startsWith('G')) continue;

        try {
          const res = await fetch(`${HORIZON_URL}/accounts/${m.wallet_address}/payments?order=desc&limit=5`);
          if (!res.ok) continue;
          const data = await res.json();
          const records = data._embedded?.records || [];

          for (const rec of records) {
            if (rec.type !== 'payment') continue;
            const txHash = rec.transaction_hash;
            const payer = rec.from;
            const amountNum = parseFloat(rec.amount);
            const stroops = Math.round(amountNum * 1e7);
            const assetName = rec.asset_type === 'native' ? 'XLM' : (rec.asset_code || 'USDC');

            // Skip if payer is the merchant themselves (e.g. initial funding)
            if (payer === m.wallet_address) continue;

            const existing = db.prepare(
              'SELECT id FROM transactions WHERE stellar_tx_hash = ?'
            ).get(txHash);

            if (!existing) {
              db.prepare(`
                INSERT INTO transactions (merchant_id, payer_address, amount_stroops, asset, stellar_tx_hash, status)
                VALUES (?, ?, ?, ?, ?, 'confirmed')
              `).run(m.id, payer, stroops, assetName, txHash);

              db.prepare(`
                INSERT INTO events (event_name, merchant_id, wallet_address, metadata)
                VALUES ('payment_confirmed', ?, ?, ?)
              `).run(m.id, payer, JSON.stringify({ tx_hash: txHash, amount: stroops, asset: assetName }));

              logger.info(`Payment confirmed (Horizon): merchant=${m.id} amount=${amountNum} ${assetName} tx=${txHash}`);
            }
          }
        } catch {
          // silent per-merchant fetch error
        }
      }
    } catch (err) {
      logger.warn(err, 'Horizon payment poll error');
    }
  };

  const pollAll = async () => {
    await Promise.all([pollSoroban(), pollHorizon()]);
  };

  // Poll immediately and then on regular interval
  pollAll();
  setInterval(pollAll, POLL_INTERVAL_MS);
}

function loadCursor(db) {
  try {
    const row = db.prepare("SELECT metadata FROM events WHERE event_name = '__cursor' ORDER BY id DESC LIMIT 1").get();
    return row ? JSON.parse(row.metadata).cursor : null;
  } catch {
    return null;
  }
}

function saveCursor(db, cursor) {
  db.prepare(`
    INSERT INTO events (event_name, metadata) VALUES ('__cursor', ?)
  `).run(JSON.stringify({ cursor }));
}
