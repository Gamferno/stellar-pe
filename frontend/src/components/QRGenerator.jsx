import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, RefreshCw, QrCode, Zap, Loader2, Copy, Check } from 'lucide-react';

// USDC issuer on Stellar Testnet
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export function QRGenerator({ merchantId, walletAddress, _contractId }) {
  const [amount, setAmount] = useState('');
  const [generated, setGenerated] = useState(false);
  const [qrMode, setQrMode] = useState('address'); // 'address' (Freighter/All) | 'sep7' (Lobstr)
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simMsg, setSimMsg] = useState('');
  const qrRef = useRef(null);

  // SEP-7 payment URI — scannable by Lobstr, StellarX
  const sep7Uri = walletAddress && amount
    ? `web+stellar:pay?destination=${walletAddress}&amount=${encodeURIComponent(amount)}&asset_code=USDC&asset_issuer=${USDC_ISSUER}&memo=${encodeURIComponent(merchantId)}&memo_type=text`
    : '';

  // Raw address — scannable by Freighter Mobile Send scanner & all wallets
  const activeQrValue = qrMode === 'sep7' ? sep7Uri : (walletAddress || '');

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

  const handleCopyAddr = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const handleCopyMemo = () => {
    if (!merchantId) return;
    navigator.clipboard.writeText(merchantId);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2000);
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

          {/* QR Mode Switcher */}
          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', margin: '0.75rem 0 0.5rem' }}>
            <button
              className={`btn btn-sm ${qrMode === 'address' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setQrMode('address')}
              title="Encodes raw Stellar G... address (Works with Freighter Mobile & all send scanners)"
            >
              Freighter / Address Mode
            </button>
            <button
              className={`btn btn-sm ${qrMode === 'sep7' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setQrMode('sep7')}
              title="Encodes SEP-7 deep link (Works with Lobstr / StellarX)"
            >
              Lobstr / SEP-7 Mode
            </button>
          </div>

          <div className="qr-code-wrap" ref={qrRef}>
            <QRCodeSVG
              value={activeQrValue}
              size={220}
              level="M"
              bgColor="#ffffff"
              fgColor="#1a1a2e"
              includeMargin={true}
            />
          </div>

          <p className="qr-scan-hint">
            {qrMode === 'address'
              ? <>Scan with <strong>Freighter Mobile</strong> Send scanner</>
              : <>Scan with <strong>Lobstr</strong> or any SEP-7 wallet</>}
          </p>

          {/* Address & Memo Copy Box */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.65rem 0.85rem', margin: '0.6rem 0', fontSize: '0.8rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Merchant Address:</span>
              <button className="btn-icon-sm" onClick={handleCopyAddr} title="Copy Address">
                {copiedAddr ? <Check size={13} color="#00d26a" /> : <Copy size={13} />}
              </button>
            </div>
            <code style={{ color: '#a78bfa', wordBreak: 'break-all', display: 'block', fontSize: '0.75rem' }}>
              {walletAddress}
            </code>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Memo (Text): <strong style={{ color: '#fff' }}>{merchantId}</strong></span>
              <button className="btn-icon-sm" onClick={handleCopyMemo} title="Copy Memo">
                {copiedMemo ? <Check size={13} color="#00d26a" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

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
