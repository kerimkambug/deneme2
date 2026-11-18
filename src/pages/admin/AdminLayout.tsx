import { useState, type FormEvent } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, CalendarClock, ListChecks, Car, Tags, UserRound, PanelsTopLeft, Settings, LogOut, ExternalLink, Menu, X, Lock } from 'lucide-react';
import { useStore } from '../../data/store';
import { Brand } from '../../components/Brand';

const KEY = 'vip:admin';

export function useAdminAuth() {
  const [ok, setOk] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const login = () => {
    try { sessionStorage.setItem(KEY, '1'); } catch { /* yok say */ }
    setOk(true);
  };
  const logout = () => {
    try { sessionStorage.removeItem(KEY); } catch { /* yok say */ }
    setOk(false);
  };
  return { ok, login, logout };
}

function Login({ onOk }: { onOk: () => void }) {
  const pw = useStore((s) => s.settings.adminPassword);
  const [v, setV] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (v === pw) onOk();
    else setErr(true);
  };
  return (
    <div className="alogin">
      <form className="alogin-card" onSubmit={submit}>
        <Brand />
        <h1>Yönetim Paneli</h1>
        <p>Devam etmek için şifrenizi girin.</p>
        <label className="afld">
          <span>Şifre</span>
          <input type="password" autoFocus value={v} onChange={(e) => { setV(e.target.value); setErr(false); }} />
        </label>
        {err && <p className="aerr">Şifre hatalı.</p>}
        <button className="abtn abtn-primary"><Lock size={16} /> Giriş Yap</button>
        <small className="muted">Demo şifresi: <code>admin123</code></small>
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
  { to: '/panel/icerik', icon: PanelsTopLeft, label: 'Site İçeriği' },
  { to: '/panel/ayarlar', icon: Settings, label: 'Ayarlar' },
];

export function AdminLayout() {
  const { ok, login, logout } = useAdminAuth();
  const newCount = useStore((s) => s.bookings.filter((b) => b.status === 'new').length);
  const [open, setOpen] = useState(false);
  if (!ok) return <Login onOk={login} />;
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
