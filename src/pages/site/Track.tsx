import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Car, Check, Loader2, UserRound, CheckCircle2, Copy, MessageCircle, Phone, Search } from 'lucide-react';
import { REMOTE, isCustomerLoggedIn, useAccount, useScope, useStatus, useStore } from '../../data/store';
import { usePrefs, useT } from '../../lib/prefs';
import { STATUS_LABEL } from '../../lib/i18n';
import { dateLabel, money, telLink, waLink } from '../../lib/format';
import type { BookingStatus } from '../../types';
import { haversineKm, mapLink, pointText } from '../../lib/geo';
import { LiveMap } from '../../components/LiveMap';
import { ReviewCard } from '../../components/ReviewCard';
import { ChatPanel } from '../../components/ChatPanel';
import { beep } from '../../lib/push';

const FLOW: BookingStatus[] = ['new', 'confirmed', 'assigned', 'on_way', 'arrived', 'onboard', 'completed'];

export function Track() {
  const { code: param } = useParams();
  const [qp] = useSearchParams();
  const nav = useNavigate();
  const st = useStore((s) => s);
  const { t, lang } = useT();
  const { currency } = usePrefs();
  const [code, setCode] = useState(param ?? '');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<{ msg: { from: string } }>).detail?.msg?.from === 'driver') beep();
    };
    window.addEventListener('vip:chat', on);
    return () => window.removeEventListener('vip:chat', on);
  }, []);
  useEffect(() => {
    const tm = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(tm);
  }, []);

  useScope(param ? { kind: 'track', code: param.toUpperCase() } : { kind: 'public' });
  const status = useStatus();
  const account = useAccount();
  const logged = isCustomerLoggedIn();
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (status === 'loading') setSeen(true);
    const tm = window.setTimeout(() => setSeen(true), 4000);
    return () => window.clearTimeout(tm);
  }, [status]);
  const b = param ? st.bookings.find((x) => x.code.toUpperCase() === param.toUpperCase()) : undefined;
  const s = st.settings;
  const waiting = REMOTE && !!param && !b && (!seen || status === 'loading');

  const find = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) nav(`/takip/${code.trim().toUpperCase()}`);
  };

  if (waiting) {
    return (
      <div className="bk">
        <div className="bk-hero"><div className="wrap"><h1>{t('trackTitle')}</h1></div></div>
        <div className="wrap narrow"><p className="empty"><Loader2 size={18} className="spin" /></p></div>
      </div>
    );
  }

  if (!b) {
    return (
      <div className="bk">
        <div className="bk-hero">
          <div className="wrap"><h1>{t('trackTitle')}</h1></div>
        </div>
        <div className="wrap narrow">
          <form className="card bk-card track-form" onSubmit={find}>
            <label className="fld">
              <span>{t('trackCode')}</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VT…" autoCapitalize="characters" />
            </label>
            <button className="btn btn-gold"><Search size={17} /> {t('trackFind')}</button>
            {param && <p className="err">{t('trackNotFound')}</p>}
          </form>
        </div>
      </div>
    );
  }

  const loc = (id?: string) => st.locations.find((l) => l.id === id)?.name ?? '';
  const fromTxt = pointText(b.fromPoint) || loc(b.fromId);
  const toTxt = pointText(b.toPoint) || loc(b.toId);
  const v = st.vehicles.find((x) => x.id === b.vehicleId);
  const d = st.drivers.find((x) => x.id === b.driverId);
  const showDriver = d && ['assigned', 'on_way', 'arrived', 'onboard'].includes(b.status);
  const rawLoc = d ? st.live[d.id] : undefined;
  const liveLoc = rawLoc && showDriver && ['on_way', 'arrived', 'onboard'].includes(b.status) && now - Date.parse(rawLoc.at) < 3 * 60e3 ? rawLoc : undefined;
  const target = b.status === 'onboard' ? b.toPoint : b.fromPoint;
  const etaMin = liveLoc && target ? Math.max(1, Math.round(((haversineKm(liveLoc, target) * (s.roadFactor || 1.3)) / 40) * 60)) : null;
  const idx = FLOW.indexOf(b.status);
  const ended = b.status === 'cancelled' || b.status === 'no_show';
  const isNew = qp.get('yeni') === '1';

  const msg = [
    `${s.companyName} — ${b.code}`,
    `${fromTxt}${b.fromDetail ? ` (${b.fromDetail})` : ''}${b.type === 'transfer' ? ` → ${toTxt}${b.toDetail ? ` (${b.toDetail})` : ''}` : ` · ${b.hours} h`}`,
    b.fromPoint && mapLink(b.fromPoint),
    `${b.date} ${b.time}${b.roundTrip ? ` / ↩ ${b.returnDate} ${b.returnTime}` : ''}`,
    `${v?.name ?? ''} · ${b.adults + b.children} pax · ${b.luggage} bags`,
    b.flightNo && `✈ ${b.flightNo}`,
    `${b.customer.name} · ${b.customer.phone}`,
    b.price ? `${money(b.price, b.displayCurrency, s.rates, lang)}` : '',
  ].filter(Boolean).join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(b.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* desteklenmiyor */
    }
  };

  return (
    <div className="bk">
      <div className="bk-hero">
        <div className="wrap">
          <h1>{t('trackTitle')}</h1>
        </div>
      </div>
      <div className="wrap narrow track">
        {isNew && (
          <div className="card success">
            <CheckCircle2 size={34} />
            <div>
              <h2>{t('thanks')}</h2>
              <p>{t('thanksText')}</p>
              {s.whatsapp && (
                <a className="btn btn-gold btn-sm" href={waLink(s.whatsapp, msg)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={16} /> {t('sendWhatsapp')}
                </a>
              )}
            </div>
          </div>
        )}

        <div className="card track-head">
          <div>
            <small>{t('trackCode')}</small>
            <div className="track-code">
              {b.code}
              <button className="icon-btn" onClick={copy} aria-label={t('copy')}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <span className={`badge st-${b.status}`}>{STATUS_LABEL[b.status][lang]}</span>
        </div>

        {!ended && (
          <ol className="timeline card">
            {FLOW.map((k, i) => {
              const h = b.history.find((x) => x.status === k);
              return (
                <li key={k} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
                  <span className="dot">{i < idx ? <Check size={12} /> : null}</span>
                  <b>{STATUS_LABEL[k][lang]}</b>
                  {h && <small>{new Date(h.at).toLocaleString(lang, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</small>}
                </li>
              );
            })}
          </ol>
        )}

        {b.status === 'completed' && <ReviewCard b={b} />}

        {liveLoc && d && (
          <div className="card live-card">
            <div className="live-head">
              <b><span className="live-dot" /> {t('liveTitle')}</b>
              {b.status === 'arrived' ? null : etaMin != null && (
                <span className="live-eta">~{etaMin} {t('minutes')}<small>{b.status === 'onboard' ? t('liveToDrop') : t('liveToPickup')}</small></span>
              )}
            </div>
            <LiveMap
              center={liveLoc}
              markers={[
                { id: 'car', kind: 'car', lat: liveLoc.lat, lng: liveLoc.lng, heading: liveLoc.heading, label: d.plate },
                ...(target ? [{ id: b.status === 'onboard' ? 'drop' : 'pickup', kind: (b.status === 'onboard' ? 'drop' : 'pickup') as 'drop' | 'pickup', lat: target.lat, lng: target.lng, label: b.status === 'onboard' ? t('dropPin') : t('pickupPin') }] : []),
              ]}
            />
            {b.status === 'arrived' && <p className="note">{t('liveArrived')}</p>}
            <p className="live-note">{t('liveUpdated')}: {Math.max(0, Math.round((now - Date.parse(liveLoc.at)) / 1000))} {t('liveSec')}</p>
          </div>
        )}

        <div className="card driver-card">
          <h3>{t('yourDriver')}</h3>
          {showDriver ? (
            <div className="driver-row">
              <span className="driver-av">{d!.name.slice(0, 1)}</span>
              <div>
                <b>{d!.name}</b>
                <small>
                  <Car size={14} /> {v?.name} · {d!.plate}
                </small>
                <small>{d!.languages}</small>
              </div>
              <div className="driver-acts">
                <a className="icon-btn" href={telLink(d!.phone)} aria-label={t('call')}><Phone size={18} /></a>
                <a className="icon-btn" href={waLink(d!.phone)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>
              </div>
            </div>
          ) : (
            <p className="muted">{t('driverPending')}</p>
          )}
        </div>

        {b.driverId && !['new', 'confirmed', 'cancelled'].includes(b.status) && (
          <div className="card chat-card">
            <h3>{t('chatTitle')}</h3>
            <ChatPanel b={b} as="customer" lang={lang} />
          </div>
        )}

        {!logged ? (
          <div className="card acc-cta">
            <UserRound size={22} />
            <p>{t('accTrackCta')}</p>
            <div className="row-gap">
              <Link className="btn btn-gold btn-sm" to={`/hesap?kayit=1&ekle=${b.code}`}>{t('accRegister')}</Link>
              <Link className="btn btn-outline-dark btn-sm" to={`/hesap?ekle=${b.code}`}>{t('accLogin')}</Link>
            </div>
          </div>
        ) : account && b.customerId === account.id ? (
          isNew && qp.get('hesap') === '1' ? (
            <div className="card acc-cta">
              <UserRound size={22} />
              <p>{t('accWelcome')}</p>
              <Link className="btn btn-outline-dark btn-sm" to="/hesap">{t('accMy')}</Link>
            </div>
          ) : null
        ) : (
          <div className="card acc-cta">
            <UserRound size={22} />
            <p>{t('accTrackCta')}</p>
            <Link className="btn btn-gold btn-sm" to={`/hesap?ekle=${b.code}`}>{t('accAddToAccount')}</Link>
          </div>
        )}

        <div className="card">
          <h3>{t('details')}</h3>
          <dl className="dl">
            <dt>{t('routeLbl')}</dt>
            <dd>
              {fromTxt}{b.fromDetail && ` · ${b.fromDetail}`}
              {b.type === 'transfer' ? <> → {toTxt}{b.toDetail && ` · ${b.toDetail}`}</> : ` · ${b.hours} ${t('hoursLbl')}`}
              {b.distanceKm ? ` · ~${b.distanceKm} km` : ''}
            </dd>
            <dt>{t('dateLbl')}</dt>
            <dd>
              {dateLabel(b.date, lang)} · {b.time}
              {b.roundTrip && <> / ↩ {dateLabel(b.returnDate!, lang)} · {b.returnTime}</>}
            </dd>
            <dt>{t('vehicleLbl')}</dt>
            <dd>{v?.name}</dd>
            <dt>{t('guestsLbl')}</dt>
            <dd>{b.adults + b.children} · {b.luggage} {t('bags')}</dd>
            {b.flightNo && (<><dt>{t('flightNo')}</dt><dd>{b.flightNo}</dd></>)}
            <dt>{t('total')}</dt>
            <dd>{b.price ? money(b.price, currency, s.rates, lang) : t('quoteOnly')}</dd>
          </dl>
          <div className="row-gap">
            {s.whatsapp && (
              <a className="btn btn-outline-dark btn-sm" href={waLink(s.whatsapp, `${b.code}: `)} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} /> {t('whatsapp')}
              </a>
            )}
            {s.phone && (
              <a className="btn btn-outline-dark btn-sm" href={telLink(s.phone)}>
                <Phone size={16} /> {t('call')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
