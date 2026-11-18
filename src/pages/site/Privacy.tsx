import { useScope, useStore } from '../../data/store';
import { useT } from '../../lib/prefs';

/** KVKK aydınlatma metni / gizlilik politikası (panelden düzenlenir). */
export function Privacy() {
  const s = useStore((x) => x.settings);
  const { t, tl } = useT();
  useScope({ kind: 'public' });
  const text = tl(s.privacyText)
    .replace(/\{UNVAN\}/g, s.legalName || s.companyName)
    .replace(/\{ADRES\}/g, s.address || '—')
    .replace(/\{EPOSTA\}/g, s.email || '—');
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="bk">
      <div className="bk-hero">
        <div className="wrap narrow">
          <h1>{t('privacy')}</h1>
        </div>
      </div>
      <div className="wrap narrow legal">
        {blocks.map((b, i) =>
          b.startsWith('## ') ? (
            <div key={i}>
              <h2>{b.split('\n')[0].slice(3)}</h2>
              {b.split('\n').slice(1).filter(Boolean).map((p, k) => <p key={k}>{p}</p>)}
            </div>
          ) : (
            <p key={i}>{b}</p>
          ),
        )}
      </div>
    </div>
  );
}
