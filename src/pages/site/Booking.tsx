import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Baby, Loader2, UserRound, Check, CalendarDays, Luggage, Lock, MapPin, Minus, Plane, Plus, Users } from 'lucide-react';
import { AccountError, addBooking, bookingCode, customerRegister, isCustomerLoggedIn, uid, useAccount, useScope, useStore } from '../../data/store';
import { usePrefs, useT } from '../../lib/prefs';
import { dateLabel, hoursUntil, money, todayIso } from '../../lib/format';
import { fmt } from '../../lib/i18n';
import { quote } from '../../lib/pricing';
import { VehicleMedia } from '../../components/VehicleMedia';
import { LocationField, withZone } from '../../components/LocationField';
import { decodePoint, haversineKm, locationPoint, pointText } from '../../lib/geo';
import type { Booking as TBooking, PaymentMethod, Point } from '../../types';

function Stepper({ value, onChange, min = 0, max = 20, label, icon }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string; icon: React.ReactNode }) {
  return (
    <div className="stepper">
      <span className="stepper-l">{icon} {label}</span>
      <div className="stepper-c">
        <button type="button" aria-label="-" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}><Minus size={15} /></button>
        <output>{value}</output>
        <button type="button" aria-label="+" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}><Plus size={15} /></button>
      </div>
    </div>
  );
}

