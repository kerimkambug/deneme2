import { expiringDocs } from './Fleet';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, Inbox, TrendingUp, Wallet, ArrowRight, Plane } from 'lucide-react';
import { authedPost, useStore } from '../../data/store';
import { dateLabel, eur, todayIso } from '../../lib/format';
import { BookingDetail, routeText } from './BookingDetail';
import { LiveMap } from '../../components/LiveMap';
import { PushBar } from '../../components/PushBar';
import { toast } from './ui';
import { PageHead, StatusBadge } from './ui';

export function Dashboard() {
  const s = useStore((x) => x);
  const [open, setOpen] = useState<string | null>(null);
  const today = todayIso();
  const tomorrow = todayIso(1);
  const live = s.bookings.filter((b) => !['cancelled', 'no_show'].includes(b.status));
  const todays = live.filter((b) => b.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const newOnes = s.bookings.filter((b) => b.status === 'new');
  const unassigned = live.filter((b) => !b.driverId && b.date >= today && b.date <= tomorrow && b.status !== 'completed');
  const month = today.slice(0, 7);
  const revenue = live.filter((b) => b.date.startsWith(month)).reduce((a, b) => a + (b.price || 0), 0);
  const cash = s.bookings.filter((b) => b.date === today).reduce((a, b) => a + (b.cashCollected ?? 0), 0);

  const liveMarkers = Object.entries(s.live)
    .filter(([, l]) => Date.now() - Date.parse(l.at) < 3 * 60e3)
    .map(([id, l]) => ({ id, kind: 'car' as const, lat: l.lat, lng: l.lng, heading: l.heading, label: s.drivers.find((d) => d.id === id)?.name.split(' ')[0] }));
  const docs = expiringDocs(s.fleet);
  const kpis = [
    { icon: CalendarCheck, label: 'Bugünkü transfer', value: todays.length },
    { icon: Inbox, label: 'Onay bekleyen', value: newOnes.length, warn: newOnes.length > 0 },
    { icon: TrendingUp, label: 'Bu ay ciro', value: eur(revenue) },
    { icon: Wallet, label: 'Bugün tahsil edilen', value: eur(cash) },
  ];

  return (
    <>
      <PageHead title="Günaydın 👋" desc={`${dateLabel(today, 'tr', { weekday: 'long', day: 'numeric', month: 'long' })} · işler tek ekranda`} actions={<Link className="abtn abtn-primary" to="/rezervasyon" target="_blank">+ Telefon rezervasyonu</Link>} />
      <PushBar role="admin" onTest={() => authedPost('admin', '/api/admin/push/test', {}).then(() => toast('Test bildirimi gönderildi'))} />
      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`kpi ${k.warn ? 'kpi-warn' : ''}`}>
            <k.icon size={20} strokeWidth={1.6} />
            <span>{k.label}</span>
            <b>{k.value}</b>
          </div>
        ))}
      </div>

      {docs.length > 0 && (
        <div className="awarn big">
          <AlertTriangle size={18} />
          <span><b>Evrak uyarısı:</b> {docs.slice(0, 3).map((d) => `${d.plate} ${d.doc} ${d.days < 0 ? `(${-d.days} gün geçti)` : `(${d.days} gün)`}`).join(' · ')}{docs.length > 3 ? ` +${docs.length - 3}` : ''}</span>
          <Link to="/panel/araclar" className="abtn abtn-sm">Araçlar <ArrowRight size={14} /></Link>
        </div>
      )}
      {unassigned.length > 0 && (
        <div className="awarn big">
          <AlertTriangle size={18} />
          <span><b>{unassigned.length} transfer</b> için bugün/yarın henüz şoför atanmadı.</span>
          <Link to="/panel/sevk" className="abtn abtn-sm">Sevk planına git <ArrowRight size={14} /></Link>
        </div>
      )}

      <div className="dash-grid">
        <section className="apanel">
          <div className="apanel-h"><h3>Bugünün akışı</h3><Link to="/panel/sevk">Tümü</Link></div>
          {todays.length === 0 && <p className="empty">Bugün için transfer yok.</p>}
          <ul className="flow">
            {todays.map((b) => {
              const d = s.drivers.find((x) => x.id === b.driverId);
              return (
                <li key={b.id} onClick={() => setOpen(b.id)}>
                  <span className="flow-t">{b.time}</span>
                  <div className="flow-b">
                    <b>{b.customer.name}</b>
                    <small>{routeText(s, b)}</small>
                    <small>{b.flightNo && <><Plane size={12} /> {b.flightNo} · </>}{d ? d.name : <em className="tx-warn">Şoför yok</em>}</small>
                  </div>
                  <StatusBadge s={b.status} />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="apanel">
          <div className="apanel-h"><h3>Yeni talepler</h3><Link to="/panel/rezervasyonlar">Tümü</Link></div>
          {newOnes.length === 0 && <p className="empty">Bekleyen talep yok. 🎉</p>}
          <ul className="flow">
            {newOnes.slice(0, 6).map((b) => (
              <li key={b.id} onClick={() => setOpen(b.id)}>
                <span className="flow-t sm">{dateLabel(b.date, 'tr', { day: 'numeric', month: 'short' })}<br />{b.time}</span>
                <div className="flow-b">
                  <b>{b.customer.name}</b>
                  <small>{routeText(s, b)}</small>
                  <small>{s.vehicles.find((v) => v.id === b.vehicleId)?.name} · {b.price ? eur(b.price) : 'Fiyat teklifi'}</small>
                </div>
                <span className="abtn abtn-sm">İncele</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="apanel">
          <div className="apanel-h"><h3>Şoförler şu an</h3><Link to="/panel/soforler">Yönet</Link></div>
          {liveMarkers.length > 0 && (
            <div className="dash-map">
              <LiveMap center={liveMarkers[0]} markers={liveMarkers} height={300} />
            </div>
          )}
          <ul className="drv-live">
            {s.drivers.filter((d) => d.active).map((d) => {
              const cur = todays.find((b) => b.driverId === d.id && ['on_way', 'arrived', 'onboard'].includes(b.status));
              const next = todays.find((b) => b.driverId === d.id && ['assigned', 'confirmed'].includes(b.status));
              return (
                <li key={d.id}>
                  <span className={`dot-live ${cur ? 'busy' : 'free'}`} />
                  {s.live[d.id] && <span className="pill" title="Canlı konum paylaşıyor">● Canlı</span>}
                  <div>
                    <b>{d.name}</b>
                    <small>{d.plate}</small>
                  </div>
                  <small className="drv-state">
                    {cur ? <><StatusBadge s={cur.status} /> {cur.customer.name}</> : next ? `Sıradaki: ${next.time}` : 'Müsait'}
                  </small>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      {open && <BookingDetail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
