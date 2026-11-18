import { useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { submitReview, useStore } from '../data/store';
import { useT } from '../lib/prefs';
import type { Booking } from '../types';

/** Tamamlanan yolculuk için yıldız + yorum formu */
export function ReviewCard({ b }: { b: Booking }) {
  const { t } = useT();
  const googleUrl = useStore((s) => s.settings.googleReviewUrl);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (b.review) {
    return (
      <div className="card review-card done">
        <div className="stars static" aria-label={`${b.review.rating}/5`}>
          {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={22} fill={n <= b.review!.rating ? 'currentColor' : 'none'} />)}
        </div>
        <p><b>{t('rateThanks')}</b></p>
        {b.review.rating >= 4 && googleUrl && (
          <>
            <p className="muted">{t('rateGoogle')}</p>
            <a className="btn btn-gold btn-sm" href={googleUrl} target="_blank" rel="noopener noreferrer">{t('rateGoogleBtn')}</a>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="card review-card">
      <h3>{t('rateTitle')}</h3>
      <div className="stars" role="radiogroup" aria-label={t('rateTitle')} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}`}
            className={n <= (hover || rating) ? 'on' : ''}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
          >
            <Star size={30} fill={n <= (hover || rating) ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('rateText')} />
          {err && <p className="err">{err}</p>}
          <button
            className="btn btn-gold"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await submitReview(b.code, rating, text.trim());
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 size={16} className="spin" />} {t('rateSend')}
          </button>
        </>
      )}
    </div>
  );
}
