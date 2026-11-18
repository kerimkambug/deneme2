import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Clock3, Luggage, MessageCircle, Phone, PlaneLanding, Plus, ShieldCheck, Signpost, Star, Users, Wallet,
} from 'lucide-react';
import { useStore } from '../../data/store';
import { usePrefs, useT } from '../../lib/prefs';
import { money, telLink, waLink } from '../../lib/format';
import { minPrice } from '../../lib/pricing';
import { useCountUp, useReveal, useScrollVar } from '../../lib/motion';
import { ServiceIcon } from '../../components/icons';
import { VehicleMedia } from '../../components/VehicleMedia';
import { BookingWidget } from './BookingWidget';

function HeroDecor() {
  return (
    <svg className="hero-decor" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="hg1" cx="78%" cy="18%" r="60%">
          <stop offset="0" stopColor="var(--accent)" stopOpacity=".28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hg2" x1="0" x2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset=".5" stopColor="var(--accent)" stopOpacity=".9" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1440" height="800" fill="url(#hg1)" />
      <g className="hero-lines" fill="none" stroke="url(#hg2)">
        <path d="M-40 640C260 560 520 700 820 600S1260 420 1500 470" strokeWidth="1.4" />
        <path d="M-40 690C300 610 560 740 860 650S1280 480 1500 530" strokeWidth=".8" opacity=".6" />
        <path d="M-40 590C220 520 500 650 780 560S1240 380 1500 410" strokeWidth=".6" opacity=".4" />
      </g>
      <g fill="var(--accent)" opacity=".5">
        {Array.from({ length: 36 }, (_, i) => (
          <circle key={i} cx={(i * 211) % 1440} cy={(i * 97) % 420} r={(i % 3) * 0.6 + 0.4} className="hero-star" style={{ animationDelay: `${(i % 7) * 0.7}s` }} />
        ))}
      </g>
    </svg>
  );
}

function Stat({ value, suffix, label, decimals }: { value: number; suffix?: string; label: string; decimals?: boolean }) {
  const { ref, val } = useCountUp(decimals ? value * 10 : value);
  return (
    <div className="stat" data-reveal>
      <span className="stat-v" ref={ref}>
        {decimals ? (val / 10).toFixed(1) : val.toLocaleString('tr-TR')}
        {suffix}
      </span>
      <span className="stat-l">{label}</span>
    </div>
  );
}

export function Home() {
  const st = useStore((s) => s);
  const s = st.settings;
  const { t, tl, lang } = useT();
  const { currency } = usePrefs();
  const [faq, setFaq] = useState<string | null>(s.faqs[0]?.id ?? null);
  useReveal([lang]);
  useScrollVar();

  const vehicles = st.vehicles.filter((v) => v.active);
  const popular = st.routes.filter((r) => r.popular);
  const routes = popular.length ? popular : st.routes.slice(0, 8);
  const locName = (id: string) => st.locations.find((l) => l.id === id)?.name ?? id;
  const cheapest = vehicles.map((v) => v.id);
  const priceFrom = (r: (typeof routes)[number]) => {
    const ps = cheapest.map((id) => r.prices[id]).filter((p): p is number => !!p);
    return ps.length ? Math.min(...ps) : null;
  };
  const m = (v: number) => money(v, currency, s.rates, lang);

  const trust = [
    { icon: Wallet, text: t('trustFixed') },
    { icon: PlaneLanding, text: t('trustFlight') },
    { icon: Clock3, text: `${s.freeWaitMin} ${t('trustWait')}` },
    { icon: Signpost, text: t('trustSign') },
    { icon: ShieldCheck, text: t('trustLicensed') },
  ];

  return (
    <>
      {/* HERO */}
      <section className="hero" id="anasayfa">
        <div className="hero-clip">
          <div className="hero-bg" style={s.heroImage ? { backgroundImage: `url("${s.heroImage}")` } : undefined}>
            {!s.heroImage && <HeroDecor />}
          </div>
          <div className="hero-shade" />
        </div>
        <div className="wrap hero-in">
          <div className="hero-copy">
            <span className="kicker hero-anim" style={{ ['--d' as string]: '0ms' }}>{tl(s.tagline)}</span>
            <h1 className="hero-anim" style={{ ['--d' as string]: '120ms' }}>
              {tl(s.heroTitle)} <em>{tl(s.heroAccent)}</em>
            </h1>
            <p className="hero-anim" style={{ ['--d' as string]: '240ms' }}>{tl(s.heroSubtitle)}</p>
          </div>
          <div className="hero-anim hero-widget" style={{ ['--d' as string]: '380ms' }}>
            <BookingWidget />
          </div>
        </div>
        <div className="trustbar">
          <div className="trustbar-track">
            {[...trust, ...trust].map((x, i) => (
              <span key={i} aria-hidden={i >= trust.length}>
                <x.icon size={16} /> {x.text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      {s.stats.length > 0 && (
        <section className="stats wrap">
          {s.stats.map((x) => (
            <Stat key={x.id} value={x.value} suffix={x.suffix} decimals={x.decimals} label={tl(x.label)} />
          ))}
        </section>
      )}

      {/* SERVICES */}
      <section className="sec" id="hizmetler">
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <span className="kicker">{t('servicesKicker')}</span>
            <h2>{t('servicesTitle')}</h2>
          </div>
          <div className="svc-grid">
            {s.services.map((x, i) => (
              <article key={x.id} className="svc" data-reveal style={{ ['--d' as string]: `${(i % 3) * 90}ms` }}>
                <span className="svc-ic"><ServiceIcon name={x.icon} /></span>
                <h3>{tl(x.title)}</h3>
                <p>{tl(x.desc)}</p>
                <Link to="/rezervasyon" className="svc-link">
                  {t('bookNow')} <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FLEET */}
      <section className="sec sec-dark" id="filo">
        <div className="wrap">
          <div className="sec-head sec-head-row" data-reveal>
            <div>
              <span className="kicker">{t('fleetKicker')}</span>
              <h2>{t('fleetTitle')}</h2>
            </div>
            <p>{t('fleetIntro')}</p>
          </div>
          <div className="fleet-grid">
            {vehicles.map((v, i) => {
              const mp = minPrice(st, v.id);
              return (
                <article key={v.id} className="vcard" data-reveal style={{ ['--d' as string]: `${(i % 2) * 110}ms` }}>
                  <VehicleMedia v={v} gallery />
                  <div className="vcard-body">
                    <span className="vcard-cat">{tl(v.category)}</span>
                    <h3>{v.name}</h3>
                    <div className="vcard-cap">
                      <span><Users size={16} /> {v.pax} {t('pax')}</span>
                      <span><Luggage size={16} /> {v.luggage} {t('bags')}</span>
                    </div>
                    <p>{tl(v.description)}</p>
                    <ul className="vcard-feat">
                      {tl(v.features).split('\n').filter(Boolean).slice(0, 5).map((f) => (
                        <li key={f}><BadgeCheck size={14} /> {f}</li>
                      ))}
                    </ul>
                    <div className="vcard-foot">
                      {mp != null && (
                        <span className="vcard-price">
                          <small>{t('fromPrice')}</small> {m(mp)}
                        </span>
                      )}
                      <Link to={`/rezervasyon?vehicle=${v.id}`} className="btn btn-outline btn-sm">
                        {t('bookNow')} <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ROUTES */}
      <section className="sec" id="fiyatlar">
        <div className="wrap">
          <div className="sec-head sec-head-row" data-reveal>
            <div>
              <span className="kicker">{t('routesKicker')}</span>
              <h2>{t('routesTitle')}</h2>
            </div>
            <p>{t('routesIntro')}</p>
          </div>
          <div className="routes">
            {routes.map((r, i) => {
              const p = priceFrom(r);
              return (
                <Link
                  key={r.id}
                  to={`/rezervasyon?from=${r.from}&to=${r.to}`}
                  className="route"
                  data-reveal
                  style={{ ['--d' as string]: `${(i % 4) * 60}ms` }}
                >
                  <span className="route-path">
                    <b>{locName(r.from)}</b>
                    <i />
                    <b>{locName(r.to)}</b>
                  </span>
                  <span className="route-meta">
                    {r.distanceKm} km · ~{r.durationMin} {t('minutes')}
                  </span>
                  <span className="route-price">
                    {p != null ? m(p) : t('quoteOnly')} <ArrowRight size={15} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section className="sec sec-soft">
        <div className="wrap">
          <div className="sec-head center" data-reveal>
            <span className="kicker">{t('howKicker')}</span>
            <h2>{t('howTitle')}</h2>
          </div>
          <ol className="how">
            {([['how1t', 'how1d'], ['how2t', 'how2d'], ['how3t', 'how3d']] as const).map(([a, b], i) => (
              <li key={a} data-reveal style={{ ['--d' as string]: `${i * 140}ms` }}>
                <span className="how-n">0{i + 1}</span>
                <h3>{t(a)}</h3>
                <p>{t(b)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ABOUT */}
      <section className="sec" id="hakkimizda">
        <div className="wrap about">
          <div className="about-media" data-reveal>
            {s.aboutImage ? (
              <img src={s.aboutImage} alt={s.companyName} loading="lazy" />
            ) : (
              <div className="about-ph">
                <span>{s.shortName}</span>
              </div>
            )}
          </div>
          <div className="about-copy" data-reveal style={{ ['--d' as string]: '120ms' }}>
            <span className="kicker">{t('aboutKicker')}</span>
            <h2>{tl(s.aboutTitle)}</h2>
            <p>{tl(s.aboutText)}</p>
            <ul className="about-list">
              <li><ShieldCheck size={18} /> {t('trustLicensed')}</li>
              <li><PlaneLanding size={18} /> {t('trustFlight')}</li>
              <li><Clock3 size={18} /> {s.freeWaitMin} {t('trustWait')}</li>
              <li><Wallet size={18} /> {t('trustCancel')}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      {s.testimonials.length > 0 && (
        <section className="sec sec-dark">
          <div className="wrap">
            <div className="sec-head center" data-reveal>
              <span className="kicker">{t('reviewsKicker')}</span>
              <h2>{t('reviewsTitle')}</h2>
            </div>
            <div className="reviews">
              {s.testimonials.map((r, i) => (
                <figure key={r.id} className="review" data-reveal style={{ ['--d' as string]: `${i * 120}ms` }}>
                  <div className="review-stars" aria-label={`${r.rating}/5`}>
                    {Array.from({ length: 5 }, (_, k) => (
                      <Star key={k} size={15} fill={k < r.rating ? 'currentColor' : 'none'} />
                    ))}
                  </div>
                  <blockquote>“{r.text}”</blockquote>
                  <figcaption>
                    <span className="review-av">{r.name.slice(0, 1)}</span>
                    {r.name} <small>{r.country}</small>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="sec" id="sss">
        <div className="wrap faq-wrap">
          <div className="sec-head" data-reveal>
            <span className="kicker">{t('faqKicker')}</span>
            <h2>{t('faqTitle')}</h2>
            <p className="muted">{t('ctaText')}</p>
            {s.whatsapp && (
              <a className="btn btn-outline-dark" href={waLink(s.whatsapp)} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={17} /> {t('whatsapp')}
              </a>
            )}
          </div>
          <div className="faq" data-reveal>
            {s.faqs.map((f) => {
              const open = faq === f.id;
              return (
                <div key={f.id} className={`faq-item ${open ? 'open' : ''}`}>
                  <button aria-expanded={open} onClick={() => setFaq(open ? null : f.id)}>
                    <span>{tl(f.q)}</span>
                    <Plus size={18} />
                  </button>
                  <div className="faq-a">
                    <div>
                      <p>{tl(f.a)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta" id="iletisim">
        <div className="wrap cta-in" data-reveal>
          <div>
            <h2>{t('ctaTitle')}</h2>
            <p>{t('ctaText')}</p>
          </div>
          <div className="cta-actions">
            <Link to="/rezervasyon" className="btn btn-gold">
              {t('bookNow')} <ArrowRight size={17} />
            </Link>
            {s.whatsapp && (
              <a className="btn btn-outline" href={waLink(s.whatsapp)} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={17} /> {t('whatsapp')}
              </a>
            )}
            {s.phone && (
              <a className="btn btn-outline" href={telLink(s.phone)}>
                <Phone size={17} /> {t('call')}
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