export function Booking() {
  const st = useStore((s) => s);
  const s = st.settings;
  const { t, tl, lang } = useT();
  const { currency } = usePrefs();
  const nav = useNavigate();
  const [qp] = useSearchParams();

  const vehicles = st.vehicles.filter((v) => v.active);
  const initPoint = (pKey: string, idKey: string, fallbackAirport: boolean): Point | null => {
    const dp = decodePoint(qp.get(pKey));
    if (dp) return withZone(dp);
    const id = qp.get(idKey);
    const l = st.locations.find((x) => x.id === id) ?? (fallbackAirport ? st.locations.find((x) => x.kind === 'airport') : undefined);
    return l ? locationPoint(l) : null;
  };
  const hasRoute = (qp.get('fp') || qp.get('from')) && (qp.get('tp') || qp.get('to') || qp.get('type') === 'hourly');
  const [step, setStep] = useState(hasRoute ? 2 : 1);
  const [err, setErr] = useState('');
  const [f, setF] = useState(() => {
    const pax = Math.max(1, Number(qp.get('pax')) || 2);
    return {
      type: (qp.get('type') === 'hourly' ? 'hourly' : 'transfer') as 'transfer' | 'hourly',
      fromPoint: initPoint('fp', 'from', true),
      toPoint: initPoint('tp', 'to', false),
      date: qp.get('date') ?? todayIso(1),
      time: qp.get('time') ?? '12:00',
      roundTrip: qp.get('ret') === '1',
      returnDate: qp.get('date') ?? todayIso(7),
      returnTime: '12:00',
      hours: Number(qp.get('hours')) || 4,
      adults: pax,
      children: 0,
      luggage: pax,
      vehicleId: qp.get('vehicle') ?? '',
      extras: {} as Record<string, number>,
      name: '',
      phone: '',
      email: '',
      flightNo: '',
      returnFlightNo: '',
      fromDetail: '',
      toDetail: '',
      nameSign: '',
      notes: '',
      payment: (Object.keys(s.payments) as PaymentMethod[]).find((k) => s.payments[k]) ?? 'cash',
      consent: false,
      createAccount: true,
      password: '',
    };
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);
  useEffect(() => {
    setErr('');
  }, [step, f.fromPoint, f.toPoint, f.vehicleId]);

  const pax = f.adults + f.children;
  const loc = (id?: string) => st.locations.find((l) => l.id === id);
  const fromId = f.fromPoint?.zoneId;
  const toId = f.type === 'transfer' ? f.toPoint?.zoneId : undefined;
  const fromLoc = loc(fromId);
  const toLoc = loc(toId);
  const geoArgs = { fromId, toId, fromPoint: f.fromPoint, toPoint: f.type === 'transfer' ? f.toPoint : null };
  const vehicle = vehicles.find((v) => v.id === f.vehicleId);
  const q = useMemo(
    () => quote(st, { ...geoArgs, type: f.type, vehicleId: f.vehicleId, roundTrip: f.roundTrip, time: f.time, returnTime: f.returnTime, hours: f.hours, extras: f.extras }),
    [st, f],
  );
  const m = (v: number) => money(v, currency, s.rates, lang);
  const airportPickup = f.fromPoint?.kind === 'airport' || fromLoc?.kind === 'airport';
  const airportReturn = f.toPoint?.kind === 'airport' || toLoc?.kind === 'airport';

  const validate = (n: number): string => {
    if (n >= 1) {
      if (!f.fromPoint || (f.type === 'transfer' && !f.toPoint)) return t('pickRoute');
      if (f.type === 'transfer' && f.toPoint && haversineKm(f.fromPoint, f.toPoint) < 0.3) return t('sameRoute');
      if (!f.date || !f.time || (f.roundTrip && (!f.returnDate || !f.returnTime))) return t('pickDate');
      if (hoursUntil(f.date, f.time) < s.minLeadHours) return fmt(t('leadTime'), { h: s.minLeadHours });
    }
    if (n >= 2) {
      if (!vehicle) return t('required');
      if (vehicle.pax < pax) return t('capacityLow');
    }
    if (n >= 3) {
      if (!f.name.trim() || f.phone.replace(/\D/g, '').length < 7 || !f.consent) return t('required');
      if (!logged && f.createAccount) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return t('accEmailReq');
        if (f.password.length < 6) return t('accPassword2');
      }
    }
    return '';
  };

  const go = (n: number) => {
    if (n > step) {
      const e = validate(step);
      if (e) return setErr(e);
    }
    setStep(n);
  };

  const [sending, setSending] = useState(false);
  const [exists, setExists] = useState(false);
  const account = useAccount();
  const logged = isCustomerLoggedIn();
  useScope(logged ? { kind: 'customer' } : { kind: 'public' });
  // Giriş yapmış müşterinin bilgilerini doldur
  useEffect(() => {
    if (account) setF((p) => ({ ...p, name: p.name || account.name, phone: p.phone || account.phone, email: p.email || account.email }));
  }, [account]);

  const submit = async () => {
    const e = validate(3);
    if (e) return setErr(e);
    if (sending) return;
    let newAccount = false;
    if (!logged && f.createAccount) {
      setSending(true);
      try {
        await customerRegister({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password });
        newAccount = true;
      } catch (x) {
        setSending(false);
        const ae = x as AccountError;
        setExists(ae.code === 'exists');
        return setErr(ae.code === 'exists' ? t('accExists') : ae.message);
      }
    }
    const now = new Date().toISOString();
    const b: TBooking = {
      id: uid('b_'),
      code: bookingCode(),
      createdAt: now,
      type: f.type,
      fromId: fromId ?? '',
      toId: f.type === 'transfer' ? toId ?? '' : undefined,
      fromPoint: f.fromPoint ?? undefined,
      toPoint: f.type === 'transfer' ? f.toPoint ?? undefined : undefined,
      distanceKm: q.km ?? undefined,
      fromDetail: f.fromDetail.trim(),
      toDetail: f.toDetail.trim(),
      date: f.date,
      time: f.time,
      roundTrip: f.type === 'transfer' && f.roundTrip,
      returnDate: f.roundTrip ? f.returnDate : undefined,
      returnTime: f.roundTrip ? f.returnTime : undefined,
      hours: f.type === 'hourly' ? f.hours : undefined,
      flightNo: f.flightNo.trim().toUpperCase(),
      returnFlightNo: f.returnFlightNo.trim().toUpperCase() || undefined,
      adults: f.adults,
      children: f.children,
      luggage: f.luggage,
      vehicleId: f.vehicleId,
      extras: Object.fromEntries(Object.entries(f.extras).filter(([, n]) => n > 0)),
      customer: { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() },
      nameSign: f.nameSign.trim() || f.name.trim(),
      notes: f.notes.trim(),
      price: q.total,
      displayCurrency: currency,
      lang,
      payment: f.payment,
      status: 'new',
      history: [{ status: 'new', at: now }],
    };
    setSending(true);
    try {
      const code = await addBooking(b);
      nav(`/takip/${code}?yeni=1${newAccount ? '&hesap=1' : ''}`);
    } catch (x) {
      setErr((x as Error).message || t('required'));
    } finally {
      setSending(false);
    }
  };

  const steps = [t('step1'), t('step2'), t('step3'), t('step4')];
  const extras = st.extras.filter((e) => e.active);
  const payments = (Object.keys(s.payments) as PaymentMethod[]).filter((k) => s.payments[k]);

  return (
    <div className="bk">
      <div className="bk-hero">
        <div className="wrap">
          <h1>{t('bkTitle')}</h1>
          <ol className="bk-steps">
            {steps.map((label, i) => (
              <li key={label} className={i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}>
                <button type="button" disabled={i + 1 > step} onClick={() => go(i + 1)}>
                  <span>{i + 1 < step ? <Check size={14} /> : i + 1}</span> {label}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="wrap bk-grid">
        <div className="bk-main">
          {step === 1 && (
            <section className="card bk-card" key="s1">
              <div className="seg">
                {(['transfer', 'hourly'] as const).map((k) => (
                  <button key={k} type="button" className={f.type === k ? 'on' : ''} onClick={() => set('type', k)}>
                    {k === 'transfer' ? t('wTransfer') : t('wHourly')}
                  </button>
                ))}
              </div>
              <div className="form-grid">
                <LocationField
                  label={<><MapPin size={14} /> {f.type === 'transfer' ? t('wFrom') : t('wPickup')}</>}
                  value={f.fromPoint}
                  onChange={(v) => set('fromPoint', v)}
                />
                {f.type === 'transfer' ? (
                  <LocationField label={<><MapPin size={14} /> {t('wTo')}</>} value={f.toPoint} onChange={(v) => set('toPoint', v)} />
                ) : (
                  <label className="fld">
                    <span>{t('wHours')}</span>
                    <select value={f.hours} onChange={(e) => set('hours', +e.target.value)}>
                      {[2, 3, 4, 5, 6, 8, 10, 12].map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                )}
                <label className="fld">
                  <span><CalendarDays size={14} /> {t('wDate')}</span>
                  <input type="date" min={todayIso()} value={f.date} onChange={(e) => set('date', e.target.value)} />
                </label>
                <label className="fld">
                  <span>{t('wTime')}</span>
                  <input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} />
                </label>
              </div>
              {f.type === 'transfer' && (
                <>
                  <label className="chk">
                    <input type="checkbox" checked={f.roundTrip} onChange={(e) => set('roundTrip', e.target.checked)} />
                    <span>
                      {t('wReturn')}
                      {s.roundTripDiscount > 0 && <em className="pill">-%{s.roundTripDiscount}</em>}
                    </span>
                  </label>
                  {f.roundTrip && (
                    <div className="form-grid">
                      <label className="fld">
                        <span>{t('returnDate')}</span>
                        <input type="date" min={f.date} value={f.returnDate} onChange={(e) => set('returnDate', e.target.value)} />
                      </label>
                      <label className="fld">
                        <span>{t('returnTime')}</span>
                        <input type="time" value={f.returnTime} onChange={(e) => set('returnTime', e.target.value)} />
                      </label>
                    </div>
                  )}
                </>
              )}
              <div className="steppers">
                <Stepper label={t('adults')} icon={<Users size={16} />} value={f.adults} min={1} max={20} onChange={(n) => set('adults', n)} />
                <Stepper label={t('children')} icon={<Baby size={16} />} value={f.children} max={10} onChange={(n) => set('children', n)} />
                <Stepper label={t('luggage')} icon={<Luggage size={16} />} value={f.luggage} max={30} onChange={(n) => set('luggage', n)} />
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="bk-vehicles" key="s2">
              {vehicles.map((v) => {
                const vq = quote(st, { ...geoArgs, type: f.type, vehicleId: v.id, roundTrip: f.roundTrip, time: f.time, returnTime: f.returnTime, hours: f.hours, extras: {} });
                const small = v.pax < pax || v.luggage < f.luggage;
                const sel = v.id === f.vehicleId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`vopt ${sel ? 'on' : ''} ${small ? 'off' : ''}`}
                    disabled={v.pax < pax}
                    onClick={() => set('vehicleId', v.id)}
                    aria-pressed={sel}
                  >
                    <VehicleMedia v={v} />
                    <div className="vopt-body">
                      <span className="vcard-cat">{tl(v.category)}</span>
                      <h3>{v.name}</h3>
                      <div className="vcard-cap">
                        <span><Users size={15} /> {v.pax}</span>
                        <span><Luggage size={15} /> {v.luggage}</span>
                      </div>
                      <p className="vopt-feat">{tl(v.features).split('\n').filter(Boolean).slice(0, 3).join(' · ')}</p>
                      {small && <span className="warn">{t('capacityLow')}</span>}
                    </div>
                    <div className="vopt-price">
                      {vq.onRequest ? <b className="sm">{t('quoteOnly')}</b> : <b>{m(vq.total)}</b>}
                      <small>{t('perVehicle')}</small>
                      <span className={`btn btn-sm ${sel ? 'btn-gold' : 'btn-outline-dark'}`}>
                        {sel ? <><Check size={15} /> {t('selected')}</> : t('select')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </section>
          )}

          {step === 3 && (
            <section className="card bk-card" key="s3">
              <h2 className="bk-h">{t('passenger')}</h2>
              <div className="form-grid">
                <label className="fld">
                  <span>{t('fullName')} *</span>
                  <input value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" required />
                </label>
                <label className="fld">
                  <span>{t('phone')} *</span>
                  <input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" placeholder="+90 5xx xxx xx xx" required />
                </label>
                <label className="fld">
                  <span>{t('email')}</span>
                  <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
                </label>
                {f.type === 'transfer' && airportPickup && (
                  <label className="fld">
                    <span><Plane size={14} /> {t('flightNo')}</span>
                    <input value={f.flightNo} onChange={(e) => set('flightNo', e.target.value)} placeholder="TK 1234" />
                    <small className="hint">{t('flightHint')}</small>
                  </label>
                )}
                <label className="fld">
                  <span>{t('addrNote')} · {f.fromPoint?.label}</span>
                  <input value={f.fromDetail} onChange={(e) => set('fromDetail', e.target.value)} placeholder={airportPickup ? 'Terminal / kapı' : ''} />
                </label>
                {f.type === 'transfer' && (
                  <label className="fld">
                    <span>{t('addrNote')} · {f.toPoint?.label}</span>
                    <input value={f.toDetail} onChange={(e) => set('toDetail', e.target.value)} />
                  </label>
                )}
                {f.roundTrip && airportReturn && (
                  <label className="fld">
                    <span><Plane size={14} /> {t('returnFlightNo')}</span>
                    <input value={f.returnFlightNo} onChange={(e) => set('returnFlightNo', e.target.value)} placeholder="TK 1235" />
                  </label>
                )}
                {airportPickup && (
                  <label className="fld">
                    <span>{t('nameSign')}</span>
                    <input value={f.nameSign} onChange={(e) => set('nameSign', e.target.value)} placeholder={f.name || 'Mr. John Smith'} />
                  </label>
                )}
              </div>

              {extras.length > 0 && (
                <>
                  <h2 className="bk-h">{t('extras')}</h2>
                  <div className="extras">
                    {extras.map((x) => (
                      <Stepper
                        key={x.id}
                        label={`${tl(x.name)} — ${x.price ? m(x.price) : t('free')}`}
                        icon={null}
                        value={f.extras[x.id] ?? 0}
                        max={x.maxQty}
                        onChange={(n) => set('extras', { ...f.extras, [x.id]: n })}
                      />
                    ))}
                  </div>
                </>
              )}

              <label className="fld">
                <span>{t('notes')}</span>
                <textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
              </label>

              {payments.length > 0 && (
                <>
                  <h2 className="bk-h">{t('payment')}</h2>
                  <div className="radios">
                    {payments.map((p) => (
                      <label key={p} className={`radio ${f.payment === p ? 'on' : ''}`}>
                        <input type="radio" name="pay" checked={f.payment === p} onChange={() => set('payment', p)} />
                        {t(`pay_${p}` as const)}
                      </label>
                    ))}
                  </div>
                </>
              )}

              {logged ? (
                <p className="note acc-note"><UserRound size={16} /> {t('accLinked')}</p>
              ) : (
                <div className="acc-create">
                  <label className="chk">
                    <input type="checkbox" checked={f.createAccount} onChange={(e) => set('createAccount', e.target.checked)} />
                    <span><b>{t('accCreateOnBook')}</b></span>
                  </label>
                  {f.createAccount && (
                    <div className="form-grid">
                      <label className="fld">
                        <span>{t('email')} *</span>
                        <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
                      </label>
                      <label className="fld">
                        <span>{t('accPassword2')} *</span>
                        <input type="password" minLength={6} value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
                      </label>
                    </div>
                  )}
                  <small className="hint">
                    {t('accHaveAccount')} <Link to="/hesap">{t('accSignInHere')}</Link>
                  </small>
                </div>
              )}

              <label className="chk">
                <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} />
                <span>{t('consent')} *</span>
              </label>
            </section>
          )}

          {step === 4 && (
            <section className="card bk-card" key="s4">
              <h2 className="bk-h">{t('summary')}</h2>
              <dl className="dl">
                <dt>{t('routeLbl')}</dt>
                <dd>
                  {pointText(f.fromPoint)}
                  {f.fromDetail && ` · ${f.fromDetail}`}
                  {f.type === 'transfer' ? <> → {pointText(f.toPoint)}{f.toDetail && ` · ${f.toDetail}`}</> : ` · ${f.hours} ${t('hoursLbl')}`}
                  {q.km != null && <> · {t('approxKm')} {q.km} km</>}
                </dd>
                <dt>{t('dateLbl')}</dt>
                <dd>
                  {dateLabel(f.date, lang)} · {f.time}
                  {f.roundTrip && <> / {t('returnPrice')}: {dateLabel(f.returnDate, lang)} · {f.returnTime}</>}
                </dd>
                <dt>{t('vehicleLbl')}</dt>
                <dd>{vehicle?.name}</dd>
                <dt>{t('guestsLbl')}</dt>
                <dd>
                  {f.adults} {t('adults').toLowerCase()}
                  {f.children > 0 && `, ${f.children} ${t('children').toLowerCase()}`} · {f.luggage} {t('bags')}
                </dd>
                <dt>{t('fullName')}</dt>
                <dd>{f.name} · {f.phone}</dd>
                {f.flightNo && (
                  <>
                    <dt>{t('flightNo')}</dt>
                    <dd>{f.flightNo.toUpperCase()}</dd>
                  </>
                )}
                <dt>{t('payment')}</dt>
                <dd>{t(`pay_${f.payment}` as const)}</dd>
              </dl>
              {q.onRequest && <p className="note">{t('quoteNote')}</p>}
            </section>
          )}

          {err && (
            <p className="err" role="alert">
              {err} {exists && <Link to="/hesap">{t('accSignInHere')} →</Link>}
            </p>
          )}

          <div className="bk-nav">
            {step > 1 ? (
              <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}>
                <ArrowLeft size={17} /> {t('back')}
              </button>
            ) : <span />}
            {step < 4 ? (
              <button type="button" className="btn btn-gold" onClick={() => go(step + 1)}>
                {t('next')} <ArrowRight size={17} />
              </button>
            ) : (
              <button type="button" className="btn btn-gold" onClick={submit} disabled={sending}>
                {sending ? <Loader2 size={16} className="spin" /> : <Lock size={16} />} {t('confirmBooking')}
              </button>
            )}
          </div>
        </div>

        <aside className="bk-side">
          <div className="card sum">
            <h3>{t('summary')}</h3>
            <div className="sum-route">
              <span><MapPin size={15} /> {f.fromPoint?.label ?? '—'}</span>
              {f.type === 'transfer' && <span><MapPin size={15} /> {f.toPoint?.label ?? '—'}</span>}
              {q.km != null && <small className="sum-km">{t('approxKm')} {q.km} km{q.byDistance ? ` · ${t('byDistance')}` : ''}</small>}
            </div>
            <p className="sum-date">
              {dateLabel(f.date, lang)} · {f.time} · {pax} {t('pax')}
            </p>
            {vehicle && (
              <div className="sum-v">
                <VehicleMedia v={vehicle} />
                <b>{vehicle.name}</b>
              </div>
            )}
            {vehicle && !q.onRequest && (
              <dl className="sum-lines">
                <dt>{t('basePrice')}</dt><dd>{m(q.base)}</dd>
                {q.ret > 0 && (<><dt>{t('returnPrice')}</dt><dd>{m(q.ret)}</dd></>)}
                {q.discount > 0 && (<><dt>{t('discount')}</dt><dd>-{m(q.discount)}</dd></>)}
                {q.night > 0 && (<><dt>{t('nightFee')}</dt><dd>{m(q.night)}</dd></>)}
                {q.extras > 0 && (<><dt>{t('extras')}</dt><dd>{m(q.extras)}</dd></>)}
              </dl>
            )}
            <div className="sum-total">
              <span>{t('total')}</span>
              <b>{!vehicle ? '—' : q.onRequest ? t('quoteOnly') : m(q.total)}</b>
            </div>
            <p className="sum-note">{t('secureNote')}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
