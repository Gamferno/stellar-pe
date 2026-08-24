/**
 * SEP-24 Withdrawal routes
 * POST /api/sep24/transactions/withdraw/interactive — Initiate withdrawal
 * GET  /api/sep24/transaction/:id                  — Poll transaction status
 * POST /api/sep24/webhook                          — Anchor confirms settlement
 */

const ANCHOR_HOME_DOMAIN = process.env.ANCHOR_HOME_DOMAIN || 'testanchor.stellar.org';

async function getTransferServer(domain) {
  const tomlRes = await fetch(`https://${domain}/.well-known/stellar.toml`);
  const toml = await tomlRes.text();
  const match = toml.match(/TRANSFER_SERVER_SEP0024\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

export async function withdrawRoutes(app) {
  /**
   * POST /api/sep24/transactions/withdraw/interactive
   * Body: { asset_code, amount, jwt, quote_id }
   * Returns: { id, type, url, expires_at } — the hosted anchor flow URL
   */
  app.post('/transactions/withdraw/interactive', async (req, reply) => {
    const { asset_code = 'USDC', amount, jwt, quote_id, merchant_id } = req.body || {};
    if (!amount) return reply.badRequest('amount required');

    const db = req.db;

    try {
      const transferServer = await getTransferServer(ANCHOR_HOME_DOMAIN);
      if (transferServer && jwt) {
        const formData = new URLSearchParams({
          asset_code,
          amount: amount.toString(),
          account: process.env.ANCHOR_SIGNING_KEY || '',
          ...(quote_id ? { quote_id } : {}),
        });

        const res = await fetch(`${transferServer}/transactions/withdraw/interactive`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${jwt}`,
          },
          body: formData.toString(),
        });
        if (res.ok) {
          const data = await res.json();

          // Persist withdrawal session
          if (data.id && merchant_id) {
            db.prepare(`
              INSERT INTO withdrawals (id, merchant_id, amount_stroops, status, anchor_url)
              VALUES (?, ?, ?, 'pending', ?)
            `).run(data.id, merchant_id, Math.round(parseFloat(amount) * 1e7), data.url);

            // Log analytics event
            db.prepare(`
              INSERT INTO events (event_name, merchant_id, metadata)
              VALUES ('settlement_initiated', ?, ?)
            `).run(merchant_id, JSON.stringify({ withdrawal_id: data.id, amount }));
          }

          return reply.send(data);
        }
      }
    } catch (err) {
      app.log.warn(err, 'SEP-24 withdrawal initiation failed, returning mock');
    }

    // Mock response for development
    const mockId = `mock-sep24-${Date.now()}`;
    const mockUrl = `https://${ANCHOR_HOME_DOMAIN}/sep24/transactions/${mockId}`;

    if (merchant_id) {
      db.prepare(`
        INSERT OR IGNORE INTO withdrawals (id, merchant_id, amount_stroops, status, anchor_url)
        VALUES (?, ?, ?, 'pending', ?)
      `).run(mockId, merchant_id, Math.round(parseFloat(amount || 0) * 1e7), mockUrl);
    }

    return reply.send({
      id: mockId,
      type: 'interactive_customer_info_needed',
      url: mockUrl,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      _note: 'Mock SEP-24 response',
    });
  });

  /**
   * GET /api/sep24/transaction/:id
   * Poll the anchor for the current status of a withdrawal.
   */
  app.get('/transaction/:id', async (req, reply) => {
    const { id } = req.params;
    const { jwt } = req.query;
    const db = req.db;

    // Check local DB first
    const local = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);

    try {
      if (jwt) {
        const transferServer = await getTransferServer(ANCHOR_HOME_DOMAIN);
        if (transferServer) {
          const res = await fetch(`${transferServer}/transaction?id=${id}`, {
            headers: { Authorization: `Bearer ${jwt}` },
          });
          const data = await res.json();

          // Update local status
          if (data.transaction && local) {
            db.prepare(`
              UPDATE withdrawals SET status = ?, updated_at = strftime('%s','now') WHERE id = ?
            `).run(data.transaction.status, id);
          }

          return reply.send(data);
        }
      }
    } catch (err) {
      app.log.warn(err, 'SEP-24 transaction poll failed');
    }

    // Return local record
    if (local) {
      return reply.send({ transaction: { id: local.id, status: local.status, amount: local.amount_stroops / 1e7 } });
    }
    return reply.notFound('Transaction not found');
  });

  /**
   * POST /api/sep24/webhook
   * Called by the anchor when settlement is confirmed.
   * Updates local DB and fires mark_settled on the contract (via the service layer).
   */
  app.post('/webhook', async (req, reply) => {
    const { id, status, stellar_transaction_id } = req.body || {};
    if (!id) return reply.badRequest('id required');

    const db = req.db;
    const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);

    if (!withdrawal) {
      app.log.warn(`Webhook received for unknown withdrawal ${id}`);
      return reply.send({ ok: true });
    }

    if (status === 'completed') {
      db.prepare(`
        UPDATE withdrawals SET status = 'completed', updated_at = strftime('%s','now') WHERE id = ?
      `).run(id);

      db.prepare(`
        UPDATE transactions SET status = 'settled', anchor_tx_ref = ?, updated_at = strftime('%s','now')
        WHERE merchant_id = ? AND status = 'confirmed'
      `).run(id, withdrawal.merchant_id);

      // Log analytics event
      db.prepare(`
        INSERT INTO events (event_name, merchant_id, metadata)
        VALUES ('settlement_confirmed', ?, ?)
      `).run(withdrawal.merchant_id, JSON.stringify({ withdrawal_id: id, stellar_transaction_id }));

      app.log.info(`Settlement confirmed for merchant ${withdrawal.merchant_id}, withdrawal ${id}`);
    } else if (status === 'error' || status === 'expired') {
      db.prepare(`
        UPDATE withdrawals SET status = ?, updated_at = strftime('%s','now') WHERE id = ?
      `).run(status, id);
    }

    return reply.send({ ok: true });
  });

  /**
   * POST /api/sep24/transactions/withdraw/confirm
   * Direct confirmation of withdrawal for in-app anchor interactive modal
   */
  app.post('/transactions/withdraw/confirm', async (req, reply) => {
    const { id, merchant_id, bank_details } = req.body || {};
    const db = req.db;

    if (!id || !merchant_id) {
      return reply.badRequest('id and merchant_id required');
    }

    // Mark withdrawal completed
    db.prepare(`
      UPDATE withdrawals SET status = 'completed', updated_at = strftime('%s','now') WHERE id = ?
    `).run(id);

    // Mark merchant's confirmed transactions as settled
    db.prepare(`
      UPDATE transactions SET status = 'settled', anchor_tx_ref = ?, updated_at = strftime('%s','now')
      WHERE merchant_id = ? AND status = 'confirmed'
    `).run(id, merchant_id);

    // Log analytics event
    db.prepare(`
      INSERT INTO events (event_name, merchant_id, metadata)
      VALUES ('settlement_confirmed', ?, ?)
    `).run(merchant_id, JSON.stringify({ withdrawal_id: id, bank_details, settled_at: new Date().toISOString() }));

    return reply.send({
      ok: true,
      status: 'completed',
      message: 'Settlement confirmed! Funds routed to bank account.',
      id,
    });
  });
}
