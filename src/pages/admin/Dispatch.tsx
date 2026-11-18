import { ask } from '../../components/dialog';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plane, Users, Luggage } from 'lucide-react';
import { setBookingStatus, useStore } from '../../data/store';
import { dateLabel, todayIso } from '../../lib/format';
import { BookingDetail, driverConflicts, routeText } from './BookingDetail';
import { PageHead, StatusBadge, toast } from './ui';
import type { Booking } from '../../types';

const shift = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export function Dispatch() {
  const s = useStore((x) => x);
  const [day, setDay] = useState(todayIso());
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);

  const jobs = s.bookings
    .filter((b) => b.date === day && !['cancelled', 'no_show'].includes(b.status))
    .sort((a, b) => a.time.localeCompare(b.time));
  const drivers = s.drivers.filter((d) => d.active);
  const lanes = [{ id: '', name: 'Atanmamış', plate: '' }, ...drivers];

  const assign = async (bookingId: string, driverId: string) => {
    const b = s.bookings.find((x) => x.id === bookingId);
    if (!b || (b.driverId ?? '') === driverId) return;
    if (driverId && driverConflicts(s, b, driverId).length && !(await ask('Bu şoförün aynı saatlerde başka işi var. Yine de atansın mı?'))) return;
    const status = driverId ? (['new', 'confirmed'].includes(b.status) ? 'assigned' : b.status) : b.status === 'assigned' ? 'confirmed' : b.status;
    setBookingStatus(b.id, status, 'sevk', { driverId: driverId || undefined });
    toast(driverId ? `${drivers.find((d) => d.id === driverId)?.name} atandı` : 'Atama kaldırıldı');
  };

  const Card = ({ b }: { b: Booking }) => {
    const v = s.vehicles.find((x) => x.id === b.vehicleId);
    return (
      <div
        className={`job st-b-${b.status}`}
        draggable
        onDragStart={() => setDrag(b.id)}
        onDragEnd={() => setDrag(null)}
        onClick={() => setOpen(b.id)}
      >
        <div className="job-h">
          <b>{b.time}</b>
          <StatusBadge s={b.status} />
        </div>
        <span className="job-n">{b.customer.name}</span>
        <small>{routeText(s, b)}</small>
        <small className="job-m">
          {b.flightNo && <><Plane size={12} /> {b.flightNo}</>}
          <Users size={12} /> {b.adults + b.children} <Luggage size={12} /> {b.luggage} · {v?.name}
        </small>
        <select
          className="job-sel"
          value={b.driverId ?? ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => assign(b.id, e.target.value)}
          aria-label="Şoför ata"
        >
          <option value="">Şoför seç…</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
    );
  };

  return (
    <>
      <PageHead
        title="Sevk Planı"
        desc="Günün işlerini şoförlere atayın. Kartları sürükleyip bırakabilir veya listeden seçebilirsiniz."
        actions={
          <div className="daypick">
            <button className="aicon" onClick={() => setDay(shift(day, -1))} aria-label="Önceki gün"><ChevronLeft size={18} /></button>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value || todayIso())} />
            <button className="aicon" onClick={() => setDay(shift(day, 1))} aria-label="Sonraki gün"><ChevronRight size={18} /></button>
            <button className="abtn abtn-sm" onClick={() => setDay(todayIso())}>Bugün</button>
          </div>
        }
      />
      <p className="muted daylbl">{dateLabel(day, 'tr', { weekday: 'long', day: 'numeric', month: 'long' })} · {jobs.length} iş</p>
      <div className="lanes">
        {lanes.map((l) => {
          const mine = jobs.filter((b) => (b.driverId ?? '') === l.id);
          return (
            <section
              key={l.id || 'none'}
              className={`lane ${l.id ? '' : 'lane-none'} ${drag ? 'droppable' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drag && assign(drag, l.id)}
            >
              <header>
                <b>{l.name}</b>
                <small>{l.plate || `${mine.length} iş`}</small>
                {l.id && <em>{mine.length}</em>}
              </header>
              <div className="lane-body">
                {mine.length === 0 && <p className="empty sm">{l.id ? 'Boş' : 'Hepsi atanmış ✓'}</p>}
                {mine.map((b) => <Card key={b.id} b={b} />)}
              </div>
            </section>
          );
        })}
      </div>
      {open && <BookingDetail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
