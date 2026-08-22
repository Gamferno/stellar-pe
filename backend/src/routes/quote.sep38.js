/**
 * SEP-38 Quote routes
 * GET  /api/sep38/prices         — Get available quotes (USDC → INR)
 * POST /api/sep38/quote          — Request a firm quote
 */

const ANCHOR_HOME_DOMAIN = process.env.ANCHOR_HOME_DOMAIN || 'testanchor.stellar.org';

async function getAnchorInfo(domain) {
  const tomlRes = await fetch(`https://${domain}/.well-known/stellar.toml`);
  const toml = await tomlRes.text();
  const match = toml.match(/ANCHOR_QUOTE_SERVER\s*=\s*"([^"]+)"/);
  return { quoteServer: match ? match[1] : null };
}

export async function quoteRoutes(app) {
  /**
   * GET /api/sep38/prices?sell_asset=stellar:USDC:...&buy_asset=iso4217:INR
   * Returns indicative prices from the anchor.
   */
  app.get('/prices', async (req, reply) => {
    const {
      sell_asset = 'stellar:USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      sell_amount = '1',
      buy_asset = 'iso4217:INR',
    } = req.query;

    try {
      const { quoteServer } = await getAnchorInfo(ANCHOR_HOME_DOMAIN);
      if (quoteServer) {
        const params = new URLSearchParams({ sell_asset, sell_amount, buy_asset });
        const res = await fetch(`${quoteServer}/prices?${params}`);
        const data = await res.json();
        return reply.send(data);
      }
    } catch (err) {
      app.log.warn(err, 'SEP-38 prices fetch failed, returning mock');
    }

    // Mock response for development
    return reply.send({
      buy_assets: [
        {
          asset: 'iso4217:INR',
          price: '83.50',
          decimals: 2,
          _note: 'Mock price — connect to real anchor for live rates',
        },
      ],
    });
  });

  /**
   * POST /api/sep38/quote
   * Body: { sell_asset, sell_amount, buy_asset, jwt }
   * Returns: { id, price, sell_amount, buy_amount, expires_at }
   */
  app.post('/quote', async (req, reply) => {
    const { sell_asset, sell_amount, buy_asset, jwt } = req.body || {};
    if (!sell_asset || !sell_amount || !buy_asset) {
      return reply.badRequest('sell_asset, sell_amount, and buy_asset required');
    }

    try {
      const { quoteServer } = await getAnchorInfo(ANCHOR_HOME_DOMAIN);
      if (quoteServer && jwt) {
        const res = await fetch(`${quoteServer}/quote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ sell_asset, sell_amount, buy_asset }),
        });
        if (res.ok) {
          const data = await res.json();
          return reply.send(data);
        }
      }
    } catch (err) {
      app.log.warn(err, 'SEP-38 quote request failed, returning mock');
    }

    // Mock firm quote
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    return reply.send({
      id: `mock-quote-${Date.now()}`,
      price: '83.50',
      sell_asset,
      sell_amount,
      buy_asset,
      buy_amount: (parseFloat(sell_amount) * 83.5).toFixed(2),
      expires_at: expiresAt,
      _note: 'Mock quote — connect real anchor for live rates',
    });
  });
}
