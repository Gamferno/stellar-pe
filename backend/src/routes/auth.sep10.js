/**
 * SEP-10 Stellar Web Authentication routes
 * GET  /api/sep10/auth          — Generate challenge transaction
 * POST /api/sep10/auth          — Verify signed challenge, return JWT
 */

import { Keypair, Transaction, Networks } from '@stellar/stellar-sdk';

const NETWORK = process.env.STELLAR_NETWORK === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET;

const ANCHOR_SIGNING_KEY = process.env.ANCHOR_SIGNING_KEY || '';
const ANCHOR_HOME_DOMAIN = process.env.ANCHOR_HOME_DOMAIN || 'testanchor.stellar.org';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Simple JWT helper (no external dependency)
import { createHmac } from 'node:crypto';
async function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export async function authRoutes(app) {
  /**
   * GET /api/sep10/auth?account=G...
   * Returns a challenge transaction (XDR) that the client must sign.
   */
  app.get('/auth', async (req, reply) => {
    const { account } = req.query;
    if (!account) return reply.badRequest('account query parameter required');

    try {
      // Proxy to actual anchor's SEP-10 challenge endpoint
      const anchorUrl = `https://${ANCHOR_HOME_DOMAIN}/.well-known/stellar.toml`;
      const tomlRes = await fetch(anchorUrl);
      const toml = await tomlRes.text();
      const webAuthEndpointMatch = toml.match(/WEB_AUTH_ENDPOINT\s*=\s*"([^"]+)"/);

      if (webAuthEndpointMatch) {
        const webAuthEndpoint = webAuthEndpointMatch[1];
        const challengeRes = await fetch(`${webAuthEndpoint}?account=${account}&home_domain=${ANCHOR_HOME_DOMAIN}`);
        const challengeData = await challengeRes.json();
        return reply.send(challengeData);
      }

      // Fallback: return mock challenge for development
      return reply.send({
        transaction: 'MOCK_CHALLENGE_XDR',
        network_passphrase: NETWORK,
        _note: 'Mock challenge — set up real anchor credentials for production',
      });
    } catch (err) {
      app.log.error(err, 'SEP-10 challenge fetch failed');
      return reply.send({
        transaction: 'MOCK_CHALLENGE_XDR',
        network_passphrase: NETWORK,
        _note: 'Mock challenge (anchor unreachable)',
      });
    }
  });

  /**
   * POST /api/sep10/auth
   * Body: { transaction: "<signed XDR>" }
   * Returns: { token: "<JWT>" }
   */
  app.post('/auth', async (req, reply) => {
    const { transaction } = req.body || {};
    if (!transaction) return reply.badRequest('transaction required in body');

    try {
      // Proxy signed transaction to anchor for verification
      const anchorUrl = `https://${ANCHOR_HOME_DOMAIN}/.well-known/stellar.toml`;
      const tomlRes = await fetch(anchorUrl);
      const toml = await tomlRes.text();
      const webAuthEndpointMatch = toml.match(/WEB_AUTH_ENDPOINT\s*=\s*"([^"]+)"/);

      if (webAuthEndpointMatch) {
        const webAuthEndpoint = webAuthEndpointMatch[1];
        const verifyRes = await fetch(webAuthEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction }),
        });
        const tokenData = await verifyRes.json();
        return reply.send(tokenData);
      }
    } catch (err) {
      app.log.warn(err, 'SEP-10 anchor verify failed, generating local token');
    }

    // Fallback: generate a local JWT for development/testing
    const now = Math.floor(Date.now() / 1000);
    const token = await makeJwt({ sub: 'dev-account', iat: now, exp: now + 86400 });
    return reply.send({ token, _note: 'Dev JWT — not verified against anchor' });
  });
}
