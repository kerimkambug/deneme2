import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Clock3, Luggage, MapPin, Users } from 'lucide-react';
import { useScope, useStore } from '../../data/store';
import { usePrefs, useT } from '../../lib/prefs';
import { money } from '../../lib/format';
import { homeTexts, publicRoutes, routeBySlug, routeSlug, routeTexts, tx } from '../../lib/seo';
import { useSeo } from '../../lib/useSeo';

/** Güzergâh sayfası: arama motorları ve yapay zekâ için "A'dan B'ye nasıl gidilir" cevabı + fiyatlar */
export function TransferRoute() {
  const { slug = '' } = useParams();
  const st = useStore((s) => s);
  const { lang, t } = useT();
  const { currency } = usePrefs();
  useScope({ kind: 'public' });
  const r = routeBySlug(st, slug);
  const info = r ? routeTexts(st, r, lang) : null;
  useSeo(info?.title ?? homeTexts(st, lang).title, info?.description);
  const m = (v: number) => money(v, currency, st.settings.rates, lang);

  if (!r || !info || !info.offers.length) {
    return (
      <div className="bk">
        <div className="bk-hero"><div className="wrap narrow"><h1>404</h1></div></div>
        <div className="wrap narrow legal"><p><Link to="/rezervasyon" className="btn btn-gold">{t('bookNow')} <ArrowRight size={15} /></Link></p></div>
      </div>
    );
  }
  const others = publicRoutes(st).filter((x) => x.id !== r.id).slice(0, 12);

  return (
    <div className="bk">
      <div className="bk-hero">
        <div className="wrap narrow">
          <nav className="crumbs"><Link to="/">{tx('home', lang)}</Link> › <span>{info.h1}</span></nav>
          <h1>{info.h1}</h1>
          <p className="tr-meta">
            <span><MapPin size={15} /> {r.distanceKm} km</span>
            <span><Clock3 size={15} /> ~{r.durationMin} {t('minutes')}</span>
          </p>
        </div>
      </div>
      <div className="wrap narrow legal">
        <p className="tr-lead">{info.faq[0].a}</p>
        <div className="tr-prices">
          {info.offers.map((o) => (
            <Link key={o.vehicle.id} to={`/rezervasyon?from=${r.from}&to=${r.to}`} className="tr-price">
              <b>{o.vehicle.name}</b>
              <small><Users size={13} /> {o.vehicle.pax} · <Luggage size={13} /> {o.vehicle.luggage}</small>
              <span>{m(o.price)} <ArrowRight size={15} /></span>
            </Link>
          ))}
        </div>
        <p><Link to={`/rezervasyon?from=${r.from}&to=${r.to}`} className="btn btn-gold">{tx('book', lang)} <ArrowRight size={15} /></Link></p>
        {info.faq.slice(1).map((f) => (
          <div key={f.q}>
            <h2>{f.q}</h2>
            <p>{f.a}</p>
          </div>
        ))}
        {others.length > 0 && (
          <>
            <h2>{tx('routesH', lang)}</h2>
            <ul className="tr-links">
              {others.map((x) => (
                <li key={x.id}><Link to={`/transfer/${routeSlug(st, x)}`}>{routeTexts(st, x, lang).h1}</Link></li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
