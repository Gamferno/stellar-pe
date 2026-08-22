/**
 * Anchor Client
 * Thin wrapper around SEP-10/38/24 HTTP calls to the configured anchor.
 */

const ANCHOR_HOME_DOMAIN = process.env.ANCHOR_HOME_DOMAIN || 'testanchor.stellar.org';

let _tomlCache = null;

/**
 * Fetch and cache the anchor's stellar.toml
 */
export async function getAnchorToml() {
  if (_tomlCache) return _tomlCache;
  const res = await fetch(`https://${ANCHOR_HOME_DOMAIN}/.well-known/stellar.toml`);
  if (!res.ok) throw new Error(`Failed to fetch stellar.toml: ${res.status}`);
  const text = await res.text();

  const parsed = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^(\w+)\s*=\s*"([^"]+)"/);
    if (match) parsed[match[1]] = match[2];
  }
  _tomlCache = parsed;

  // Expire cache after 10 minutes
  setTimeout(() => { _tomlCache = null; }, 10 * 60 * 1000);
  return parsed;
}

/**
 * SEP-10: Get challenge transaction for an account
 */
export async function getSep10Challenge(account) {
  const toml = await getAnchorToml();
  const endpoint = toml.WEB_AUTH_ENDPOINT;
  if (!endpoint) throw new Error('WEB_AUTH_ENDPOINT not found in stellar.toml');
  const res = await fetch(`${endpoint}?account=${account}&home_domain=${ANCHOR_HOME_DOMAIN}`);
  if (!res.ok) throw new Error(`SEP-10 challenge failed: ${res.status}`);
  return res.json();
}

/**
 * SEP-10: Submit signed challenge, receive JWT
 */
export async function submitSep10Challenge(signedXdr) {
  const toml = await getAnchorToml();
  const endpoint = toml.WEB_AUTH_ENDPOINT;
  if (!endpoint) throw new Error('WEB_AUTH_ENDPOINT not found in stellar.toml');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signedXdr }),
  });
  if (!res.ok) throw new Error(`SEP-10 verify failed: ${res.status}`);
  return res.json();
}

/**
 * SEP-38: Request a firm quote
 */
export async function getQuote({ sellAsset, sellAmount, buyAsset, jwt }) {
  const toml = await getAnchorToml();
  const endpoint = toml.ANCHOR_QUOTE_SERVER;
  if (!endpoint) throw new Error('ANCHOR_QUOTE_SERVER not found in stellar.toml');
  const res = await fetch(`${endpoint}/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify({
      sell_asset: sellAsset,
      sell_amount: sellAmount.toString(),
      buy_asset: buyAsset,
    }),
  });
  if (!res.ok) throw new Error(`SEP-38 quote failed: ${res.status}`);
  return res.json();
}

/**
 * SEP-24: Initiate interactive withdrawal
 */
export async function initiateWithdrawal({ assetCode, amount, account, quoteId, jwt }) {
  const toml = await getAnchorToml();
  const endpoint = toml.TRANSFER_SERVER_SEP0024;
  if (!endpoint) throw new Error('TRANSFER_SERVER_SEP0024 not found in stellar.toml');

  const formData = new URLSearchParams({
    asset_code: assetCode,
    amount: amount.toString(),
    account,
    ...(quoteId ? { quote_id: quoteId } : {}),
  });

  const res = await fetch(`${endpoint}/transactions/withdraw/interactive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${jwt}`,
    },
    body: formData.toString(),
  });
  if (!res.ok) throw new Error(`SEP-24 initiation failed: ${res.status}`);
  return res.json();
}

/**
 * SEP-24: Poll transaction status
 */
export async function getWithdrawalStatus(transactionId, jwt) {
  const toml = await getAnchorToml();
  const endpoint = toml.TRANSFER_SERVER_SEP0024;
  if (!endpoint) throw new Error('TRANSFER_SERVER_SEP0024 not found in stellar.toml');
  const res = await fetch(`${endpoint}/transaction?id=${transactionId}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error(`SEP-24 poll failed: ${res.status}`);
  return res.json();
}
