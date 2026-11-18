import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, UserRound, Phone, MessageCircle, Mail, MapPin, Instagram, ShieldCheck } from 'lucide-react';
import { Brand } from '../../components/Brand';
import { CookieBar } from '../../components/CookieBar';
import { isCustomerLoggedIn, useAccount, useStore } from '../../data/store';
import { usePrefs, useT } from '../../lib/prefs';
import { LANG_LABEL } from '../../lib/i18n';
import { CURRENCIES, LANGS } from '../../types';
import { telLink, waLink } from '../../lib/format';

export function SiteLayout() {
  const s = useStore((x) => x.settings);
  const { t } = useT();
  const { lang, setLang, currency, setCurrency } = usePrefs();
  const [open, setOpen] = useState(false);
  useAccount();
  const logged = isCustomerLoggedIn();
  const [solid, setSolid] = useState(false);
  const loc = useLocation();
  const isHome = loc.pathname === '/';

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname, loc.hash]);
  useEffect(() => {
    document.title = `${s.companyName} | ${s.tagline[lang]}`;
  }, [s.companyName, s.tagline, lang]);
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', s.accent);
  }, [s.accent]);

  const nav: [string, string][] = [
    ['/#hizmetler', t('navServices')],
    ['/#filo', t('navFleet')],
    ['/#fiyatlar', t('navRoutes')],
    ['/#hakkimizda', t('navAbout')],
    ['/#sss', t('navFaq')],
    ['/takip', t('navTrack')],
  ];

  return (
    <div className="site">
      <header className={`hdr ${solid || !isHome ? 'hdr-solid' : ''} ${open ? 'hdr-open' : ''}`}>
        <div className="wrap hdr-in">
          <Link to="/" className="hdr-brand" aria-label={s.companyName}>
            <Brand />
          </Link>
          <nav className="hdr-nav" aria-label="Ana menü">
            {nav.map(([href, label]) => (
              <Link key={href} to={href}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="hdr-tools">
            <div className="seg-select">
              <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
              <select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <Link to="/hesap" className="hdr-acc" aria-label={logged ? t('accMy') : t('accLogin')} title={logged ? t('accMy') : t('accLogin')}>
              <UserRound size={18} />
              <span>{logged ? t('accMy') : t('accLogin')}</span>
            </Link>
            <Link to="/rezervasyon" className="btn btn-gold btn-sm hdr-cta">
              {t('bookNow')}
            </Link>
            <button className="hdr-burger" aria-label="Menü" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        <div className="mnav" hidden={!open}>
          {nav.map(([href, label]) => (
            <Link key={href} to={href}>
              {label}
            </Link>
          ))}
          <Link to="/hesap">{logged ? t('accMy') : `${t('accLogin')} / ${t('accRegister')}`}</Link>
          <div className="mnav-langs">
            {LANGS.map((l) => (
              <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
          <Link to="/rezervasyon" className="btn btn-gold">
            {t('bookNow')}
          </Link>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="ftr">
        <div className="wrap ftr-grid">
          <div>
            <Brand />
            <p className="ftr-about">{s.aboutText[lang].split('. ')[0]}.</p>
            {s.licenseNo && (
              <p className="ftr-lic">
                <ShieldCheck size={15} /> {s.licenseNo}
              </p>
            )}
          </div>
          <div>
            <h4>{t('navContact')}</h4>
            <ul className="ftr-list">
              {s.phone && (
                <li>
                  <a href={telLink(s.phone)}>
                    <Phone size={15} /> {s.phone}
                  </a>
                </li>
              )}
              {s.whatsapp && (
                <li>
                  <a href={waLink(s.whatsapp)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={15} /> WhatsApp
                  </a>
                </li>
              )}
              {s.email && (
                <li>
                  <a href={`mailto:${s.email}`}>
                    <Mail size={15} /> {s.email}
                  </a>
                </li>
              )}
              {s.address && (
                <li>
                  <MapPin size={15} /> {s.address}
                </li>
              )}
              {s.instagram && (
                <li>
                  <a href={`https://instagram.com/${s.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
                    <Instagram size={15} /> {s.instagram}
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h4>{t('navServices')}</h4>
            <ul className="ftr-list">
              {s.services.slice(0, 5).map((x) => (
                <li key={x.id}>
                  <Link to="/#hizmetler">{x.title[lang]}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>{t('bkTitle')}</h4>
            <ul className="ftr-list">
              <li>
                <Link to="/rezervasyon">{t('bookNow')}</Link>
              </li>
              <li>
                <Link to="/takip">{t('navTrack')}</Link>
              </li>
              <li>
                <Link to="/#sss">{t('navFaq')}</Link>
              </li>
              <li>
                <Link to="/gizlilik">{t('privacy')}</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="wrap ftr-bottom">
          <span>
            © {new Date().getFullYear()} {s.companyName}. {t('rights')}
          </span>
          <span className="ftr-pay">EUR · USD · GBP · TRY</span>
        </div>
      </footer>

      <CookieBar />
      {s.whatsapp && (
        <a className="fab-wa" href={waLink(s.whatsapp)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
          <MessageCircle size={26} />
        </a>
      )}
    </div>
  );
}
