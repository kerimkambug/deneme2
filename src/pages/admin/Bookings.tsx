import { useMemo, useState } from 'react';
import { Search, Plane } from 'lucide-react';
import { useStore } from '../../data/store';
import { dateLabel, eur, todayIso } from '../../lib/format';
import { BookingDetail, routeText } from './BookingDetail';
import { PageHead, StatusBadge } from './ui';
import type { Booking } from '../../types';

const TABS: { id: string; label: string; f: (b: Booking, t: string) => boolean }[] = [
  { id: 'new', label: 'Onay bekleyen', f: (b) => b.status === 'new' },
  { id: 'today', label: 'Bugün', f: (b, t) => b.date === t },
  { id: 'upcoming', label: 'Yaklaşan', f: (b, t) => b.date >= t && !['completed', 'cancelled', 'no_show'].includes(b.status) },
  { id: 'done', label: 'Tamamlanan', f: (b) => b.status === 'completed' },
  { id: 'cancel', label: 'İptal / gelmedi', f: (b) => b.status === 'cancelled' || b.status === 'no_show' },
  { id: 'all', label: 'Tümü', f: () => true },
];

export function Bookings() {
  const s = useStore((x) => x);
  const [tab, setTab] = useState('upcoming');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const today = todayIso();

  const list = useMemo(() => {
    const f = TABS.find((x) => x.id === tab)!.f;
    const ql = q.trim().toLowerCase();
    return s.bookings
      .filter((b) => f(b, today))
      .filter((b) => !ql || [b.code, b.customer.name, b.customer.phone, b.flightNo, b.fromDetail, b.toDetail].join(' ').toLowerCase().includes(ql))
      .sort((a, b) => (tab === 'done' || tab === 'all' ? -1 : 1) * `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }, [s.bookings, tab, q, today]);

  return (
    <>
      <PageHead title="Rezervasyonlar" desc="Tüm talepleri buradan onaylayın, şoför atayın ve müşteriye bilgi gönderin." />
      <div className="toolbar">
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label} <em>{s.bookings.filter((b) => t.f(b, today)).length}</em>
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input placeholder="Kod, isim, telefon, uçuş…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="atable">
        <div className="atr ath">
          <span>Tarih</span><span>Müşteri</span><span>Güzergâh</span><span>Araç / Şoför</span><span>Ücret</span><span>Durum</span>
        </div>
        {list.length === 0 && <p className="empty">Kayıt bulunamadı.</p>}
        {list.map((b) => {
          const v = s.vehicles.find((x) => x.id === b.vehicleId);
          const d = s.drivers.find((x) => x.id === b.driverId);
          return (
            <button key={b.id} className="atr" onClick={() => setOpen(b.id)}>
              <span className="c-date"><b>{dateLabel(b.date, 'tr', { day: 'numeric', month: 'short' })}</b> {b.time}</span>
              <span className="c-cust"><b>{b.customer.name}</b><small>{b.code}{b.flightNo && <> · <Plane size={11} /> {b.flightNo}</>}</small></span>
              <span className="c-route">{routeText(s, b)}{b.roundTrip && <em className="pill">↩ Dönüşlü</em>}</span>
              <span className="c-veh">{v?.name}<small>{d ? d.name : <em className="tx-warn">Şoför yok</em>}</small></span>
              <span className="c-price">{b.price ? eur(b.price) : <em className="tx-warn">Teklif</em>}</span>
              <span className="c-st"><StatusBadge s={b.status} /></span>
            </button>
          );
        })}
      </div>
      {open && <BookingDetail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
