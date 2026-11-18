import { useEffect, useState, type FormEvent } from 'react';
import { Baby, ChevronRight, Luggage, LogOut, MapPinned, MessageCircle, Phone, Plane, Signature, Users, X, Wallet, UserX } from 'lucide-react';
import { setBookingStatus, useStore } from '../../data/store';
import { STATUS_LABEL } from '../../lib/i18n';
import { dateLabel, eur, mapsLink, telLink, todayIso, waLink } from '../../lib/format';
import { Brand } from '../../components/Brand';
import type { Booking, BookingStatus } from '../../types';

const KEY = 'vip:driver';

const NEXT: Partial<Record<BookingStatus, { to: BookingStatus; label: string }>> = {
  confirmed: { to: 'on_way', label: 'Yola çıktım' },
  assigned: { to: 'on_way', label: 'Yola çıktım' },
  on_way: { to: 'arrived', label: 'Alış noktasına vardım' },
  arrived: { to: 'onboard', label: 'Müşteri araçta' },
  onboard: { to: 'completed', label: 'Transferi tamamla' },
};

function Login({ onOk }: { onOk: (id: string) => void }) {
  const all = useStore((s) => s.drivers);
  const drivers = all.filter((d) => d.active);
  const [id, setId] = useState(drivers[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const d = drivers.find((x) => x.id === id);
    if (d && d.pin === pin) onOk(id);
    else setErr(true);
  };
  return (
    <div className="drv drv-login">
      <form onSubmit={submit}>
        <Brand />
        <h1>Şoför Girişi</h1>
        <label className="afld">
          <span>Adınız</span>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="afld">
          <span>PIN</span>
          <input inputMode="numeric" type="password" autoComplete="one-time-code" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setErr(false); }} maxLength={6} />
        </label>
        {err && <p className="aerr">PIN hatalı.</p>}
        <button className="drv-big">Giriş</button>
        <small className="muted">Demo PIN: 1234</small>
      </form>
    </div>
  );
}

function NameSign({ b, onClose }: { b: Booking; onClose: () => void }) {
  const s = useStore((x) => x.settings);
  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => undefined);
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, []);
  return (
    <div className="sign" onClick={onClose}>
      <button className="sign-x" aria-label="Kapat"><X size={28} /></button>
      <div className="sign-brand">{s.logo ? <img src={s.logo} alt="" /> : s.companyName}</div>
      <div className="sign-name">{b.nameSign || b.customer.name}</div>
      {b.flightNo && <div className="sign-sub">{b.flightNo}</div>}
      <small className="sign-hint">Telefonu yatay çevirin · kapatmak için dokunun</small>
    </div>
  );
}

