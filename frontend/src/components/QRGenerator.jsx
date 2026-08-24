import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, RefreshCw, QrCode, Zap, Loader2 } from 'lucide-react';

// USDC issuer on Stellar Testnet
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export function QRGenerator({ merchantId, walletAddress, _contractId }) {
  const [amount, setAmount] = useState('');
  const [generated, setGenerated] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simMsg, setSimMsg] = useState('');
  const qrRef = useRef(null);

  // SEP-7 payment URI — scannable by Lobstr, StellarX, and other SEP-7 wallets
  // destination = merchant's G... wallet, memo = merchantId for backend routing
  const uri = walletAddress && amount
    ? `web+stellar:pay?destination=${walletAddress}&amount=${encodeURIComponent(amount)}&asset_code=USDC&asset_issuer=${USDC_ISSUER}&memo=${encodeURIComponent(merchantId)}&memo_type=text`
    : '';

  const handleGenerate = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setGenerated(true);
    setSimMsg('');

    // Log event to backend
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/merchants/${merchantId}/qr?amount=${amount}`)
      .catch(() => {/* silent */});
  };

  const handleReset = () => {
    setGenerated(false);
    setAmount('');
    setSimMsg('');
  };

  const handleSimulatePay = async () => {
    setSimulating(true);
    setSimMsg('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/merchants/${merchantId}/pay-simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_usdc: amount }),
      });
      const data = await res.json();
      if (data.ok) {
        setSimMsg(`✅ Paid on-chain! Tx: ${data.tx_hash.slice(0, 10)}…`);
      }
    } catch (e) {
      setSimMsg('Simulated payment error: ' + e.message);
    } finally {
      setSimulating(false);
    }
  };

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stellarpe-qr-${amount}-usdc.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="qr-generator">
      {!generated ? (
        <div className="qr-input-section">
          <div className="qr-icon-wrap">
            <QrCode size={32} className="qr-icon" />
          </div>
          <h3 className="qr-title">Generate Payment QR</h3>
          <p className="qr-subtitle">Enter the amount in USDC to collect</p>
          <div className="amount-input-wrap">
            <span className="currency-badge">USDC</span>
            <input
              type="number"
              className="amount-input"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            />
          </div>
          <button
            className="btn btn-primary btn-full"
            onClick={handleGenerate}
            disabled={!amount || parseFloat(amount) <= 0}
          >
            Generate QR Code
          </button>
        </div>
      ) : (
        <div className="qr-display-section">
          <div className="qr-amount-badge">
            <span className="qr-amount-label">Amount</span>
            <span className="qr-amount-value">{parseFloat(amount).toFixed(2)} USDC</span>
          </div>
          <div className="qr-code-wrap" ref={qrRef}>
            <QRCodeSVG
              value={uri}
              size={220}
              level="M"
              bgColor="#ffffff"
              fgColor="#1a1a2e"
              includeMargin={true}
            />
          </div>
          <p className="qr-scan-hint">Scan with <strong>Lobstr</strong> or any SEP-7 wallet to pay directly</p>
          <div className="qr-actions">
            <button className="btn btn-outline" onClick={downloadQR}>
              <Download size={16} />
              Download
            </button>
            <button className="btn btn-outline" onClick={handleReset}>
              <RefreshCw size={16} />
              New Amount
            </button>
          </div>

          <div style={{ marginTop: '0.85rem' }}>
            <button
              className="btn btn-accent btn-full"
              onClick={handleSimulatePay}
              disabled={simulating}
            >
              {simulating ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Submitting On-Chain Payment…
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Simulate Customer Pay ({parseFloat(amount || 0).toFixed(2)} USDC)
                </>
              )}
            </button>
            {simMsg && <p className="qr-scan-hint" style={{ color: '#00d26a', marginTop: '0.45rem' }}>{simMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
