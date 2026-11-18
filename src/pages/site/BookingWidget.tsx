import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, CalendarDays, Clock3, MapPin, Users, Hourglass } from 'lucide-react';
import { useStore } from '../../data/store';
import { useT } from '../../lib/prefs';
import { todayIso } from '../../lib/format';
import { LocationField } from '../../components/LocationField';
import { encodePoint, locationPoint } from '../../lib/geo';
import type { Point } from '../../types';

export function BookingWidget() {
  const { t } = useT();
  const nav = useNavigate();
  const locations = useStore((s) => s.locations);
  const [type, setType] = useState<'transfer' | 'hourly'>('transfer');
  const [from, setFrom] = useState<Point | null>(() => {
    const a = locations.find((l) => l.kind === 'airport');
    return a ? locationPoint(a) : null;
  });
  const [to, setTo] = useState<Point | null>(null);
  const [date, setDate] = useState(todayIso(1));
  const [time, setTime] = useState('12:00');
  const [pax, setPax] = useState(2);
  const [hours, setHours] = useState(4);
  const [ret, setRet] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams({ type, date, time, pax: String(pax) });
    if (from) q.set('fp', encodePoint(from));
    if (type === 'transfer') {
      if (to) q.set('tp', encodePoint(to));
      if (ret) q.set('ret', '1');
    } else q.set('hours', String(hours));
    nav(`/rezervasyon?${q.toString()}`);
  };

  return (
    <form className="widget" onSubmit={submit}>
      <div className="widget-tabs" role="tablist">
        {(['transfer', 'hourly'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={type === k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>
            {k === 'transfer' ? t('wTransfer') : t('wHourly')}
          </button>
        ))}
      </div>
      <div className={`widget-grid ${type}`}>
        <LocationField
          className="fld-from"
          variant="dark"
          label={<><MapPin size={14} /> {type === 'transfer' ? t('wFrom') : t('wPickup')}</>}
          value={from}
          onChange={setFrom}
        />
        {type === 'transfer' ? (
          <>
            <button type="button" className="swap" aria-label={t('wSwap')} onClick={() => { setFrom(to); setTo(from); }}>
              <ArrowLeftRight size={16} />
            </button>
            <LocationField className="fld-to" variant="dark" label={<><MapPin size={14} /> {t('wTo')}</>} value={to} onChange={setTo} />
          </>
        ) : (
          <label className="fld fld-to">
            <span><Hourglass size={14} /> {t('wHours')}</span>
            <select value={hours} onChange={(e) => setHours(+e.target.value)}>
              {[2, 3, 4, 5, 6, 8, 10, 12].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>
        )}
        <label className="fld fld-date">
          <span><CalendarDays size={14} /> {t('wDate')}</span>
          <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="fld fld-time">
          <span><Clock3 size={14} /> {t('wTime')}</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label className="fld fld-pax">
          <span><Users size={14} /> {t('wPax')}</span>
          <select value={pax} onChange={(e) => setPax(+e.target.value)}>
            {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-gold widget-go" type="submit">
          {t('wSearch')}
        </button>
      </div>
      {type === 'transfer' && (
        <label className="chk widget-ret">
          <input type="checkbox" checked={ret} onChange={(e) => setRet(e.target.checked)} />
          <span>{t('wReturn')}</span>
        </label>
      )}
    </form>
  );
}
