import { ask, askText } from '../../components/dialog';
import { useEffect, useState, type FormEvent } from 'react';
import { Baby, ChevronRight, Luggage, LogOut, MapPinned, MessageCircle, Phone, Plane, Signature, Users, X, Wallet, UserX, Loader2, Radio, MessagesSquare } from 'lucide-react';
import { REMOTE, loadChat, useChat, driverList, driverLogin, hasToken, logout, sendLocation, setBookingStatus, useScope, useStatus, useStore } from '../../data/store';
import { STATUS_LABEL } from '../../lib/i18n';
import { dateLabel, eur, flightLink, mapsLink, telLink, todayIso, waLink } from '../../lib/format';
import { Brand } from '../../components/Brand';
import { PushBar } from '../../components/PushBar';
import { ChatPanel } from '../../components/ChatPanel';
import { chatOpen, unreadCount } from '../../lib/chat';
import { DriverExpenses } from './expenses';
import { PoolList, usePool } from './pool';
import { beep } from '../../lib/push';
import { directionsLink, pointText } from '../../lib/geo';
import type { Booking, BookingStatus } from '../../types';

const KEY = 'vip:driver';
const DEMO = import.meta.env.VITE_DEMO === '1';

const NEXT: Partial<Record<BookingStatus, { to: BookingStatus; label: string }>> = {
  confirmed: { to: 'on_way', label: 'Yola çıktım' },
  assigned: { to: 'on_way', label: 'Yola çıktım' },
  on_way: { to: 'arrived', label: 'Alış noktasına vardım' },
  arrived: { to: 'onboard', label: 'Müşteri araçta' },
  onboard: { to: 'completed', label: 'Transferi tamamla' },
};

function Login({ onOk }: { onOk: (id: string) => void }) {
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [id, setId] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    driverList().then((l) => {
      setDrivers(l);
      setLoaded(true);
      setId((cur) => cur || l[0]?.id || '');
    });
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await driverLogin(id, pin);
    setBusy(false);
    if (r) setErr(r);
    else onOk(id);
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
        {loaded && drivers.length === 0 && <p className="aerr">Henüz şoför hesabı yok. Yöneticiniz panelden şoför ekleyip size PIN vermeli.</p>}
        <label className="afld">
          <span>PIN</span>
          <input inputMode="numeric" type="password" autoComplete="one-time-code" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setErr(''); }} maxLength={6} />
        </label>
        {err && <p className="aerr">{err}</p>}
        <button className="drv-big" disabled={busy || !id}>{busy ? <Loader2 size={20} className="spin" /> : null} Giriş</button>
        {(DEMO || !REMOTE) && <small className="muted">Demo PIN: 1234</small>}
      </form>
    </div>
  );
}

const SHARE_KEY = 'vip:share';
type ShareState = 'off' | 'waiting' | 'on' | 'denied' | 'unsupported';

