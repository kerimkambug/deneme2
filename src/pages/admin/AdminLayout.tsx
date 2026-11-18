import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, CalendarClock, ListChecks, Car, Tags, UserRound, PanelsTopLeft, Settings, LogOut, ExternalLink, Menu, X, Lock, Loader2, WifiOff, Contact } from 'lucide-react';
import { REMOTE, adminLogin, hasToken, logout as storeLogout, useScope, useStatus, useStore } from '../../data/store';
import { toast } from './ui';
import { Brand } from '../../components/Brand';

const KEY = 'vip:admin';
const DEMO = import.meta.env.VITE_DEMO === '1';

export function useAdminAuth() {
  const [ok, setOk] = useState(() => {
    if (REMOTE) return hasToken('admin');
    try {
      return sessionStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const status = useStatus();
  useEffect(() => {
    // Sunucu oturumu reddettiyse giriş ekranına dön
    if (REMOTE && status === 'error' && !hasToken('admin')) setOk(false);
  }, [status]);
  const login = async (pw: string) => {
    const err = await adminLogin(pw);
    if (err) return err;
    if (!REMOTE) {
      try { sessionStorage.setItem(KEY, '1'); } catch { /* yok say */ }
    }
    setOk(true);
    return null;
  };
  const logout = () => {
    storeLogout('admin');
    try { sessionStorage.removeItem(KEY); } catch { /* yok say */ }
    setOk(false);
  };
  return { ok, login, logout };
}

function Login({ onLogin }: { onLogin: (pw: string) => Promise<string | null> }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await onLogin(v);
    setBusy(false);
    if (r) setErr(r);
  };
  return (
    <div className="alogin">
      <form className="alogin-card" onSubmit={submit}>
        <Brand />
        <h1>Yönetim Paneli</h1>
        <p>Devam etmek için şifrenizi girin.</p>
        <label className="afld">
          <span>Şifre</span>
          <input type="password" autoFocus value={v} onChange={(e) => { setV(e.target.value); setErr(''); }} />
        </label>
        {err && <p className="aerr">{err}</p>}
        <button className="abtn abtn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Lock size={16} />} Giriş Yap</button>
        {(DEMO || !REMOTE) && <small className="muted">Demo şifresi: <code>admin123</code></small>}
        <Link to="/" className="alogin-back">← Siteye dön</Link>
      </form>
    </div>
  );
}

const NAV = [
  { to: '/panel', end: true, icon: LayoutDashboard, label: 'Özet' },
  { to: '/panel/sevk', icon: CalendarClock, label: 'Sevk Planı' },
  { to: '/panel/rezervasyonlar', icon: ListChecks, label: 'Rezervasyonlar' },
  { to: '/panel/araclar', icon: Car, label: 'Araçlar' },
  { to: '/panel/fiyatlar', icon: Tags, label: 'Bölgeler & Fiyatlar' },
  { to: '/panel/soforler', icon: UserRound, label: 'Şoförler' },
  { to: '/panel/musteriler', icon: Contact, label: 'Müşteriler' },
  { to: '/panel/icerik', icon: PanelsTopLeft, label: 'Site İçeriği' },
  { to: '/panel/ayarlar', icon: Settings, label: 'Ayarlar' },
];

export function AdminLayout() {
  const { ok, login, logout } = useAdminAuth();
  const newCount = useStore((s) => s.bookings.filter((b) => b.status === 'new').length);
  const [open, setOpen] = useState(false);
  useScope(ok ? { kind: 'admin' } : null);
  const status = useStatus();
  const [loadedOnce, setLoadedOnce] = useState(!REMOTE);
  useEffect(() => {
    if (status === 'ready' && ok) setLoadedOnce(true);
  }, [status, ok]);
  useEffect(() => {
    const on = (e: Event) => toast((e as CustomEvent<string>).detail || 'Kaydedilemedi');
    window.addEventListener('vip:error', on);
    return () => window.removeEventListener('vip:error', on);
  }, []);
  if (!ok) return <Login onLogin={login} />;
  if (!loadedOnce) {
    return (
      <div className="alogin">
        <div className="alogin-card center">
          {status === 'error' ? <WifiOff size={26} /> : <Loader2 size={26} className="spin" />}
          <p>{status === 'error' ? 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip sayfayı yenileyin.' : 'Veriler yükleniyor…'}</p>
        </div>
      </div>
    );
  }
  return (
    <div className={`admin ${open ? 'nav-open' : ''}`}>
      <aside className="aside">
        <div className="aside-top">
          <Brand compact />
          <button className="aicon aside-x" onClick={() => setOpen(false)} aria-label="Kapat"><X size={18} /></button>
        </div>
        <nav onClick={() => setOpen(false)}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <n.icon size={18} strokeWidth={1.7} />
              <span>{n.label}</span>
              {n.to === '/panel/rezervasyonlar' && newCount > 0 && <em className="nav-count">{newCount}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="aside-foot">
          <Link to="/" target="_blank"><ExternalLink size={16} /> Siteyi görüntüle</Link>
          <Link to="/surucu" target="_blank"><Car size={16} /> Şoför ekranı</Link>
          <button onClick={logout}><LogOut size={16} /> Çıkış</button>
        </div>
      </aside>
      <div className="amain">
        <div className="atop">
          <button className="aicon" onClick={() => setOpen(true)} aria-label="Menü"><Menu size={20} /></button>
          <Brand compact />
        </div>
        <div className="acontent">
          <Outlet />
        </div>
      </div>
      <div className="aside-bg" onClick={() => setOpen(false)} />
    </div>
  );
}
