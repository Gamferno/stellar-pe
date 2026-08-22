import { useState } from 'react';
import { ArrowRightLeft, Loader2, ExternalLink } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function SettleButton({ merchantId, balance, jwt, onSettled }) {
  const [phase, setPhase] = useState('idle'); // idle | quoting | redirecting | done | error
  const [quote, setQuote] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [anchorUrl, setAnchorUrl] = useState('');

  const balanceUsdc = balance / 1e7;

  const handleSettle = async () => {
    if (balanceUsdc <= 0) return;
    setPhase('quoting');
    setErrorMsg('');

    try {
      // Step 1: Get SEP-38 quote
      const quoteRes = await fetch(`${API}/sep38/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sell_asset: 'stellar:USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
          sell_amount: balanceUsdc.toFixed(7),
          buy_asset: 'iso4217:INR',
          jwt,
        }),
      });
      const quoteData = await quoteRes.json();
      setQuote(quoteData);

      // Step 2: Initiate SEP-24 withdrawal
      setPhase('redirecting');
      const withdrawRes = await fetch(`${API}/sep24/transactions/withdraw/interactive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_code: 'USDC',
          amount: balanceUsdc.toFixed(7),
          jwt,
          quote_id: quoteData.id,
          merchant_id: merchantId,
        }),
      });
      const withdrawData = await withdrawRes.json();

      if (withdrawData.url) {
        setAnchorUrl(withdrawData.url);
        setPhase('done');
        if (onSettled) onSettled(withdrawData);
        // Open anchor hosted flow in new tab
        window.open(withdrawData.url, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('No anchor URL returned');
      }
    } catch (err) {
      setPhase('error');
      setErrorMsg(err.message || 'Settlement failed');
    }
  };

  if (phase === 'done') {
    return (
      <div className="settle-success">
        <p className="settle-success-msg">
          ✅ Anchor flow opened. Complete the withdrawal in the new tab.
        </p>
        {anchorUrl && (
          <a href={anchorUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
            <ExternalLink size={14} /> Reopen anchor flow
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="settle-wrap">
      {quote && (
        <div className="quote-preview">
          <span className="quote-sell">{balanceUsdc.toFixed(2)} USDC</span>
          <ArrowRightLeft size={14} className="quote-arrow" />
          <span className="quote-buy">≈ ₹{parseFloat(quote.buy_amount || 0).toFixed(2)}</span>
          <span className="quote-rate">@ ₹{quote.price}/USDC</span>
        </div>
      )}
      {errorMsg && <p className="settle-error">{errorMsg}</p>}
      <button
        className="btn btn-accent btn-full"
        onClick={handleSettle}
        disabled={balanceUsdc <= 0 || phase === 'quoting' || phase === 'redirecting'}
      >
        {phase === 'quoting' || phase === 'redirecting' ? (
          <>
            <Loader2 size={16} className="spin" />
            {phase === 'quoting' ? 'Getting quote…' : 'Opening anchor…'}
          </>
        ) : (
          <>
            <ArrowRightLeft size={16} />
            Settle to Bank ({balanceUsdc.toFixed(2)} USDC)
          </>
        )}
      </button>
    </div>
  );
}
