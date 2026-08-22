import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, RefreshCw, QrCode } from 'lucide-react';

export function QRGenerator({ merchantId, contractId }) {
  const [amount, setAmount] = useState('');
  const [generated, setGenerated] = useState(false);
  const qrRef = useRef(null);

  const uri = merchantId
    ? `stellarpe://pay?merchant=${encodeURIComponent(merchantId)}&amount=${encodeURIComponent(amount)}&asset=USDC&contract=${contractId || ''}`
    : '';

  const handleGenerate = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setGenerated(true);

    // Log event to backend
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/merchants/${merchantId}/qr?amount=${amount}`)
      .catch(() => {/* silent */});
  };

  const handleReset = () => {
    setGenerated(false);
    setAmount('');
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
          <p className="qr-scan-hint">Customer scans with their Stellar wallet</p>
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
        </div>
      )}
    </div>
  );
}
