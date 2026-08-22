import { useState, useEffect } from 'react';
import { useFreighter } from '../hooks/useFreighter';
import { QRGenerator } from '../components/QRGenerator';
import { PaymentStatus } from '../components/PaymentStatus';
import { SettleButton } from '../components/SettleButton';
import { FeedbackForm } from '../components/FeedbackForm';
import {
  Wallet, LogOut, TrendingUp, ArrowDownToLine,
  Clock, Zap, RefreshCw, AlertTriangle, BarChart2, Star
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID || '';

function truncate(key) {
  if (!key) return '';
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export default function Dashboard() {
  const { publicKey, connecting, error: walletError, connect, disconnect } = useFreighter();
  const [merchant, setMerchant] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [loadingMerchant, setLoadingMerchant] = useState(false);
  const [regError, setRegError] = useState('');
  // jwt: in dev mode this is empty; in production it would be obtained via SEP-10
  const [jwt, setJwt] = useState('');

  // Auto-register / fetch merchant when wallet connected
  useEffect(() => {
    if (!publicKey) return;
    const merchantId = publicKey.slice(-12); // derive ID from wallet
    setLoadingMerchant(true);
    setRegError('');

    (async () => {
      try {
        // Try to fetch existing merchant
        let res = await fetch(`${API}/merchants/${merchantId}`);
        if (res.status === 404) {
          // Auto-register
          const regRes = await fetch(`${API}/merchants/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: merchantId,
              name: `Merchant ${truncate(publicKey)}`,
              wallet_address: publicKey,
            }),
          });
          if (!regRes.ok) throw new Error('Failed to register merchant');
          res = await fetch(`${API}/merchants/${merchantId}`);
        }
        const data = await res.json();
        setMerchant(data);

        // Load recent transactions
        const txRes = await fetch(`${API}/merchants/${merchantId}/transactions?limit=10`);
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);

        // Load analytics
        const analyticsRes = await fetch(`${API}/merchants/${merchantId}/analytics`);
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      } catch (err) {
        setRegError(err.message);
      } finally {
        setLoadingMerchant(false);
      }
    })();
  }, [publicKey]);

  const refreshBalance = async () => {
    if (!merchant) return;
    const res = await fetch(`${API}/merchants/${merchant.id}`);
    const data = await res.json();
    setMerchant(data);
    const txRes = await fetch(`${API}/merchants/${merchant.id}/transactions?limit=10`);
    const txData = await txRes.json();
    setTransactions(txData.transactions || []);
    const analyticsRes = await fetch(`${API}/merchants/${merchant.id}/analytics`);
    if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
  };

  const handlePaymentConfirmed = () => {
    setTimeout(refreshBalance, 2000);
  };

  // ── Not Connected ──
  if (!publicKey) {
    return (
      <div className="onboarding-screen">
        <div className="onboarding-card">
          <div className="logo-wrap">
            <span className="logo-star">✦</span>
            <h1 className="logo-text">StellarPe</h1>
          </div>
          <p className="onboarding-tagline">Accept digital dollars. Get rupees.<br />No crypto knowledge required.</p>
          <div className="onboarding-steps">
            <div className="step"><span className="step-num">1</span><span>Connect your Stellar wallet</span></div>
            <div className="step"><span className="step-num">2</span><span>Generate a QR code with your price</span></div>
            <div className="step"><span className="step-num">3</span><span>Customer scans and pays in USDC</span></div>
            <div className="step"><span className="step-num">4</span><span>Settle to your bank account</span></div>
          </div>
          {walletError && (
            <div className="alert alert-warn">
              <AlertTriangle size={16} />
              {walletError}
              {walletError.includes('not detected') && (
                <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="alert-link">
                  Install Freighter ↗
                </a>
              )}
            </div>
          )}
          <button className="btn btn-primary btn-full btn-lg" onClick={connect} disabled={connecting}>
            <Wallet size={20} />
            {connecting ? 'Connecting…' : 'Connect Freighter Wallet'}
          </button>
          <p className="testnet-note">🌐 Running on Stellar Testnet — no real funds used</p>
        </div>
      </div>
    );
  }

  // ── Loading Merchant ──
  if (loadingMerchant) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Setting up your merchant account…</p>
      </div>
    );
  }

  // ── Main Dashboard ──
  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dash-header">
        <div className="dash-logo">
          <span className="logo-star-sm">✦</span>
          <span className="dash-logo-text">StellarPe</span>
        </div>
        <div className="dash-wallet">
          <div className="wallet-pill">
            <span className="wallet-dot" />
            <span className="wallet-addr">{truncate(publicKey)}</span>
          </div>
          <button className="btn-icon" onClick={disconnect} title="Disconnect">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="dash-main">
        {regError && (
          <div className="alert alert-error mb-4">
            <AlertTriangle size={16} /> {regError}
          </div>
        )}

        {/* Balance card */}
        <div className="balance-card">
          <div className="balance-label">
            <TrendingUp size={16} />
            Unsettled Balance
            <button className="btn-icon-sm" onClick={refreshBalance} title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="balance-amount">
            {merchant ? (merchant.unsettled_balance_usdc || '0.0000000') : '—'}
            <span className="balance-unit">USDC</span>
          </div>
          {merchant && (
            <div className="balance-inr-hint">
              ≈ ₹{(parseFloat(merchant.unsettled_balance_usdc || 0) * 83.5).toFixed(2)} INR
            </div>
          )}
        </div>

        {/* Analytics card */}
        {analytics && (
          <div className="card analytics-card">
            <h2 className="card-title">
              <BarChart2 size={18} /> Overview
            </h2>
            <div className="analytics-grid">
              <div className="analytic-item">
                <span className="analytic-label">Total Received</span>
                <span className="analytic-value">{analytics.total_received_usdc} USDC</span>
              </div>
              <div className="analytic-item">
                <span className="analytic-label">Total Settled</span>
                <span className="analytic-value">{analytics.total_settled_usdc} USDC</span>
              </div>
              <div className="analytic-item">
                <span className="analytic-label">Transactions</span>
                <span className="analytic-value">{analytics.tx_count}</span>
              </div>
              <div className="analytic-item">
                <span className="analytic-label">Avg Rating</span>
                <span className="analytic-value">
                  {analytics.feedback_avg_rating
                    ? <><Star size={13} style={{ display: 'inline', marginRight: 2 }} />{analytics.feedback_avg_rating}</>
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Settle button */}
        {merchant && parseFloat(merchant.unsettled_balance_usdc || 0) > 0 && (
          <SettleButton
            merchantId={merchant.id}
            balance={merchant.unsettled_balance_stroops}
            jwt={jwt}
            onSettled={() => setShowFeedback(true)}
          />
        )}

        {/* QR Generator */}
        <div className="card">
          <QRGenerator
            merchantId={merchant?.id}
            contractId={CONTRACT_ID}
          />
        </div>

        {/* Payment status monitor */}
        {merchant && (
          <div className="card">
            <h2 className="card-title">
              <Zap size={18} /> Live Payment Status
            </h2>
            <PaymentStatus
              merchantId={merchant.id}
              onConfirmed={handlePaymentConfirmed}
            />
          </div>
        )}

        {/* Recent transactions */}
        {transactions.length > 0 && (
          <div className="card">
            <h2 className="card-title">
              <Clock size={18} /> Recent Transactions
            </h2>
            <div className="tx-list">
              {transactions.map(tx => (
                <div key={tx.id} className="tx-row">
                  <div className="tx-left">
                    <span className={`tx-badge tx-badge-${tx.status}`}>{tx.status}</span>
                    <span className="tx-payer">{truncate(tx.payer_address)}</span>
                  </div>
                  <div className="tx-right">
                    <span className="tx-amount">+{(tx.amount_stroops / 1e7).toFixed(2)} USDC</span>
                    {tx.stellar_tx_hash && (
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${tx.stellar_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tx-explorer-link"
                        title="View on explorer"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback form (shown after settlement) */}
        {showFeedback && merchant && (
          <div className="card">
            <FeedbackForm
              merchantId={merchant.id}
              payerAddress={publicKey}
              onDone={() => setShowFeedback(false)}
            />
          </div>
        )}
      </main>

      <footer className="dash-footer">
        Built on Stellar Testnet · Powered by Soroban
      </footer>
    </div>
  );
}
