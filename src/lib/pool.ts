import type { Booking, Driver, Point, Settings } from '../types';

/**
 * İş dağıtım modu:
 * - manual: işleri yalnızca patron atar
 * - pool:   onaylı işler havuza düşer, şoförler alır; alınmayan iş alış saatine kadar havuzda kalır
 * - hybrid: işler havuza düşer; alış saatine X saat kala alınmamışsa havuzdan çıkar ve patron atar
 */
export type DispatchMode = 'manual' | 'pool' | 'hybrid';

/** Şoförün havuzda gördüğü iş (müşteri bilgisi yok) */
export interface PoolItem {
  id: string;
  code: string;
  type: Booking['type'];
  date: string;
  time: string;
  from: string;
  to: string;
  fromPoint?: Point;
  toPoint?: Point;
  distanceKm?: number;
  hours?: number;
  roundTrip: boolean;
  returnDate?: string;
  returnTime?: string;
  flightNo: string;
  adults: number;
  children: number;
  luggage: number;
  vehicleId: string;
  extras: Record<string, number>;
  price: number;
  payment: Booking['payment'];
  /** Havuzdan çıkacağı an (ISO) */
  until: string;
}

type PoolSettings = Pick<Settings, 'dispatchMode' | 'poolCutoffHours' | 'poolSkipConfirm'>;

/** Alış zamanı (Türkiye saati, UTC+3) */
export const pickupMs = (b: Pick<Booking, 'date' | 'time'>) => Date.parse(`${b.date}T${b.time || '00:00'}:00+03:00`);

const cutoffMs = (s: PoolSettings, b: Booking) => pickupMs(b) - Math.max(0, Number(s.poolCutoffHours) || 0) * 3600e3;

/** Havuza girebilecek durumda mı (atanmamış, onaylı, fiyatı belli, patron saklamamış) */
function candidate(s: PoolSettings, b: Booking) {
  if (!s.dispatchMode || s.dispatchMode === 'manual' || b.driverId || b.poolOff || !(b.price > 0)) return false;
  return b.status === 'confirmed' || (s.poolSkipConfirm && b.status === 'new');
}

/** İş şu an havuzda mı? */
export function poolOpen(s: PoolSettings, b: Booking, now = Date.now()) {
  if (!candidate(s, b)) return false;
  return now < (s.dispatchMode === 'hybrid' ? cutoffMs(s, b) : pickupMs(b));
}

/** Havuzdan çıkış zamanı */
export const poolUntil = (s: PoolSettings, b: Booking) => (s.dispatchMode === 'hybrid' ? cutoffMs(s, b) : pickupMs(b));

/** Süresi geldiği halde kimse almadı: patron ataması gerekiyor */
export function needsPatron(s: PoolSettings, b: Booking, now = Date.now()) {
  return candidate(s, b) && now >= cutoffMs(s, b) && now < pickupMs(b) + 3600e3;
}

/** Şoför bu işi alabilir mi (aracı uygun mu) */
export const eligible = (d: Pick<Driver, 'vehicleId' | 'active'>, b: Pick<Booking, 'vehicleId'>) => d.active && (!d.vehicleId || d.vehicleId === b.vehicleId);

export function toPoolItem(s: PoolSettings, b: Booking, from: string, to: string): PoolItem {
  return {
    id: b.id,
    code: b.code,
    type: b.type,
    date: b.date,
    time: b.time,
    from,
    to,
    fromPoint: b.fromPoint,
    toPoint: b.toPoint,
    distanceKm: b.distanceKm,
    hours: b.hours,
    roundTrip: b.roundTrip,
    returnDate: b.returnDate,
    returnTime: b.returnTime,
    flightNo: b.flightNo,
    adults: b.adults,
    children: b.children,
    luggage: b.luggage,
    vehicleId: b.vehicleId,
    extras: b.extras,
    price: b.price,
    payment: b.payment,
    until: new Date(poolUntil(s, b)).toISOString(),
  };
}