function Job({ b, onSign }: { b: Booking; onSign: () => void }) {
  const s = useStore((x) => x);
  const [open, setOpen] = useState(false);
  const loc = (id?: string) => s.locations.find((l) => l.id === id)?.name ?? '';
  const v = s.vehicles.find((x) => x.id === b.vehicleId);
  const next = NEXT[b.status];
  const active = ['on_way', 'arrived', 'onboard'].includes(b.status);
  const dest = b.status === 'onboard' ? `${b.toDetail || ''} ${loc(b.toId)}` : `${b.fromDetail || ''} ${loc(b.fromId)}`;
  const extras = Object.entries(b.extras).map(([id, n]) => `${s.extras.find((e) => e.id === id)?.name.tr ?? id} ×${n}`);

  const advance = () => {
    if (!next) return;
    if (next.to === 'completed' && b.payment !== 'online') {
      const v = prompt(`Tahsil edilen tutar (EUR)?`, String(b.price || ''));
      if (v === null) return;
      setBookingStatus(b.id, 'completed', 'şoför', { cashCollected: Math.max(0, Number(v.replace(',', '.')) || 0) });
      return;
    }
    setBookingStatus(b.id, next.to, 'şoför');
  };

  return (
    <article className={`djob ${active ? 'live' : ''} ${b.status === 'completed' ? 'done' : ''}`}>
      <button className="djob-h" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="djob-time">{b.time}</span>
        <span className="djob-main">
          <b>{loc(b.fromId)} → {b.toId ? loc(b.toId) : `${b.hours} saat`}</b>
          <small>{b.customer.name} · <Users size={12} /> {b.adults + b.children} · <Luggage size={12} /> {b.luggage}</small>
        </span>
        <span className={`badge st-${b.status}`}>{STATUS_LABEL[b.status].tr}</span>
        <ChevronRight size={18} className={`chev ${open || active ? 'rot' : ''}`} />
      </button>

      {(open || active) && (
        <div className="djob-b">
          <dl className="adl">
            {b.flightNo && (<><dt>Uçuş</dt><dd><Plane size={14} /> <b>{b.flightNo}</b></dd></>)}
            <dt>Alış</dt><dd>{loc(b.fromId)}{b.fromDetail && ` · ${b.fromDetail}`}</dd>
            {b.toId && (<><dt>Varış</dt><dd>{loc(b.toId)}{b.toDetail && ` · ${b.toDetail}`}</dd></>)}
            <dt>Araç</dt><dd>{v?.name}</dd>
            {extras.length > 0 && (<><dt>Ekstra</dt><dd><Baby size={14} /> {extras.join(', ')}</dd></>)}
            {b.notes && (<><dt>Not</dt><dd className="tx-warn">{b.notes}</dd></>)}
            <dt>Ödeme</dt><dd>{b.payment === 'cash' ? 'Nakit al' : b.payment === 'card_vehicle' ? 'Kart (POS)' : 'Ödendi'}{b.price ? ` · ${eur(b.price)}` : ''}</dd>
          </dl>
          <div className="djob-acts">
            <a href={telLink(b.customer.phone)}><Phone size={20} /> Ara</a>
            <a href={waLink(b.customer.phone)} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} /> Yaz</a>
            <a href={mapsLink(dest.trim())} target="_blank" rel="noopener noreferrer"><MapPinned size={20} /> Yol tarifi</a>
            <button onClick={onSign}><Signature size={20} /> Tabela</button>
          </div>
          {next && (
            <button className="drv-big" onClick={advance}>
              {next.to === 'completed' && <Wallet size={20} />} {next.label}
            </button>
          )}
          {b.status === 'arrived' && (
            <button className="drv-ghost" onClick={() => confirm('Müşteri gelmedi olarak işaretlensin mi? Ofise bildirilecek.') && setBookingStatus(b.id, 'no_show', 'şoför')}>
              <UserX size={18} /> Müşteri gelmedi
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export function Driver() {
  const [id, setId] = useState<string | null>(() => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  });
  const s = useStore((x) => x);
  const [day, setDay] = useState<'today' | 'tomorrow' | 'later'>('today');
  const [sign, setSign] = useState<Booking | null>(null);
  const me = s.drivers.find((d) => d.id === id && d.active);

  useEffect(() => {
    document.title = 'Şoför · ' + s.settings.companyName;
  }, [s.settings.companyName]);

  if (!me)
    return (
      <Login
        onOk={(x) => {
          try { localStorage.setItem(KEY, x); } catch { /* yok say */ }
          setId(x);
        }}
      />
    );

  const t0 = todayIso();
  const t1 = todayIso(1);
  const mine = s.bookings
    .filter((b) => b.driverId === me.id && !['cancelled'].includes(b.status))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const lists = {
    today: mine.filter((b) => b.date === t0),
    tomorrow: mine.filter((b) => b.date === t1),
    later: mine.filter((b) => b.date > t1),
  };
  const list = lists[day];
  const cash = lists.today.reduce((a, b) => a + (b.cashCollected ?? 0), 0);
  const left = lists.today.filter((b) => !['completed', 'no_show'].includes(b.status)).length;

  return (
    <div className="drv">
      <header className="drv-h">
        <div>
          <small>Merhaba,</small>
          <b>{me.name}</b>
        </div>
        <button className="aicon" aria-label="Çıkış" onClick={() => { try { localStorage.removeItem(KEY); } catch { /* yok say */ } setId(null); }}><LogOut size={18} /></button>
      </header>
      <div className="drv-sum">
        <div><b>{left}</b><small>kalan iş</small></div>
        <div><b>{lists.today.length - left}</b><small>biten</small></div>
        <div><b>{eur(cash)}</b><small>bugün tahsilat</small></div>
      </div>
      <div className="drv-tabs">
        {([['today', 'Bugün'], ['tomorrow', 'Yarın'], ['later', 'Sonraki']] as const).map(([k, l]) => (
          <button key={k} className={day === k ? 'on' : ''} onClick={() => setDay(k)}>
            {l} <em>{lists[k].length}</em>
          </button>
        ))}
      </div>
      <p className="drv-date">{dateLabel(day === 'tomorrow' ? t1 : t0, 'tr', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <div className="drv-list">
        {list.length === 0 && <p className="empty">Bu gün için atanmış iş yok.</p>}
        {list.map((b) => (
          <div key={b.id}>
            {day === 'later' && <p className="drv-date sm">{dateLabel(b.date, 'tr')}</p>}
            <Job b={b} onSign={() => setSign(b)} />
          </div>
        ))}
      </div>
      {sign && <NameSign b={sign} onClose={() => setSign(null)} />}
    </div>
  );
}
