import { useState } from 'react';
import { Baby, Hand, Loader2, Luggage, Plane, Users, Clock } from 'lucide-react';
import { ask, notify } from '../../components/dialog';
import { REMOTE, claimPool, useStore } from '../../data/store';
import { dateLabel, eur } from '../../lib/format';
import { pointText } from '../../lib/geo';
import { eligible, poolOpen, toPoolItem, type PoolItem } from '../../lib/pool';
import type { AppState, Driver } from '../../types';

/** Şoförün görebildiği havuz işleri (sunucu modunda sunucudan, demoda yerelden) */
export function usePool(me: Driver | undefined): PoolItem[] {
  const s = useStore((x) => x);
  if (!me || s.settings.dispatchMode === 'manual' || !s.settings.dispatchMode) return [];
  if (REMOTE) return s.pool ?? [];
  const loc = (id?: string) => s.locations.find((l) => l.id === id)?.name ?? '';
  return s.bookings
    .filter((b) => poolOpen(s.settings, b) && eligible(me, b))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .map((b) => toPoolItem(s.settings, b, pointText(b.fromPoint) || loc(b.fromId), b.type === 'hourly' ? `${b.hours} saat` : pointText(b.toPoint) || loc(b.toId)));
}

const left = (iso: string) => {
  const m = Math.round((Date.parse(iso) - Date.now()) / 60000);
  if (m < 60) return `${Math.max(0, m)} dk`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} sa ${m % 60 ? `${m % 60} dk` : ''}`.trim();
  return `${Math.floor(m / 1440)} gün`;
};

/** Aynı saatlerde zaten işi var mı (uyarı için) */
function busy(s: AppState, me: Driver, p: PoolItem) {
  const at = Date.parse(`${p.date}T${p.time}:00+03:00`);
  return s.bookings.some((b) => b.driverId === me.id && !['cancelled', 'completed', 'no_show'].includes(b.status) && Math.abs(Date.parse(`${b.date}T${b.time}:00+03:00`) - at) < 2 * 3600e3);
}

export function PoolList({ me, items }: { me: Driver; items: PoolItem[] }) {
  const s = useStore((x) => x);
  const [taking, setTaking] = useState<string | null>(null);
  const mode = s.settings.dispatchMode;

  const take = async (p: PoolItem) => {
    const warn = busy(s, me, p) ? '\n\n⚠ Bu saatlere yakın başka bir işiniz var.' : '';
    if (!(await ask(`${dateLabel(p.date, 'tr')} ${p.time}\n${p.from} → ${p.to}${warn}\n\nBu işi almak istiyor musunuz?`, { title: 'İşi al', okText: 'İşi al' }))) return;
    setTaking(p.id);
    const err = await claimPool(me.id, p.id);
    setTaking(null);
    if (err) notify(err);
    else notify('İş size geçti. “Sonraki” veya ilgili gün sekmesinde görebilirsiniz.', 'İş alındı');
  };

  return (
    <div className="drv-list">
      <p className="drv-pool-info">
        {mode === 'hybrid'
          ? `Atanmamış işler. İlk alan şoföre geçer. Alış saatine ${s.settings.poolCutoffHours} saat kala alınmamış işleri ofis atar.`
          : 'Atanmamış işler. İlk alan şoföre geçer.'}
      </p>
      {items.length === 0 && <p className="empty">Şu an havuzda iş yok. Yeni iş düştüğünde bildirim gelir.</p>}
      {items.map((p) => {
        const v = s.vehicles.find((x) => x.id === p.vehicleId);
        const extras = Object.entries(p.extras).map(([id, n]) => `${s.extras.find((e) => e.id === id)?.name.tr ?? id} ×${n}`);
        return (
          <article key={p.id} className="djob pool-job">
            <div className="djob-h">
              <span className="djob-time">{p.time}</span>
              <span className="djob-main">
                <b>{p.from} → {p.to}</b>
                <small>
                  {dateLabel(p.date, 'tr', { weekday: 'short', day: 'numeric', month: 'short' })} · <Users size={12} /> {p.adults + p.children} · <Luggage size={12} /> {p.luggage}
                  {p.distanceKm ? ` · ~${p.distanceKm} km` : ''}
                </small>
              </span>
              <span className="pool-price">{eur(p.price)}</span>
            </div>
            <div className="pool-meta">
              <span>{v?.name}</span>
              {p.flightNo && <span><Plane size={13} /> {p.flightNo}</span>}
              {p.roundTrip && <span>Gidiş-dönüş{p.returnDate ? ` · ${dateLabel(p.returnDate, 'tr')} ${p.returnTime ?? ''}` : ''}</span>}
              {extras.length > 0 && <span><Baby size={13} /> {extras.join(', ')}</span>}
              <span>{p.payment === 'cash' ? 'Nakit' : p.payment === 'card_vehicle' ? 'Kart (POS)' : 'Ödendi'}</span>
              <span className="muted"><Clock size={13} /> havuzda {left(p.until)}</span>
            </div>
            <button className="drv-big" disabled={!!taking} onClick={() => take(p)}>
              {taking === p.id ? <Loader2 size={20} className="spin" /> : <Hand size={20} />} İşi al
            </button>
          </article>
        );
      })}
    </div>
  );
}
