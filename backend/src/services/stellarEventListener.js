/**
 * Stellar Event Listener
 * Polls the Soroban RPC for PaymentReceived contract events
 * and mirrors them into the local SQLite database.
 */

import { Server } from '@stellar/stellar-sdk/rpc';
import { scValToNative } from '@stellar/stellar-sdk';

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const CONTRACT_ID = process.env.CONTRACT_ID || '';
const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';

export function startEventListener(db, logger) {
  if (!CONTRACT_ID) {
    logger.warn('Event listener: CONTRACT_ID not set, skipping');
    return;
  }

  const server = new Server(RPC_URL, { allowHttp: false });
  let lastCursor = loadCursor(db);

  logger.info(`Stellar event listener started for contract ${CONTRACT_ID}`);

  const poll = async () => {
    try {
      const eventParams = lastCursor
        ? { cursor: lastCursor, limit: 50 }
        : { startLedger: 1, limit: 50 };

      const response = await server.getEvents({
        ...eventParams,
        filters: [
          {
            type: 'contract',
            contractIds: [CONTRACT_ID],
            topics: [
              // PaymentReceived: (payment, recv, ...)
              ['AAAADwAAAAdwYXltZW50AAAA', 'AAAADwAAAARyZWN2AAAA'],
            ],
          },
        ],
      });

      for (const event of response.events) {
        // scValToNative converts the top-level ScVal (a Vec) into a JS array
        const values = scValToNative(event.value);
        if (!Array.isArray(values) || values.length < 4) continue;

        try {
          const merchantId = values[0];
          const payer = values[1];
          const amount = values[2];
          const timestamp = values[3];

          // Upsert into transactions (idempotent on tx hash)
          const existing = db.prepare(
            'SELECT id FROM transactions WHERE stellar_tx_hash = ?'
          ).get(event.txHash);

          if (!existing) {
            // Ensure merchant exists
            const merchant = db.prepare('SELECT id FROM merchants WHERE id = ?').get(merchantId);
            if (!merchant) {
              logger.warn(`PaymentReceived for unknown merchant ${merchantId}, skipping`);
            } else {
              db.prepare(`
                INSERT INTO transactions (merchant_id, payer_address, amount_stroops, stellar_tx_hash, status)
                VALUES (?, ?, ?, ?, 'confirmed')
              `).run(merchantId, payer, Number(amount), event.txHash);

              db.prepare(`
                INSERT INTO events (event_name, merchant_id, wallet_address, metadata)
                VALUES ('payment_confirmed', ?, ?, ?)
              `).run(merchantId, payer, JSON.stringify({ tx_hash: event.txHash, amount: Number(amount) }));

              logger.info(`Payment confirmed: merchant=${merchantId} amount=${amount} tx=${event.txHash}`);
            }
          }

          lastCursor = event.pagingToken;
          saveCursor(db, lastCursor);
        } catch (parseErr) {
          logger.warn(parseErr, 'Failed to parse event');
        }
      }
    } catch (err) {
      logger.warn(err, 'Stellar event poll error');
    }
  };

  // Poll immediately then on interval
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
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
