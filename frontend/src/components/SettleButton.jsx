import { useState } from 'react';
import { ArrowRightLeft, Loader2, Landmark, CheckCircle2, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function SettleButton({ merchantId, balance, jwt, onSettled }) {
  const [phase, setPhase] = useState('idle'); // idle | quoting | modal | confirming | done | error
  const [quote, setQuote] = useState(null);
  const [withdrawSession, setWithdrawSession] = useState(null);
  const [upiId, setUpiId] = useState('canteen.merchant@upi');
  const [accountHolder, setAccountHolder] = useState('Om Pathak');
  const [errorMsg, setErrorMsg] = useState('');

  const balanceUsdc = balance / 1e7;

  const handleStartSettle = async () => {
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

      // Step 2: Initiate SEP-24 interactive withdrawal session
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
      setWithdrawSession(withdrawData);

      // Open in-app interactive modal
      setPhase('modal');
    } catch (err) {
      setPhase('error');
      setErrorMsg(err.message || 'Settlement initialization failed');
    }
  };

  const handleConfirmTransfer = async () => {
    if (!withdrawSession?.id) return;
    setPhase('confirming');
    setErrorMsg('');

    try {
      const res = await fetch(`${API}/sep24/transactions/withdraw/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: withdrawSession.id,
          merchant_id: merchantId,
          bank_details: {
            upi_id: upiId,
            account_holder: accountHolder,
          },
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setPhase('done');
        if (onSettled) onSettled(withdrawSession);
      } else {
        throw new Error(data.message || 'Settlement confirmation failed');
      }
    } catch (err) {
      setPhase('error');
      setErrorMsg(err.message || 'Transfer failed');
    }
  };

  return (
    <div className="settle-wrap">
      {errorMsg && <p className="settle-error">{errorMsg}</p>}

      {phase === 'done' ? (
        <div className="settle-success">
          <CheckCircle2 size={24} color="#00d26a" style={{ display: 'inline', marginRight: 6 }} />
          <p className="settle-success-msg" style={{ display: 'inline' }}>
            Settlement complete! Funds transferred to your bank.
          </p>
        </div>
      ) : (
        <button
          className="btn btn-accent btn-full"
          onClick={handleStartSettle}
          disabled={balanceUsdc <= 0 || phase === 'quoting'}
        >
          {phase === 'quoting' ? (
            <>
              <Loader2 size={16} className="spin" />
              Getting SEP-38 Quote…
            </>
          ) : (
            <>
              <ArrowRightLeft size={16} />
              Settle to Bank ({balanceUsdc.toFixed(2)} USDC)
            </>
          )}
        </button>
      )}

      {/* In-App Anchor Interactive Webview Modal */}
      {phase === 'modal' || phase === 'confirming' ? (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div className="modal-content card" style={{
            maxWidth: '460px',
            width: '100%',
            background: '#121324',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '1.5rem',
            position: 'relative',
          }}>
            <button
              onClick={() => setPhase('idle')}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <div className="qr-icon-wrap" style={{ width: 36, height: 36, minWidth: 36 }}>
                <Landmark size={20} color="#00d26a" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Stellar Anchor Withdrawal</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SEP-24 Hosted Anchor Off-Ramp</span>
              </div>
            </div>

            {/* Rate quote banner */}
            <div style={{
              background: 'rgba(0, 210, 106, 0.08)',
              border: '1px solid rgba(0, 210, 106, 0.25)',
              borderRadius: '10px',
              padding: '0.85rem',
              marginBottom: '1.2rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>You Sell:</span>
                <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{balanceUsdc.toFixed(2)} USDC</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>You Receive:</span>
                <strong style={{ fontSize: '1.1rem', color: '#00d26a' }}>
                  ≈ ₹{quote ? parseFloat(quote.buy_amount || 0).toFixed(2) : (balanceUsdc * 83.5).toFixed(2)} INR
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>Rate (SEP-38):</span>
                <span>₹{quote?.price || '83.50'} / USDC</span>
              </div>
            </div>

            {/* Bank details input form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  UPI ID / Bank Account
                </label>
                <input
                  type="text"
                  className="amount-input"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem', textAlign: 'left' }}
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  placeholder="e.g. yourname@upi or Account No"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Account Holder Name
                </label>
                <input
                  type="text"
                  className="amount-input"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem', textAlign: 'left' }}
                  value={accountHolder}
                  onChange={e => setAccountHolder(e.target.value)}
                  placeholder="e.g. Canteen Merchant"
                />
              </div>
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={handleConfirmTransfer}
              disabled={phase === 'confirming'}
            >
              {phase === 'confirming' ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Routing to Bank via Anchor…
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Confirm & Transfer to Bank
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
