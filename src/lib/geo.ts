import type { AppState, Location, Point } from '../types';

/** İki nokta arası kuş uçuşu mesafe (km) */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Tahmini yol mesafesi (km) */
export function roadKm(s: AppState, a?: Point | null, b?: Point | null) {
  if (!a || !b) return null;
  return Math.round(haversineKm(a, b) * (s.settings.roadFactor || 1.3));
}

/** Noktanın düştüğü bölgeyi bulur (yarıçap içindeki en yakın merkez). */
export function resolveZone(s: AppState, p: { lat: number; lng: number }): Location | undefined {
  let best: Location | undefined;
  let bestD = Infinity;
  for (const l of s.locations) {
    if (l.lat == null || l.lng == null) continue;
    const d = haversineKm(p, { lat: l.lat, lng: l.lng });
    if (d <= (l.radiusKm || 0) && d < bestD) {
      best = l;
      bestD = d;
    }
  }
  return best;
}

export function locationPoint(l: Location): Point | null {
  if (l.lat == null || l.lng == null) return null;
  return { label: l.code ? `${l.name} (${l.code})` : l.name, lat: l.lat, lng: l.lng, zoneId: l.id, kind: l.kind };
}

const norm = (t: string) =>
  t
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');

/** Havalimanı ve bölgelerde (çevrimdışı) arama */
export function searchLocal(s: AppState, q: string): Point[] {
  const n = norm(q.trim());
  return s.locations
    .filter((l) => !n || norm(`${l.name} ${l.code ?? ''}`).includes(n))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'airport' ? -1 : 1))
    .map(locationPoint)
    .filter((p): p is Point => !!p);
}

/* ---------------- Uzak servis: Photon (OpenStreetMap) ---------------- */

const PHOTON = 'https://photon.komoot.io';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

function featureToPoint(f: PhotonFeature): Point {
  const p = f.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const name = p.name || street || p.district || p.city || p.county || '';
  const area = [p.district !== name ? p.district : '', p.city && p.city !== name ? p.city : p.county].filter(Boolean);
  const sub = [street !== name ? street : '', ...area].filter(Boolean).join(', ');
  const [lng, lat] = f.geometry.coordinates;
  return { label: name, sub, lat, lng, kind: 'place' };
}

let probe: Promise<boolean> | null = null;
/** Konum servisleri bu ortamda erişilebilir mi? (bir kez kontrol edilir) */
export function remoteAvailable(): Promise<boolean> {
  if (!probe) {
    probe = (async () => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(`${PHOTON}/api/?q=antalya&limit=1`, { signal: ctl.signal });
        clearTimeout(t);
        return r.ok;
      } catch {
        return false;
      }
    })();
  }
  return probe;
}

export async function searchRemote(s: AppState, q: string, signal?: AbortSignal): Promise<Point[]> {
  const { mapLat, mapLng, searchBbox } = s.settings;
  const u = new URLSearchParams({ q, limit: '8', lat: String(mapLat), lon: String(mapLng) });
  if (searchBbox) u.set('bbox', searchBbox);
  const r = await fetch(`${PHOTON}/api/?${u}`, { signal });
  if (!r.ok) throw new Error('search failed');
  const data = (await r.json()) as { features: PhotonFeature[] };
  const seen = new Set<string>();
  return data.features
    .map(featureToPoint)
    .filter((p) => {
      const k = `${p.label}|${p.sub}`;
      if (!p.label || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

export async function reverseGeocode(lat: number, lng: number): Promise<Point> {
  const fallback: Point = { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, kind: 'gps' };
  try {
    const r = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&limit=1`);
    if (!r.ok) return fallback;
    const data = (await r.json()) as { features: PhotonFeature[] };
    const f = data.features[0];
    if (!f) return fallback;
    return { ...featureToPoint(f), lat, lng, kind: 'gps' };
  } catch {
    return fallback;
  }
}

export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

/* ---------------- Bağlantılar ---------------- */

export const directionsLink = (p: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

export const mapLink = (p: { lat: number; lng: number }) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;

export const pointText = (p?: Point | null) => (p ? [p.label, p.sub].filter(Boolean).join(', ') : '');

/** URL parametresi için kısa kodlama */
export const encodePoint = (p: Point) => JSON.stringify([p.label, p.sub ?? '', +p.lat.toFixed(6), +p.lng.toFixed(6), p.zoneId ?? '', p.kind ?? '']);
export function decodePoint(v: string | null): Point | null {
  if (!v) return null;
  try {
    const [label, sub, lat, lng, zoneId, kind] = JSON.parse(v);
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return { label, sub: sub || undefined, lat, lng, zoneId: zoneId || undefined, kind: kind || undefined };
  } catch {
    return null;
  }
}
