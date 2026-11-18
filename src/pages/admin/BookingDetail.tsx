import { useState } from 'react';
import { AlertTriangle, MessageCircle, Phone, Trash2, Send, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { patchBooking, setBookingStatus, update, useStore } from '../../data/store';
import { STATUS_LABEL } from '../../lib/i18n';
import { appUrl, dateLabel, eur, money, telLink, waLink } from '../../lib/format';
import type { AppState, Booking, BookingStatus } from '../../types';
import { Modal, StatusBadge, toast } from './ui';

const STATUSES = Object.keys(STATUS_LABEL) as BookingStatus[];

const toMin = (d: string, t: string) => new Date(`${d}T${t || '00:00'}`).getTime() / 60000;

/** Aynı şoförün ±(süre+60dk) aralığında başka işi var mı? */
export function driverConflicts(s: AppState, b: Booking, driverId: string) {
  const start = toMin(b.date, b.time);
  const dur = (s.routes.find((r) => (r.from === b.fromId && r.to === b.toId) || (r.to === b.fromId && r.from === b.toId))?.durationMin ?? 60) + 60;
  return s.bookings.filter((o) => {
    if (o.id === b.id || o.driverId !== driverId || ['cancelled', 'completed', 'no_show'].includes(o.status)) return false;
    const os = toMin(o.date, o.time);
    return Math.abs(os - start) < dur;
  });
}

export function locName(s: AppState, id?: string) {
  return s.locations.find((l) => l.id === id)?.name ?? '';
}

export function routeText(s: AppState, b: Booking) {
  const from = `${locName(s, b.fromId)}${b.fromDetail ? ` (${b.fromDetail})` : ''}`;
  if (b.type === 'hourly') return `${from} · ${b.hours} saat`;
  return `${from} → ${locName(s, b.toId)}${b.toDetail ? ` (${b.toDetail})` : ''}`;
}

function customerMessage(s: AppState, b: Booking) {
  const d = s.drivers.find((x) => x.id === b.driverId);
  const v = s.vehicles.find((x) => x.id === b.vehicleId);
  const price = b.price ? money(b.price, b.displayCurrency, s.settings.rates, b.lang) : '';
  const route = routeText(s, b);
  const track = appUrl(`/takip/${b.code}`);
  const T = {
    tr: [`Merhaba ${b.customer.name},`, `${s.settings.companyName} rezervasyonunuz onaylandı ✅`, `Kod: ${b.code}`, `Güzergâh: ${route}`, `Tarih: ${b.date} ${b.time}`, `Araç: ${v?.name ?? ''}`, price && `Ücret: ${price}`, d && `Şoför: ${d.name} · ${d.phone} · ${d.plate}`, `Takip: ${track}`, 'İyi yolculuklar dileriz.'],
    en: [`Hello ${b.customer.name},`, `Your ${s.settings.companyName} booking is confirmed ✅`, `Ref: ${b.code}`, `Route: ${route}`, `Date: ${b.date} ${b.time}`, `Vehicle: ${v?.name ?? ''}`, price && `Price: ${price}`, d && `Driver: ${d.name} · ${d.phone} · ${d.plate}`, `Track: ${track}`, 'Have a pleasant journey!'],
    ru: [`Здравствуйте, ${b.customer.name}!`, `Ваше бронирование в ${s.settings.companyName} подтверждено ✅`, `Код: ${b.code}`, `Маршрут: ${route}`, `Дата: ${b.date} ${b.time}`, `Автомобиль: ${v?.name ?? ''}`, price && `Стоимость: ${price}`, d && `Водитель: ${d.name} · ${d.phone} · ${d.plate}`, `Отслеживание: ${track}`, 'Приятной поездки!'],
  };
  return T[b.lang].filter(Boolean).join('\n');
}

function driverMessage(s: AppState, b: Booking) {
  const v = s.vehicles.find((x) => x.id === b.vehicleId);
  const extras = Object.entries(b.extras)
    .map(([id, n]) => `${s.extras.find((e) => e.id === id)?.name.tr ?? id} x${n}`)
    .join(', ');
  return [
    `🚘 YENİ İŞ — ${b.code}`,
    `${b.date} ${b.time}`,
    routeText(s, b),
    b.flightNo && `Uçuş: ${b.flightNo}`,
    `Müşteri: ${b.customer.name} · ${b.customer.phone}`,
    `Tabela: ${b.nameSign}`,
    `${b.adults}+${b.children} kişi · ${b.luggage} bavul · ${v?.name ?? ''}`,
    extras && `Ekstra: ${extras}`,
    b.notes && `Not: ${b.notes}`,
    `Ödeme: ${b.payment === 'cash' ? 'Nakit' : b.payment === 'card_vehicle' ? 'Araçta kart' : 'Online ödendi'}${b.price ? ` · ${eur(b.price)}` : ''}`,
  ].filter(Boolean).join('\n');
}

export function BookingDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useStore((x) => x);
  const b = s.bookings.find((x) => x.id === id);
  const [price, setPrice] = useState(String(b?.price ?? 0));
  if (!b) return null;
  const v = s.vehicles.find((x) => x.id === b.vehicleId);
  const driver = s.drivers.find((x) => x.id === b.driverId);
  const conflicts = b.driverId ? driverConflicts(s, b, b.driverId) : [];

  const assign = (driverId: string) => {
    const status: BookingStatus = driverId ? (['new', 'confirmed'].includes(b.status) ? 'assigned' : b.status) : b.status === 'assigned' ? 'confirmed' : b.status;
    setBookingStatus(b.id, status, 'panel', { driverId: driverId || undefined });
    toast(driverId ? 'Şoför atandı' : 'Şoför kaldırıldı');
  };

  return (
    <Modal
      title={`Rezervasyon ${b.code}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            className="abtn abtn-danger"
            onClick={() => {
              if (confirm('Bu rezervasyon kalıcı olarak silinsin mi?')) {
                update((x) => { x.bookings = x.bookings.filter((y) => y.id !== b.id); });
                onClose();
              }
            }}
          >
            <Trash2 size={16} /> Sil
          </button>
          <span className="grow" />
          <Link className="abtn abtn-ghost" to={`/takip/${b.code}`} target="_blank"><ExternalLink size={16} /> Müşteri takip sayfası</Link>
          <button className="abtn abtn-primary" onClick={onClose}>Tamam</button>
        </>
      }
    >
      <div className="bd">
        <div className="bd-top">
          <StatusBadge s={b.status} />
          <span className="muted">Oluşturma: {new Date(b.createdAt).toLocaleString('tr-TR')}</span>
          <span className="muted">Dil: {b.lang.toUpperCase()}</span>
        </div>

        <div className="bd-grid">
          <section>
            <h4>Transfer</h4>
            <dl className="adl">
              <dt>Tarih</dt><dd><b>{dateLabel(b.date, 'tr')} · {b.time}</b></dd>
              <dt>Güzergâh</dt><dd>{routeText(s, b)}</dd>
              {b.roundTrip && (<><dt>Dönüş</dt><dd>{dateLabel(b.returnDate!, 'tr')} · {b.returnTime}{b.returnFlightNo && ` · ✈ ${b.returnFlightNo}`}</dd></>)}
              {b.flightNo && (<><dt>Uçuş</dt><dd>✈ {b.flightNo}</dd></>)}
              <dt>Araç</dt><dd>{v?.name ?? '—'}</dd>
              <dt>Kişi / bavul</dt><dd>{b.adults} yetişkin{b.children ? `, ${b.children} çocuk` : ''} · {b.luggage} bavul</dd>
              {Object.keys(b.extras).length > 0 && (
                <><dt>Ekstralar</dt><dd>{Object.entries(b.extras).map(([k, n]) => `${s.extras.find((e) => e.id === k)?.name.tr ?? k} ×${n}`).join(', ')}</dd></>
              )}
              {b.notes && (<><dt>Not</dt><dd>{b.notes}</dd></>)}
            </dl>
          </section>
          <section>
            <h4>Müşteri</h4>
            <dl className="adl">
              <dt>Ad</dt><dd>{b.customer.name}</dd>
              <dt>Telefon</dt><dd>{b.customer.phone}</dd>
              {b.customer.email && (<><dt>E-posta</dt><dd>{b.customer.email}</dd></>)}
              <dt>Tabela</dt><dd>{b.nameSign}</dd>
              <dt>Ödeme</dt><dd>{b.payment === 'cash' ? 'Araçta nakit' : b.payment === 'card_vehicle' ? 'Araçta kart' : 'Online'}</dd>
              {b.cashCollected != null && (<><dt>Tahsil edilen</dt><dd>{eur(b.cashCollected)}</dd></>)}
            </dl>
            <div className="row-gap">
              <a className="abtn abtn-wa" href={waLink(b.customer.phone, customerMessage(s, b))} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Onay mesajı gönder</a>
              <a className="abtn abtn-ghost" href={telLink(b.customer.phone)}><Phone size={16} /> Ara</a>
            </div>
          </section>
        </div>

        <section className="bd-ops">
          <div className="afld">
            <span>Durum</span>
            <select value={b.status} onChange={(e) => setBookingStatus(b.id, e.target.value as BookingStatus, 'panel')}>
              {STATUSES.map((k) => <option key={k} value={k}>{STATUS_LABEL[k].tr}</option>)}
            </select>
          </div>
          <div className="afld">
            <span>Şoför</span>
            <select value={b.driverId ?? ''} onChange={(e) => assign(e.target.value)}>
              <option value="">— Atanmadı —</option>
              {s.drivers.filter((d) => d.active).map((d) => {
                const c = driverConflicts(s, b, d.id).length;
                return <option key={d.id} value={d.id}>{d.name} · {d.plate}{c ? ' ⚠ dolu' : ''}</option>;
              })}
            </select>
          </div>
          <div className="afld">
            <span>Ücret (EUR)</span>
            <div className="inline">
              <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
              <button className="abtn" onClick={() => { patchBooking(b.id, { price: Math.max(0, Number(price) || 0) }); toast('Ücret güncellendi'); }}>Kaydet</button>
            </div>
          </div>
        </section>

        {conflicts.length > 0 && (
          <p className="awarn">
            <AlertTriangle size={16} /> {driver?.name} aynı saatlerde başka işe atanmış: {conflicts.map((c) => `${c.code} (${c.time})`).join(', ')}
          </p>
        )}
        {driver && (
          <div className="row-gap">
            <a className="abtn abtn-wa" href={waLink(driver.phone, driverMessage(s, b))} target="_blank" rel="noopener noreferrer"><Send size={16} /> İşi şoföre WhatsApp’tan gönder</a>
          </div>
        )}

        <div className="afld wide">
          <span>İç not (müşteri görmez)</span>
          <textarea rows={2} defaultValue={b.adminNote ?? ''} onBlur={(e) => patchBooking(b.id, { adminNote: e.target.value })} />
        </div>

        <section>
          <h4>Geçmiş</h4>
          <ul className="hist">
            {b.history.map((h, i) => (
              <li key={i}><StatusBadge s={h.status} /> {new Date(h.at).toLocaleString('tr-TR')} {h.by && <small>· {h.by}</small>}</li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