/** Aktif iş varken (izin verildiyse) konumu düzenli gönderir. */
function useLiveShare(driverId: string, job: Booking | undefined, enabled: boolean): ShareState {
  const [st, setSt] = useState<ShareState>('off');
  const jobId = job?.id;
  useEffect(() => {
    if (!enabled || !jobId) {
      setSt('off');
      return;
    }
    if (!('geolocation' in navigator)) {
      setSt('unsupported');
      return;
    }
    setSt('waiting');
    let last = 0;
    let trailing: number | undefined;
    let pending: GeolocationPosition | null = null;
    const push = (p: GeolocationPosition) => {
      last = Date.now();
      pending = null;
      void sendLocation(driverId, {
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        acc: Math.round(p.coords.accuracy),
        heading: p.coords.heading ?? undefined,
        speed: p.coords.speed ?? undefined,
        bookingId: jobId,
      });
    };
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        setSt('on');
        const wait = 8000 - (Date.now() - last);
        if (wait <= 0) return push(p);
        // Sık güncellemelerde en sonuncuyu kısa süre sonra gönder
        pending = p;
        window.clearTimeout(trailing);
        trailing = window.setTimeout(() => pending && push(pending), wait);
      },
      (e) => setSt(e.code === 1 ? 'denied' : 'waiting'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    // Araç dururken de konum taze kalsın (sunucu 3 dk sessizlikte paylaşımı kapatır)
    const keepAlive = window.setInterval(() => {
      if (Date.now() - last > 60000) navigator.geolocation.getCurrentPosition(push, () => undefined, { maximumAge: 30000 });
    }, 30000);
    return () => {
      window.clearTimeout(trailing);
      window.clearInterval(keepAlive);
      navigator.geolocation.clearWatch(watch);
      void lock?.release().catch(() => undefined);
      void sendLocation(driverId, null);
    };
  }, [enabled, jobId, driverId]);
  return st;
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
  const [chatUi, setChatOpenUi] = useState(false);
  const chat = useChat(b.id);
  const unread = unreadCount(chat?.chat, 'driver');
  useEffect(() => {
    if (chatOpen(b.status, b.driverId)) void loadChat('driver', b).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.id, b.status]);
  const loc = (id?: string) => s.locations.find((l) => l.id === id)?.name ?? '';
  const v = s.vehicles.find((x) => x.id === b.vehicleId);
  const next = NEXT[b.status];
  const active = ['on_way', 'arrived', 'onboard'].includes(b.status);
  const target = b.status === 'onboard' ? b.toPoint : b.fromPoint;
  const navHref = target ? directionsLink(target) : mapsLink(b.status === 'onboard' ? `${b.toDetail || ''} ${loc(b.toId)}` : `${b.fromDetail || ''} ${loc(b.fromId)}`);
  const fromName = b.fromPoint?.label || loc(b.fromId);
  const toName = b.toPoint?.label || loc(b.toId);
  const extras = Object.entries(b.extras).map(([id, n]) => `${s.extras.find((e) => e.id === id)?.name.tr ?? id} ×${n}`);

  const advance = async () => {
    if (!next) return;
    if (next.to === 'completed' && b.payment !== 'online') {
      const v = await askText('Müşteriden tahsil edilen tutar', String(b.price || ''), { title: 'Transferi tamamla', okText: 'Tamamla', inputMode: 'decimal', suffix: '€' });
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
          <b>{fromName} → {b.type === 'transfer' ? toName : `${b.hours} saat`}</b>
          <small>{b.customer.name} · <Users size={12} /> {b.adults + b.children} · <Luggage size={12} /> {b.luggage}</small>
        </span>
        <span className={`badge st-${b.status}`}>{STATUS_LABEL[b.status].tr}</span>
        <ChevronRight size={18} className={`chev ${open || active ? 'rot' : ''}`} />
      </button>

      {(open || active) && (
        <div className="djob-b">
          <dl className="adl">
            {b.flightNo && (<><dt>Uçuş</dt><dd><Plane size={14} /> <b>{b.flightNo}</b> <a className="maplink" href={flightLink(b.flightNo)} target="_blank" rel="noopener noreferrer">Durum</a></dd></>)}
            <dt>Alış</dt><dd>{pointText(b.fromPoint) || loc(b.fromId)}{b.fromDetail && ` · ${b.fromDetail}`}</dd>
            {b.type === 'transfer' && (<><dt>Varış</dt><dd>{pointText(b.toPoint) || loc(b.toId)}{b.toDetail && ` · ${b.toDetail}`}{b.distanceKm ? ` · ~${b.distanceKm} km` : ''}</dd></>)}
            <dt>Araç</dt><dd>{v?.name}</dd>
            {extras.length > 0 && (<><dt>Ekstra</dt><dd><Baby size={14} /> {extras.join(', ')}</dd></>)}
            {b.notes && (<><dt>Not</dt><dd className="tx-warn">{b.notes}</dd></>)}
            <dt>Ödeme</dt><dd>{b.payment === 'cash' ? 'Nakit al' : b.payment === 'card_vehicle' ? 'Kart (POS)' : 'Ödendi'}{b.price ? ` · ${eur(b.price)}` : ''}</dd>
          </dl>
          <div className="djob-acts">
            <a href={telLink(b.customer.phone)}><Phone size={20} /> Ara</a>
            <a href={waLink(b.customer.phone)} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} /> Yaz</a>
            <a href={navHref} target="_blank" rel="noopener noreferrer"><MapPinned size={20} /> {b.status === 'onboard' ? 'Varışa git' : 'Alışa git'}</a>
            <button onClick={onSign}><Signature size={20} /> Tabela</button>
            {(chatOpen(b.status, b.driverId) || (chat?.chat.messages.length ?? 0) > 0) && (
              <button onClick={() => setChatOpenUi(true)} className="djob-chat">
                <MessagesSquare size={20} /> Mesaj
                {unread > 0 && <em className="badge-dot">{unread}</em>}
              </button>
            )}
          </div>
          {next && (
            <button className="drv-big" onClick={advance}>
              {next.to === 'completed' && <Wallet size={20} />} {next.label}
            </button>
          )}
          {b.status === 'arrived' && (
            <button className="drv-ghost" onClick={async () => (await ask('Müşteri gelmedi olarak işaretlensin mi? Ofise bildirilecek.')) && setBookingStatus(b.id, 'no_show', 'şoför')}>
              <UserX size={18} /> Müşteri gelmedi
            </button>
          )}
        </div>
      )}
      {chatUi && (
        <div className="sheet-bg" onMouseDown={(e) => e.target === e.currentTarget && setChatOpenUi(false)}>
          <div className="sheet" role="dialog" aria-label="Mesajlar">
            <div className="sheet-h">
              <div>
                <b>{b.customer.name}</b>
                <small>{b.code} · yolcu dili: {b.lang.toUpperCase()}</small>
              </div>
              <button className="aicon" onClick={() => setChatOpenUi(false)} aria-label="Kapat"><X size={20} /></button>
            </div>
            <ChatPanel b={b} as="driver" lang="tr" height={360} />
            <small className="muted sheet-hint">Hazır mesajlar yolcuya kendi dilinde ({b.lang.toUpperCase()}) gider.</small>
          </div>
        </div>
      )}
    </article>
  );
}

