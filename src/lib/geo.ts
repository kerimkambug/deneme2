import type { AppState, Location, Point } from '../types';
import { loadGoogle, usingGoogle } from './gmaps';

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
if (typeof window !== 'undefined') window.addEventListener('vip:maps-fallback', () => (probe = null));
/** Konum servisleri bu ortamda erişilebilir mi? (bir kez kontrol edilir) */
export function remoteAvailable(): Promise<boolean> {
  if (usingGoogle()) {
    return loadGoogle().then(
      () => true,
      () => false,
    );
  }
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

/* ---------------- Google Places (New) ---------------- */
let gToken: google.maps.places.AutocompleteSessionToken | null = null;
const gPreds = new Map<string, google.maps.places.PlacePrediction>();

async function searchGoogle(s: AppState, q: string, lang: string): Promise<Point[]> {
  await loadGoogle(lang);
  const { AutocompleteSuggestion, AutocompleteSessionToken } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
  gToken ??= new AutocompleteSessionToken();
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: q,
    sessionToken: gToken,
    language: lang,
    region: 'tr',
    includedRegionCodes: ['tr'],
    locationBias: { center: { lat: s.settings.mapLat, lng: s.settings.mapLng }, radius: 50000 },
  });
  return suggestions
    .map((x) => x.placePrediction)
    .filter((p): p is google.maps.places.PlacePrediction => !!p)
    .map((p) => {
      gPreds.set(p.placeId, p);
      return {
        label: p.mainText?.text || p.text.text,
        sub: p.secondaryText?.text || undefined,
        lat: NaN,
        lng: NaN,
        placeId: p.placeId,
        kind: p.types?.includes('airport') ? 'airport' : 'place',
      } as Point;
    });
}

/** Google önerisinin koordinatını çözer (seçim anında, tek istek). */
export async function resolvePoint(p: Point): Promise<Point> {
  if (!p.placeId || Number.isFinite(p.lat)) return p;
  await loadGoogle();
  const pred = gPreds.get(p.placeId);
  const { Place } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
  const place = pred ? pred.toPlace() : new Place({ id: p.placeId });
  // Yalnızca koordinat (Essentials). displayName istemek 'Pro' ücret sınıfına geçirir; ad zaten öneriden geliyor.
  await place.fetchFields({ fields: ['location', 'formattedAddress'] });
  gToken = null; // oturum seçimle kapanır
  const loc = place.location;
  if (!loc) throw new Error('Konum bulunamadı');
  return { ...p, lat: loc.lat(), lng: loc.lng(), label: p.label || place.formattedAddress?.split(',')[0] || '', sub: p.sub || place.formattedAddress || undefined };
}

async function reverseGoogle(lat: number, lng: number, lang: string): Promise<Point | null> {
  await loadGoogle(lang);
  const { Geocoder } = (await google.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary;
  const { results } = await new Geocoder().geocode({ location: { lat, lng }, language: lang });
  const r = results.find((x) => x.types.some((t) => ['establishment', 'point_of_interest', 'premise', 'street_address'].includes(t))) ?? results[0];
  if (!r) return null;
  const [first, ...rest] = r.formatted_address.split(', ');
  return { label: first, sub: rest.join(', ') || undefined, lat, lng, kind: 'gps', placeId: r.place_id };
}

const curLang = () => (typeof document !== 'undefined' ? document.documentElement.lang || 'tr' : 'tr');

export async function searchRemote(s: AppState, q: string, signal?: AbortSignal): Promise<Point[]> {
  if (usingGoogle()) {
    const r = await searchGoogle(s, q, curLang());
    if (signal?.aborted) throw new Error('aborted');
    return r;
  }
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
  if (usingGoogle()) {
    try {
      return (await reverseGoogle(lat, lng, curLang())) ?? fallback;
    } catch {
      return fallback;
    }
  }
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
