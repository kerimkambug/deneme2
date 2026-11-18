import type { AppState, RoutePrice } from '../types';

export function findRoute(s: AppState, from?: string, to?: string): RoutePrice | undefined {
  if (!from || !to) return undefined;
  return s.routes.find((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from));
}

export function routePrice(s: AppState, from: string | undefined, to: string | undefined, vehicleId: string): number | null {
  const r = findRoute(s, from, to);
  const p = r?.prices[vehicleId];
  return p && p > 0 ? p : null;
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function isNight(s: AppState, time?: string) {
  if (!time || !s.settings.nightSurcharge) return false;
  const t = toMin(time);
  const a = toMin(s.settings.nightStart);
  const b = toMin(s.settings.nightEnd);
  return a <= b ? t >= a && t < b : t >= a || t < b;
}

export interface QuoteInput {
  type: 'transfer' | 'hourly';
  fromId?: string;
  toId?: string;
  vehicleId: string;
  roundTrip: boolean;
  time?: string;
  returnTime?: string;
  hours?: number;
  extras: Record<string, number>;
}

export interface Quote {
  base: number;
  ret: number;
  discount: number;
  night: number;
  extras: number;
  total: number;
  onRequest: boolean;
}

export function quote(s: AppState, q: QuoteInput): Quote {
  const v = s.vehicles.find((x) => x.id === q.vehicleId);
  let base = 0;
  let onRequest = false;
  if (q.type === 'hourly') {
    base = (v?.hourlyRate ?? 0) * Math.max(1, q.hours ?? 1);
    onRequest = !base;
  } else {
    const p = routePrice(s, q.fromId, q.toId, q.vehicleId);
    if (p == null) onRequest = true;
    else base = p;
  }
  const ret = q.type === 'transfer' && q.roundTrip && !onRequest ? base : 0;
  const discount = ret ? Math.round(((base + ret) * s.settings.roundTripDiscount) / 100) : 0;
  const pct = s.settings.nightSurcharge / 100;
  const night = onRequest
    ? 0
    : Math.round((isNight(s, q.time) ? base * pct : 0) + (ret && isNight(s, q.returnTime) ? ret * pct : 0));
  const extras = s.extras
    .filter((e) => e.active)
    .reduce((sum, e) => sum + (q.extras[e.id] ?? 0) * e.price * (ret ? 2 : 1), 0);
  const total = onRequest ? 0 : base + ret - discount + night + extras;
  return { base, ret, discount, night, extras, total, onRequest };
}

/** Bir araç için en düşük tek yön fiyat (vitrin için) */
export function minPrice(s: AppState, vehicleId: string) {
  const ps = s.routes.map((r) => r.prices[vehicleId]).filter((p): p is number => !!p && p > 0);
  return ps.length ? Math.min(...ps) : null;
}
