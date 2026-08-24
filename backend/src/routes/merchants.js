/**
 * Merchant CRUD routes
 * POST /api/merchants/register         — Register a merchant
 * GET  /api/merchants/:id              — Get merchant info + balance
 * GET  /api/merchants/:id/transactions — List transactions
 * POST /api/merchants/:id/feedback     — Submit feedback
 * GET  /api/merchants/:id/events       — Analytics events
 * GET  /api/merchants/:id/qr           — Generate QR code PNG (base64)
 */

import QRCode from 'qrcode';
import {
  Keypair,
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  nativeToScVal,
  Address,
} from '@stellar/stellar-sdk';

export async function merchantRoutes(app) {
  /** POST /api/merchants/register */
  app.post('/register', async (req, reply) => {
    const { id, name, wallet_address } = req.body || {};
    if (!id || !name || !wallet_address) {
      return reply.badRequest('id, name, and wallet_address required');
    }
    const db = req.db;
    try {
      db.prepare(`
        INSERT INTO merchants (id, name, wallet_address) VALUES (?, ?, ?)
      `).run(id, name, wallet_address);
      return reply.code(201).send({ ok: true, id });
    } catch (err) {
      if (err.message.includes('UNIQUE')) return reply.conflict('Merchant already exists');
      throw err;
    }
  });

  /** GET /api/merchants/:id */
  app.get('/:id', async (req, reply) => {
    const { id } = req.params;
    const db = req.db;
    const merchant = db.prepare('SELECT * FROM merchants WHERE id = ?').get(id);
    if (!merchant) return reply.notFound('Merchant not found');

    // Sum up unsettled balance from confirmed transactions
    const balRow = db.prepare(`
      SELECT COALESCE(SUM(amount_stroops), 0) AS total
      FROM transactions
      WHERE merchant_id = ? AND status = 'confirmed'
    `).get(id);

    return reply.send({
      ...merchant,
      unsettled_balance_stroops: balRow.total,
      unsettled_balance_usdc: (balRow.total / 1e7).toFixed(7),
    });
  });

  /** GET /api/merchants/:id/transactions */
  app.get('/:id/transactions', async (req, reply) => {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const db = req.db;
    const rows = db.prepare(`
      SELECT * FROM transactions WHERE merchant_id = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(id, parseInt(limit), parseInt(offset));
    return reply.send({ transactions: rows });
  });

  /** POST /api/merchants/:id/feedback */
  app.post('/:id/feedback', async (req, reply) => {
    const { id } = req.params;
    const { payer_address, rating, comment } = req.body || {};
    if (!rating || rating < 1 || rating > 5) {
      return reply.badRequest('rating must be 1–5');
    }
    const db = req.db;
    db.prepare(`
      INSERT INTO feedback (merchant_id, payer_address, rating, comment)
      VALUES (?, ?, ?, ?)
    `).run(id, payer_address || null, rating, comment || null);
    return reply.code(201).send({ ok: true });
  });

  /** GET /api/merchants/:id/events (analytics) */
  app.get('/:id/events', async (req, reply) => {
    const { id } = req.params;
    const { limit = 100 } = req.query;
    const db = req.db;
    const rows = db.prepare(`
      SELECT event_name, COUNT(*) AS count
      FROM events WHERE merchant_id = ?
      GROUP BY event_name
    `).all(id);
    return reply.send({ events: rows });
  });

  /**
   * GET /api/merchants/:id/qr?amount=10.00
   * Returns a base64-encoded PNG QR code encoding the payment URI.
   */
  app.get('/:id/qr', async (req, reply) => {
    const { id } = req.params;
    const { amount = '' } = req.query;
    const contractId = process.env.CONTRACT_ID || 'MOCK_CONTRACT_ID';

    const uri = `stellarpe://pay?merchant=${encodeURIComponent(id)}&amount=${encodeURIComponent(amount)}&asset=USDC&contract=${contractId}`;

    const dataUrl = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    });

    // Log QR generation event
    req.db.prepare(`
      INSERT INTO events (event_name, merchant_id, metadata)
      VALUES ('qr_generated', ?, ?)
    `).run(id, JSON.stringify({ amount }));

    return reply.send({ qr: dataUrl, uri });
  });

  /** GET /api/merchants/:id/analytics */
  app.get('/:id/analytics', async (req, reply) => {
    const { id } = req.params;
    const db = req.db;

    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('confirmed','settled') THEN amount_stroops ELSE 0 END), 0) AS total_received_stroops,
        COALESCE(SUM(CASE WHEN status = 'settled' THEN amount_stroops ELSE 0 END), 0) AS total_settled_stroops,
        COUNT(*) AS tx_count
      FROM transactions WHERE merchant_id = ?
    `).get(id);

    const feedback = db.prepare(`
      SELECT ROUND(AVG(rating), 2) AS avg_rating, COUNT(*) AS rating_count
      FROM feedback WHERE merchant_id = ?
    `).get(id);

    return reply.send({
      total_received_usdc: (totals.total_received_stroops / 1e7).toFixed(2),
      total_settled_usdc: (totals.total_settled_stroops / 1e7).toFixed(2),
      tx_count: totals.tx_count,
      feedback_avg_rating: feedback.avg_rating || null,
      feedback_count: feedback.rating_count,
    });
  });

  /** POST /api/merchants/:id/transactions — manual record (dev/testing) */
  app.post('/:id/transactions', async (req, reply) => {
    const { id } = req.params;
    const { payer_address, amount_usdc, stellar_tx_hash } = req.body || {};
    if (!payer_address || !amount_usdc) {
      return reply.badRequest('payer_address and amount_usdc required');
    }
    const db = req.db;
    const result = db.prepare(`
      INSERT INTO transactions (merchant_id, payer_address, amount_stroops, stellar_tx_hash, status)
      VALUES (?, ?, ?, ?, 'confirmed')
    `).run(id, payer_address, Math.round(parseFloat(amount_usdc) * 1e7), stellar_tx_hash || null);
    return reply.code(201).send({ ok: true, id: result.lastInsertRowid });
  });

  /** POST /api/merchants/:id/pay-simulate — Real testnet or simulated customer payment */
  app.post('/:id/pay-simulate', async (req, reply) => {
    const { id } = req.params;
    const { amount_usdc = '15.00' } = req.body || {};
    const stroops = Math.round(parseFloat(amount_usdc) * 1e7);
    const db = req.db;

    try {
      const payer = Keypair.random();
      const payerAddress = payer.publicKey();

      // Fund customer on testnet
      await fetch(`https://friendbot.stellar.org?addr=${payerAddress}`);

      const contractId = process.env.CONTRACT_ID;
      let txHash = null;

      if (contractId && contractId.startsWith('C')) {
        const server = new rpc.Server(process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org');
        const account = await server.getAccount(payerAddress);
        const contract = new Contract(contractId);

        const tx = new TransactionBuilder(account, {
          fee: '100000',
          networkPassphrase: Networks.TESTNET,
        })
          .addOperation(
            contract.call(
              'record_payment',
              nativeToScVal(id),
              new Address(payerAddress).toScVal(),
              nativeToScVal(BigInt(stroops), { type: 'i128' }),
              nativeToScVal('USDC')
            )
          )
          .setTimeout(30)
          .build();

        const simulated = await server.simulateTransaction(tx);
        const preparedTx = rpc.assembleTransaction(tx, simulated).build();
        preparedTx.sign(payer);

        const sendRes = await server.sendTransaction(preparedTx);
        txHash = sendRes.hash;
      } else {
        txHash = `sim_${Date.now()}`;
      }

      // Record in SQLite
      const result = db.prepare(`
        INSERT INTO transactions (merchant_id, payer_address, amount_stroops, asset, stellar_tx_hash, status)
        VALUES (?, ?, ?, 'USDC', ?, 'confirmed')
      `).run(id, payerAddress, stroops, txHash);

      db.prepare(`
        INSERT INTO events (event_name, merchant_id, wallet_address, metadata)
        VALUES ('payment_confirmed', ?, ?, ?)
      `).run(id, payerAddress, JSON.stringify({ tx_hash: txHash, amount: stroops }));

      return reply.send({
        ok: true,
        id: result.lastInsertRowid,
        tx_hash: txHash,
        payer: payerAddress,
        amount_usdc,
        explorer_url: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
      });
    } catch (err) {
      app.log.warn(err, 'Payment simulation fallback');
      const mockHash = `sim_${Date.now()}`;
      const mockPayer = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
      const result = db.prepare(`
        INSERT INTO transactions (merchant_id, payer_address, amount_stroops, asset, stellar_tx_hash, status)
        VALUES (?, ?, ?, 'USDC', ?, 'confirmed')
      `).run(id, mockPayer, stroops, mockHash);

      return reply.send({
        ok: true,
        id: result.lastInsertRowid,
        tx_hash: mockHash,
        payer: mockPayer,
        amount_usdc,
        explorer_url: `https://stellar.expert/explorer/testnet/tx/${mockHash}`,
      });
    }
  });
}
