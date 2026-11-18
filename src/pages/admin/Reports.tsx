import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useStore } from '../../data/store';
import { eur, todayIso } from '../../lib/format';
import { pointText } from '../../lib/geo';
import { STATUS_LABEL } from '../../lib/i18n';
import type { AppState, Booking } from '../../types';
import { PageHead } from './ui';

const shift = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(y, m - 1, d + days);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

function ranges() {
  const t = todayIso();
  const [y, m] = t.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const prevEnd = shift(first, -1);
  const prevFirst = `${prevEnd.slice(0, 7)}-01`;
  return [
    { k: 'month', l: 'Bu ay', from: first, to: shift(`${m === 12 ? y + 1 : y}-${String((m % 12) + 1).padStart(2, '0')}-01`, -1) },
    { k: 'prev', l: 'Geçen ay', from: prevFirst, to: prevEnd },
    { k: '30', l: 'Son 30 gün', from: shift(t, -29), to: t },
    { k: 'year', l: 'Bu yıl', from: `${y}-01-01`, to: `${y}-12-31` },
  ];
}

const place = (s: AppState, p: Booking['fromPoint'], id?: string) => pointText(p) || s.locations.find((l) => l.id === id)?.name || '';

/** CSV indir (Excel'de Türkçe karakterler için BOM ve ; ayırıcı) */
function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const t = String(v ?? '');
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Breakdown({ title, rows, total }: { title: string; rows: { k: string; n: number; v: number }[]; total: number }) {
  return (
    <section className="apanel">
      <div className="apanel-h"><h3>{title}</h3></div>
      {rows.length === 0 && <p className="empty sm">Veri yok</p>}
      <table className="rtable">
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td>{r.k}</td>
              <td className="num">{r.n}</td>
              <td className="num">{eur(r.v)}</td>
              <td className="num muted">{total ? Math.round((r.v / total) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Reports() {
  const s = useStore((x) => x);
  const R = ranges();
  const [from, setFrom] = useState(R[0].from);
  const [to, setTo] = useState(R[0].to);

  const data = useMemo(() => {
    const inRange = s.bookings.filter((b) => b.date >= from && b.date <= to);
    const done = inRange.filter((b) => b.status === 'completed');
    const revenue = done.reduce((a, b) => a + (b.price || 0), 0);
    const lost = inRange.filter((b) => b.status === 'cancelled' || b.status === 'no_show').length;
    const rated = done.filter((b) => b.review);
    const group = (key: (b: Booking) => string) => {
      const m = new Map<string, { n: number; v: number }>();
      for (const b of done) {
        const k = key(b) || '—';
        const x = m.get(k) ?? { n: 0, v: 0 };
        x.n += 1;
        x.v += b.price || 0;
        m.set(k, x);
      }
      return [...m.entries()].map(([k, x]) => ({ k, ...x })).sort((a, b) => b.v - a.v);
    };
    return {
      inRange,
      done,
      revenue,
      avg: done.length ? revenue / done.length : 0,
      lostPct: inRange.length ? Math.round((lost / inRange.length) * 100) : 0,
      rating: rated.length ? (rated.reduce((a, b) => a + b.review!.rating, 0) / rated.length).toFixed(1) : '—',
      online: done.filter((b) => b.customerId).length,
      byDriver: group((b) => s.drivers.find((d) => d.id === b.driverId)?.name ?? 'Atanmamış'),
      byRoute: group((b) => `${s.locations.find((l) => l.id === b.fromId)?.name ?? 'Bölge dışı'} → ${b.type === 'hourly' ? 'Saatlik' : s.locations.find((l) => l.id === b.toId)?.name ?? 'Bölge dışı'}`).slice(0, 10),
      byVehicle: group((b) => s.vehicles.find((v) => v.id === b.vehicleId)?.name ?? ''),
      byLang: group((b) => ({ tr: 'Türkçe', en: 'İngilizce', ru: 'Rusça', de: 'Almanca', pl: 'Lehçe' } as Record<string, string>)[b.lang] ?? b.lang),
    };
  }, [s, from, to]);

  const exportTrips = () => {
    const list = data.inRange.filter((b) => !['cancelled'].includes(b.status)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    downloadCsv(`sefer-listesi_${from}_${to}.csv`, [
      ['Tarih', 'Saat', 'Plaka', 'Şoför', 'Şoför tel', 'Kalkış', 'Varış', 'Yetişkin', 'Çocuk', 'Yolcu (sorumlu)', 'Yolcu tel', 'Uçuş', 'Rezervasyon', 'Durum'],
      ...list.map((b) => {
        const d = s.drivers.find((x) => x.id === b.driverId);
        return [b.date, b.time, d?.plate ?? '', d?.name ?? '', d?.phone ?? '', place(s, b.fromPoint, b.fromId), b.type === 'hourly' ? `Saatlik ${b.hours} sa` : place(s, b.toPoint, b.toId), b.adults, b.children, b.customer.name, b.customer.phone, b.flightNo, b.code, STATUS_LABEL[b.status].tr];
      }),
    ]);
  };

  const exportAll = () => {
    downloadCsv(`rezervasyonlar_${from}_${to}.csv`, [
      ['Kod', 'Oluşturma', 'Tarih', 'Saat', 'Müşteri', 'Telefon', 'E-posta', 'Kalkış', 'Varış', 'Araç', 'Şoför', 'Kişi', 'Bavul', 'Ödeme', 'Ücret (EUR)', 'Tahsilat (EUR)', 'İndirim kodu', 'Durum', 'Puan', 'Yorum'],
      ...data.inRange.map((b) => [
        b.code, b.createdAt.slice(0, 10), b.date, b.time, b.customer.name, b.customer.phone, b.customer.email,
        place(s, b.fromPoint, b.fromId), b.type === 'hourly' ? `Saatlik ${b.hours} sa` : place(s, b.toPoint, b.toId),
        s.vehicles.find((v) => v.id === b.vehicleId)?.name ?? '', s.drivers.find((d) => d.id === b.driverId)?.name ?? '',
        b.adults + b.children, b.luggage, b.payment, b.price, b.cashCollected ?? '', b.promoCode ?? '', STATUS_LABEL[b.status].tr, b.review?.rating ?? '', b.review?.text ?? '',
      ]),
    ]);
  };

  return (
    <>
      <PageHead
        title="Raporlar"
        desc="Ciro ve iş dağılımı (tamamlanan transferler üzerinden). Listeleri Excel'de açılabilir CSV olarak indirin."
        actions={
          <div className="row-gap">
            <button className="abtn" onClick={exportTrips}><FileSpreadsheet size={16} /> Sefer listesi (U-ETDS)</button>
            <button className="abtn" onClick={exportAll}><Download size={16} /> Tüm rezervasyonlar</button>
          </div>
        }
      />
      <div className="toolbar">
        <div className="tabs">
          {R.map((r) => (
            <button key={r.k} className={from === r.from && to === r.to ? 'on' : ''} onClick={() => { setFrom(r.from); setTo(r.to); }}>{r.l}</button>
          ))}
        </div>
        <div className="inline">
          <input type="date" className="month-in" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Başlangıç" />
          <span className="muted">–</span>
          <input type="date" className="month-in" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Bitiş" />
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Tamamlanan transfer</span><b>{data.done.length}</b></div>
        <div className="kpi"><span>Ciro</span><b>{eur(data.revenue)}</b></div>
        <div className="kpi"><span>Ortalama ücret</span><b>{eur(data.avg)}</b></div>
        <div className="kpi"><span>İptal / gelmedi</span><b>%{data.lostPct}</b></div>
        <div className="kpi"><span>Ortalama puan</span><b>{data.rating} ★</b></div>
        <div className="kpi"><span>Üye müşteri işi</span><b>{data.online}</b></div>
      </div>
      <div className="report-grid">
        <Breakdown title="Şoförlere göre" rows={data.byDriver} total={data.revenue} />
        <Breakdown title="Güzergâhlara göre (ilk 10)" rows={data.byRoute} total={data.revenue} />
        <Breakdown title="Araç tiplerine göre" rows={data.byVehicle} total={data.revenue} />
        <Breakdown title="Müşteri diline göre" rows={data.byLang} total={data.revenue} />
      </div>
      <p className="muted small">U-ETDS bildirimi için tüm yolcuların kimlik/pasaport bilgisi gerekir; bu liste sorumlu yolcu ve kişi sayısını içerir. Ayrıntı için TODO listesine bakın.</p>
    </>
  );
}
