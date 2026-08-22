import { useState } from 'react';
import { Star, Send, Loader2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function FeedbackForm({ merchantId, payerAddress, onDone }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;
    setSending(true);
    try {
      await fetch(`${API}/merchants/${merchantId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payer_address: payerAddress, rating, comment }),
      });
      setDone(true);
      if (onDone) onDone();
    } catch {
      /* silent */
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="feedback-done">
        <span className="feedback-done-icon">🎉</span>
        <p>Thanks for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="feedback-form">
      <h3 className="feedback-title">How was the experience?</h3>
      <div className="star-row">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            className={`star-btn ${n <= (hovered || rating) ? 'star-active' : ''}`}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(n)}
            aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
          >
            <Star size={28} fill={n <= (hovered || rating) ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <textarea
        className="feedback-textarea"
        placeholder="Any comments? (optional)"
        rows={3}
        value={comment}
        onChange={e => setComment(e.target.value)}
      />
      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={!rating || sending}
      >
        {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
        Submit Feedback
      </button>
    </div>
  );
}
