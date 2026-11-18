import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../lib/prefs';

const KEY = 'vip:cookie-ok';

/** Basit çerez/yerel depolama bildirimi (yalnızca zorunlu depolama kullanıldığı için onay tek tuştur). */
export function CookieBar() {
  const { t } = useT();
  const [ok, setOk] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return true;
    }
  });
  if (ok) return null;
  return (
    <div className="cookiebar" role="region" aria-label="Cookies">
      <p>
        {t('cookieText')} <Link to="/gizlilik">{t('privacy')}</Link>
      </p>
      <button
        className="btn btn-gold btn-sm"
        onClick={() => {
          try {
            localStorage.setItem(KEY, '1');
          } catch {
            /* yok say */
          }
          setOk(true);
        }}
      >
        {t('cookieOk')}
      </button>
    </div>
  );
}
