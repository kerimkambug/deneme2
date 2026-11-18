import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PrefsProvider } from './lib/prefs';
import { USE_HASH } from './lib/format';
import { SiteLayout } from './pages/site/SiteLayout';
import { Home } from './pages/site/Home';
import { Booking } from './pages/site/Booking';
import { Track } from './pages/site/Track';
import { Account } from './pages/site/Account';
import { Privacy } from './pages/site/Privacy';
import { Customers } from './pages/admin/Customers';
import { Cash } from './pages/admin/Cash';
import { Reports } from './pages/admin/Reports';
import { AdminLayout } from './pages/admin/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { Bookings } from './pages/admin/Bookings';
import { Dispatch } from './pages/admin/Dispatch';
import { Vehicles } from './pages/admin/Vehicles';
import { Pricing } from './pages/admin/Pricing';
import { Drivers } from './pages/admin/Drivers';
import { Content } from './pages/admin/Content';
import { SettingsPage } from './pages/admin/SettingsPage';
import { Driver } from './pages/driver/Driver';
import { DemoBar } from './components/DemoBar';

const DEMO = import.meta.env.VITE_DEMO === '1';

/** Sayfa değişiminde başa döner; /#bolum bağlantılarında o bölüme kayar. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60);
      return () => window.clearTimeout(t);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

const Router = USE_HASH ? HashRouter : BrowserRouter;

export function App() {
  return (
    <PrefsProvider>
      <Router>
        <ScrollManager />
        {DEMO && <DemoBar />}
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="rezervasyon" element={<Booking />} />
            <Route path="takip" element={<Track />} />
            <Route path="takip/:code" element={<Track />} />
            <Route path="hesap" element={<Account />} />
            <Route path="gizlilik" element={<Privacy />} />
          </Route>
          <Route path="panel" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="sevk" element={<Dispatch />} />
            <Route path="rezervasyonlar" element={<Bookings />} />
            <Route path="araclar" element={<Vehicles />} />
            <Route path="fiyatlar" element={<Pricing />} />
            <Route path="soforler" element={<Drivers />} />
            <Route path="musteriler" element={<Customers />} />
            <Route path="kasa" element={<Cash />} />
            <Route path="raporlar" element={<Reports />} />
            <Route path="icerik" element={<Content />} />
            <Route path="ayarlar" element={<SettingsPage />} />
          </Route>
          <Route path="surucu" element={<Driver />} />
          <Route path="*" element={<SiteLayout />}>
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </Router>
    </PrefsProvider>
  );
}