export function Driver() {
  const [id, setId] = useState<string | null>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return REMOTE && !hasToken('driver') ? null : v;
    } catch { return null; }
  });
  const s = useStore((x) => x);
  const status = useStatus();
  const [day, setDay] = useState<'today' | 'tomorrow' | 'later' | 'pool'>('today');
  const [sign, setSign] = useState<Booking | null>(null);
  const [share, setShare] = useState(() => {
    try { return localStorage.getItem(SHARE_KEY) === '1'; } catch { return false; }
  });
  useScope(id ? { kind: 'driver' } : null);
  const me = s.drivers.find((d) => d.id === id && d.active);
  const pool = usePool(me);
  const activeJob = s.bookings.find((b) => b.driverId === id && ['on_way', 'arrived', 'onboard'].includes(b.status));
  const shareState = useLiveShare(id ?? '', activeJob, !!me && share);
  useEffect(() => {
    if (REMOTE && status === 'error' && !hasToken('driver')) setId(null);
  }, [status]);
  useEffect(() => {
    const nj = () => beep();
    const nc = (e: Event) => {
      if ((e as CustomEvent<{ msg: { from: string } }>).detail?.msg?.from === 'customer') beep();
    };
    window.addEventListener('vip:new-job', nj);
    window.addEventListener('vip:pool', nj);
    window.addEventListener('vip:chat', nc);
    return () => {
      window.removeEventListener('vip:new-job', nj);
      window.removeEventListener('vip:pool', nj);
      window.removeEventListener('vip:chat', nc);
    };
  }, []);
  const toggleShare = (v: boolean) => {
    setShare(v);
    try { localStorage.setItem(SHARE_KEY, v ? '1' : '0'); } catch { /* yok say */ }
  };

  useEffect(() => {
    document.title = 'Şoför · ' + s.settings.companyName;
  }, [s.settings.companyName]);

  if (id && !me && REMOTE && status !== 'error') {
    return (
      <div className="drv drv-login">
        <form><Loader2 size={26} className="spin" /><p>Yükleniyor…</p></form>
      </div>
    );
  }
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
  const poolOn = !!s.settings.dispatchMode && s.settings.dispatchMode !== 'manual';
  const list = day === 'pool' ? [] : lists[day];
  const cash = lists.today.reduce((a, b) => a + (b.cashCollected ?? 0), 0);
  const left = lists.today.filter((b) => !['completed', 'no_show'].includes(b.status)).length;

  return (
    <div className="drv">
      <header className="drv-h">
        <div>
          <small>Merhaba,</small>
          <b>{me.name}</b>
        </div>
        <button className="aicon" aria-label="Çıkış" onClick={() => { try { localStorage.removeItem(KEY); } catch { /* yok say */ } logout('driver'); setId(null); }}><LogOut size={18} /></button>
      </header>
      <div className="drv-sum">
        <div><b>{left}</b><small>kalan iş</small></div>
        <div><b>{lists.today.length - left}</b><small>biten</small></div>
        <div><b>{eur(cash)}</b><small>bugün tahsilat</small></div>
      </div>
      <div className={`share share-${share ? shareState : 'off'}`}>
        <Radio size={20} />
        <div>
          <b>Canlı konum paylaşımı</b>
          <small>
            {!share
              ? 'Kapalı. Açarsanız yalnızca aktif iş sırasında müşteri ve ofis aracınızı haritada görür.'
              : shareState === 'on'
                ? 'Paylaşılıyor · müşteriniz aracınızı haritada görüyor'
                : shareState === 'waiting'
                  ? 'Konum alınıyor…'
                  : shareState === 'denied'
                    ? 'Konum izni verilmedi. Tarayıcı ayarlarından izin verin.'
                    : shareState === 'unsupported'
                      ? 'Bu cihaz konum paylaşımını desteklemiyor.'
                      : 'Açık · “Yola çıktım” dediğinizde başlar, iş bitince durur'}
          </small>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={share} onChange={(e) => toggleShare(e.target.checked)} aria-label="Canlı konum paylaşımı" />
          <span className="toggle-ui" />
        </label>
      </div>
      <PushBar role="driver" />
      {share && shareState === 'on' && <p className="drv-keep">Paylaşım sürerken bu ekranı açık tutun.</p>}
      <div className="drv-tabs">
        {([['today', 'Bugün'], ['tomorrow', 'Yarın'], ['later', 'Sonraki']] as const).map(([k, l]) => (
          <button key={k} className={day === k ? 'on' : ''} onClick={() => setDay(k)}>
            {l} <em>{lists[k].length}</em>
          </button>
        ))}
        {poolOn && (
          <button className={`${day === 'pool' ? 'on' : ''} ${pool.length ? 'has-pool' : ''}`} onClick={() => setDay('pool')}>
            Havuz <em>{pool.length}</em>
          </button>
        )}
      </div>
      {day === 'pool' ? <PoolList me={me} items={pool} /> : (<>
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
      </>)}
      <DriverExpenses driverId={me.id} />
      {sign && <NameSign b={sign} onClose={() => setSign(null)} />}
    </div>
  );
}
