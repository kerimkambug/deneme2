import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Car, CheckCircle2, Loader2, LogOut, MapPin, Plane, Plus, Radio, Star, UserRound } from 'lucide-react';
import {
  claimBooking, customerLogin, customerLogout, customerRegister, isCustomerLoggedIn, REMOTE, updateProfile, useAccount, useScope, useStatus, useStore,
} from '../../data/store';
import { useT } from '../../lib/prefs';
import { STATUS_LABEL } from '../../lib/i18n';
import { dateLabel, telLink, waLink } from '../../lib/format';
import { pointText } from '../../lib/geo';
import type { Booking } from '../../types';

const ACTIVE = ['on_way', 'arrived', 'onboard'];

function AuthForms({ initialTab }: { initialTab: 'login' | 'register' }) {
  const { t } = useT();
  const s = useStore((x) => x.settings);
  const [tab, setTab] = useState(initialTab);
  const [f, setF] = useState({ login: '', password: '', name: '', email: '', phone: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErr('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (tab === 'login') await customerLogin(f.login, f.password);
      else await customerRegister({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password });
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="acc-auth">
      <div className="acc-auth-copy">
        <span className="kicker">{t('accMy')}</span>
        <h1>{t('accLoginTitle')}</h1>
        <p>{t('accLoginText')}</p>
        <ul>
          <li><Radio size={18} /> {t('accLive')}</li>
          <li><Car size={18} /> {t('yourDriver')}</li>
          <li><Plane size={18} /> {t('trustFlight')}</li>
        </ul>
      </div>
      <form className="card acc-form" onSubmit={submit}>
        <div className="seg">
          <button type="button" className={tab === 'login' ? 'on' : ''} onClick={() => setTab('login')}>{t('accLogin')}</button>
          <button type="button" className={tab === 'register' ? 'on' : ''} onClick={() => setTab('register')}>{t('accRegister')}</button>
        </div>
        {tab === 'login' ? (
          <>
            <label className="fld">
              <span>{t('accLoginId')}</span>
              <input value={f.login} onChange={(e) => set('login', e.target.value)} autoComplete="username" required />
            </label>
            <label className="fld">
              <span>{t('accPassword')}</span>
              <input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="current-password" required />
            </label>
          </>
        ) : (
          <>
            <label className="fld">
              <span>{t('fullName')}</span>
              <input value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" required />
            </label>
            <label className="fld">
              <span>{t('email')}</span>
              <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" required />
            </label>
            <label className="fld">
              <span>{t('phone')}</span>
              <input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" placeholder="+90 5xx xxx xx xx" required />
            </label>
            <label className="fld">
              <span>{t('accPassword2')}</span>
              <input type="password" minLength={6} value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" required />
            </label>
          </>
        )}
        {err && <p className="err">{err}</p>}
        <button className="btn btn-gold" disabled={busy}>
          {busy ? <Loader2 size={17} className="spin" /> : null} {tab === 'login' ? t('accLogin') : t('accRegister')}
        </button>
        <p className="acc-switch">
          {tab === 'login' ? t('accNoAccount') : t('accHaveAccount')}{' '}
          <button type="button" onClick={() => setTab(tab === 'login' ? 'register' : 'login')}>{tab === 'login' ? t('accRegister') : t('accLogin')}</button>
        </p>
        {tab === 'login' && (
          <p className="acc-forgot">
            {t('accForgot')}{' '}
            {s.whatsapp && <a href={waLink(s.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            {s.phone && <> · <a href={telLink(s.phone)}>{s.phone}</a></>}
          </p>
        )}
      </form>
    </div>
  );
}

function TripCard({ b }: { b: Booking }) {
  const { t, lang } = useT();
  const st = useStore((x) => x);
  const v = st.vehicles.find((x) => x.id === b.vehicleId);
  const d = st.drivers.find((x) => x.id === b.driverId);
  const loc = (id?: string) => st.locations.find((l) => l.id === id)?.name ?? '';
  const live = ACTIVE.includes(b.status);
  return (
    <article className={`trip ${live ? 'trip-live' : ''}`}>
      <div className="trip-date">
        <b>{dateLabel(b.date, lang, { day: 'numeric' })}</b>
        <small>{dateLabel(b.date, lang, { month: 'short' })}</small>
        <span>{b.time}</span>
      </div>
      <div className="trip-body">
        <span className={`badge st-${b.status}`}>{STATUS_LABEL[b.status][lang]}</span>
        <p className="trip-route">
          <MapPin size={14} /> {pointText(b.fromPoint) || loc(b.fromId)}
        </p>
        {b.type === 'transfer' && (
          <p className="trip-route">
            <MapPin size={14} /> {pointText(b.toPoint) || loc(b.toId)}
          </p>
        )}
        <small className="muted">
          {b.code} · {v?.name}
          {d && ` · ${d.name} (${d.plate})`}
        </small>
      </div>
      <Link to={`/takip/${b.code}`} className={`btn btn-sm ${live || (b.status === 'completed' && !b.review) ? 'btn-gold' : 'btn-outline-dark'}`}>
        {live ? <><Radio size={15} /> {t('accLive')}</> : b.status === 'completed' && !b.review ? <><Star size={15} /> {t('rateCta')}</> : <>{t('accDetails')} <ArrowRight size={15} /></>}
      </Link>
    </article>
  );
}

export function Account() {
  const { t } = useT();
  const nav = useNavigate();
  const [qp] = useSearchParams();
  const account = useAccount();
  const status = useStatus();
  const logged = isCustomerLoggedIn();
  useScope(logged ? { kind: 'customer' } : { kind: 'public' });
  const bookings = useStore((x) => x.bookings);
  const [code, setCode] = useState(qp.get('ekle') ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [prof, setProf] = useState({ name: '', phone: '', oldPassword: '', password: '' });
  const [profMsg, setProfMsg] = useState('');

  useEffect(() => {
    if (account) setProf((p) => ({ ...p, name: account.name, phone: account.phone }));
  }, [account]);

  // Takip sayfasından "hesabıma ekle" ile gelindiyse kodu otomatik ekle
  useEffect(() => {
    const c = qp.get('ekle');
    if (c && account && !bookings.some((b) => b.code === c.toUpperCase())) {
      claimBooking(c)
        .then(() => setMsg({ ok: true, text: t('accClaimed') }))
        .catch((e) => setMsg({ ok: false, text: (e as Error).message }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  if (!logged || (!REMOTE && !account)) {
    return (
      <div className="bk">
        <div className="wrap acc-wrap">
          <AuthForms initialTab={qp.get('kayit') === '1' ? 'register' : 'login'} />
        </div>
      </div>
    );
  }
  if (!account) {
    return (
      <div className="bk">
        <div className="wrap acc-wrap"><p className="empty">{status === 'error' ? '—' : <Loader2 size={20} className="spin" />}</p></div>
      </div>
    );
  }

  const mine = bookings.filter((b) => b.customerId === account.id || REMOTE);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const sorted = [...mine].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const upcoming = sorted.filter((b) => ACTIVE.includes(b.status) || (b.date >= today && !['completed', 'cancelled', 'no_show'].includes(b.status)));
  const past = sorted.filter((b) => !upcoming.includes(b)).reverse();

  const claim = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    try {
      await claimBooking(code);
      setMsg({ ok: true, text: t('accClaimed') });
      setCode('');
    } catch (x) {
      setMsg({ ok: false, text: (x as Error).message });
    }
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfMsg('');
    try {
      await updateProfile({ name: prof.name, phone: prof.phone, ...(prof.password ? { password: prof.password, oldPassword: prof.oldPassword } : {}) });
      setProf((p) => ({ ...p, password: '', oldPassword: '' }));
      setProfMsg(t('accSaved'));
    } catch (x) {
      setProfMsg((x as Error).message);
    }
  };

  return (
    <div className="bk">
      <div className="bk-hero">
        <div className="wrap acc-head">
          <div>
            <span className="kicker">{t('accMy')}</span>
            <h1>{t('accHello')}, {account.name.split(' ')[0]}</h1>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { customerLogout(); nav('/'); }}>
            <LogOut size={15} /> {t('accLogout')}
          </button>
        </div>
      </div>
      <div className="wrap acc-grid">
        <div className="acc-main">
          {qp.get('yeni') === '1' && (
            <div className="card success">
              <CheckCircle2 size={28} />
              <p>{t('accWelcome')}</p>
            </div>
          )}
          <section>
            <h2 className="acc-h">{t('accUpcoming')}</h2>
            {upcoming.length === 0 ? (
              <div className="card acc-empty">
                <p>{t('accEmpty')}</p>
                <Link to="/rezervasyon" className="btn btn-gold btn-sm">{t('bookNow')} <ArrowRight size={15} /></Link>
              </div>
            ) : (
              <div className="trips">{upcoming.map((b) => <TripCard key={b.id} b={b} />)}</div>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="acc-h">{t('accPast')}</h2>
              <div className="trips">{past.map((b) => <TripCard key={b.id} b={b} />)}</div>
            </section>
          )}
        </div>
        <aside className="acc-side">
          <form className="card acc-box" onSubmit={claim}>
            <h3><Plus size={17} /> {t('accClaim')}</h3>
            <div className="inline-field">
              <input value={code} onChange={(e) => { setCode(e.target.value); setMsg(null); }} placeholder="VT…" autoCapitalize="characters" aria-label={t('trackCode')} />
              <button className="btn btn-outline-dark btn-sm">{t('accClaimBtn')}</button>
            </div>
            {msg && <p className={msg.ok ? 'ok-msg' : 'err'}>{msg.text}</p>}
          </form>
          <form className="card acc-box" onSubmit={saveProfile}>
            <h3><UserRound size={17} /> {t('accProfile')}</h3>
            <label className="fld"><span>{t('fullName')}</span><input value={prof.name} onChange={(e) => setProf({ ...prof, name: e.target.value })} /></label>
            <label className="fld"><span>{t('email')}</span><input value={account.email} disabled /></label>
            <label className="fld"><span>{t('phone')}</span><input type="tel" value={prof.phone} onChange={(e) => setProf({ ...prof, phone: e.target.value })} /></label>
            <label className="fld"><span>{t('accOldPw')}</span><input type="password" value={prof.oldPassword} onChange={(e) => setProf({ ...prof, oldPassword: e.target.value })} autoComplete="current-password" /></label>
            <label className="fld"><span>{t('accNewPw')}</span><input type="password" minLength={6} value={prof.password} onChange={(e) => setProf({ ...prof, password: e.target.value })} autoComplete="new-password" /></label>
            {profMsg && <p className={profMsg === t('accSaved') ? 'ok-msg' : 'err'}>{profMsg}</p>}
            <button className="btn btn-outline-dark btn-sm">{t('accSave')}</button>
          </form>
        </aside>
      </div>
    </div>
  );
}
