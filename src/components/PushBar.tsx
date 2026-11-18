import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, Share } from 'lucide-react';
import { enablePush, pushState, type PushState } from '../lib/push';

/** Patron/şoför için "bildirimleri aç" çubuğu. Açıksa küçük bir rozet olarak kalır. */
export function PushBar({ role, onTest }: { role: 'admin' | 'driver'; onTest?: () => void }) {
  const [st, setSt] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    pushState().then(setSt);
  }, []);
  if (st === 'loading' || st === 'unsupported') return null;
  if (st === 'on') {
    return (
      <div className="pushbar on">
        <BellRing size={16} />
        <span>Bildirimler açık{role === 'admin' ? ': yeni rezervasyonlar telefonunuza gelir.' : ': yeni işler telefonunuza gelir.'}</span>
        {onTest && <button onClick={onTest}>Test et</button>}
      </div>
    );
  }
  if (st === 'ios-install') {
    return (
      <div className="pushbar">
        <Share size={16} />
        <span>iPhone’da bildirim için: Safari’de <b>Paylaş → Ana Ekrana Ekle</b> deyin, sonra uygulamayı ana ekrandan açın.</span>
      </div>
    );
  }
  if (st === 'denied') {
    return (
      <div className="pushbar warn">
        <BellOff size={16} />
        <span>Bildirim izni kapalı. Tarayıcı ayarlarından bu site için bildirimlere izin verin.</span>
      </div>
    );
  }
  return (
    <div className="pushbar cta">
      <Bell size={16} />
      <span>{role === 'admin' ? 'Yeni rezervasyonlardan anında haberdar olun.' : 'Yeni işlerden anında haberdar olun.'}</span>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setSt(await enablePush(role));
          } catch {
            setSt('off');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 size={14} className="spin" /> : null} Bildirimleri aç
      </button>
    </div>
  );
}
