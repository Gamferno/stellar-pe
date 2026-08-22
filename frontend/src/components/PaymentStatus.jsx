import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, XCircle, Loader2, Zap } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const POLL_MS = 4000;

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: 'Awaiting Payment',
    color: 'status-pending',
    desc: 'Waiting for customer to scan and sign',
    pulse: true,
  },
  confirmed: {
    icon: CheckCircle2,
    label: 'Paid ✅',
    color: 'status-confirmed',
    desc: 'Payment confirmed on-chain!',
    pulse: false,
  },
  settled: {
    icon: Zap,
    label: 'Settled',
    color: 'status-settled',
    desc: 'Funds transferred to your bank account',
    pulse: false,
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    color: 'status-failed',
    desc: 'Payment failed or expired',
    pulse: false,
  },
};

export function PaymentStatus({ merchantId, onConfirmed }) {
  const [status, setStatus] = useState('pending');
  const [lastTx, setLastTx] = useState(null);
  const prevStatus = useRef('pending');

  useEffect(() => {
    if (!merchantId) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API}/merchants/${merchantId}/transactions?limit=1`);
        const data = await res.json();
        const tx = data.transactions?.[0];
        if (!tx) return;

        setLastTx(tx);
        if (tx.status !== prevStatus.current) {
          prevStatus.current = tx.status;
          setStatus(tx.status);
          if (tx.status === 'confirmed' && onConfirmed) onConfirmed(tx);
        }
      } catch {
        /* network error, keep polling */
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [merchantId, onConfirmed]);


  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <div className={`payment-status ${cfg.color}`}>
      <div className={`status-icon-wrap ${cfg.pulse ? 'pulse-ring' : ''}`}>
        <Icon size={36} />
      </div>
      <div className="status-text">
        <h3 className="status-label">{cfg.label}</h3>
        <p className="status-desc">{cfg.desc}</p>
        {lastTx && (
          <div className="status-meta">
            <span className="meta-pill">
              {(lastTx.amount_stroops / 1e7).toFixed(2)} USDC
            </span>
            {lastTx.stellar_tx_hash && (
              <a
                className="meta-link"
                href={`https://stellar.expert/explorer/testnet/tx/${lastTx.stellar_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Explorer ↗
              </a>
            )}
          </div>
        )}
      </div>
      {status === 'pending' && (
        <Loader2 size={18} className="status-spinner" />
      )}
    </div>
  );
}
