import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addBaseLayer } from './mapTiles';
import { GOOGLE_MAP_ID, loadGoogle, usingGoogle } from '../lib/gmaps';

export interface LiveMarker {
  id: string;
  lat: number;
  lng: number;
  kind: 'car' | 'pickup' | 'drop';
  label?: string;
  heading?: number;
}

const esc = (t: string) => t.replace(/[<>&"]/g, '');

function markerHtml(m: LiveMarker) {
  const label = m.label ? `<em>${esc(m.label)}</em>` : '';
  return m.kind === 'car'
    ? `<span class="lm-carin" style="--h:${m.heading ?? 0}deg"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 5 21l7-4 7 4z"/></svg></span>${label}`
    : `<span class="lm-dot"></span>${label}`;
}

/** Harita motoru: Google veya Leaflet aynı arayüzle */
interface Engine {
  set(markers: LiveMarker[], refit: boolean): void;
  destroy(): void;
}

function leafletEngine(el: HTMLElement, center: { lat: number; lng: number }): Engine {
  const map = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([center.lat, center.lng], 11);
  addBaseLayer(map);
  setTimeout(() => map.invalidateSize(), 60);
  const layers = new Map<string, L.Marker>();
  const icon = (m: LiveMarker) => L.divIcon({ className: `lm lm-${m.kind}`, html: markerHtml(m), iconSize: [40, 40], iconAnchor: [20, 20] });
  return {
    set(markers, refit) {
      const seen = new Set<string>();
      for (const mk of markers) {
        seen.add(mk.id);
        const ex = layers.get(mk.id);
        if (ex) ex.setLatLng([mk.lat, mk.lng]).setIcon(icon(mk));
        else layers.set(mk.id, L.marker([mk.lat, mk.lng], { icon: icon(mk), keyboard: false }).addTo(map));
      }
      for (const [id, l] of layers) if (!seen.has(id)) (map.removeLayer(l), layers.delete(id));
      const inner = map.getBounds().pad(-0.1);
      if (markers.length && (refit || markers.some((x) => !inner.contains([x.lat, x.lng])))) {
        if (markers.length === 1) map.setView([markers[0].lat, markers[0].lng], 14);
        else map.fitBounds(L.latLngBounds(markers.map((x) => [x.lat, x.lng] as [number, number])), { padding: [50, 50], maxZoom: 15 });
      }
    },
    destroy: () => map.remove(),
  };
}

async function googleEngine(el: HTMLElement, center: { lat: number; lng: number }): Promise<Engine> {
  await loadGoogle(document.documentElement.lang || 'tr');
  const { Map: GMap } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
  const { AdvancedMarkerElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;
  const map = new GMap(el, { center, zoom: 11, mapId: GOOGLE_MAP_ID, disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative', clickableIcons: false });
  const markers = new Map<string, { m: google.maps.marker.AdvancedMarkerElement; el: HTMLDivElement }>();
  return {
    set(list, refit) {
      const seen = new Set<string>();
      for (const mk of list) {
        seen.add(mk.id);
        let ex = markers.get(mk.id);
        if (!ex) {
          const div = document.createElement('div');
          ex = { el: div, m: new AdvancedMarkerElement({ map, position: mk, content: div }) };
          markers.set(mk.id, ex);
        }
        ex.el.className = `lm lm-${mk.kind} glm`;
        ex.el.innerHTML = markerHtml(mk);
        ex.m.position = { lat: mk.lat, lng: mk.lng };
      }
      for (const [id, x] of markers) if (!seen.has(id)) ((x.m.map = null), markers.delete(id));
      const b = map.getBounds();
      const outside = !b || list.some((x) => !b.contains(x));
      if (list.length && (refit || outside)) {
        if (list.length === 1) {
          map.setCenter(list[0]);
          map.setZoom(14);
        } else {
          const bounds = new google.maps.LatLngBounds();
          list.forEach((x) => bounds.extend(x));
          map.fitBounds(bounds, 60);
        }
      }
    },
    destroy() {
      markers.forEach((x) => (x.m.map = null));
    },
  };
}

/** Canlı konumları gösteren harita (Google varsa Google, yoksa OpenStreetMap). */
export function LiveMap({ markers, height = 280, center }: { markers: LiveMarker[]; height?: number; center: { lat: number; lng: number } }) {
  const el = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const latest = useRef(markers);
  const fitted = useRef('');
  latest.current = markers;

  const apply = (force = false) => {
    const e = engine.current;
    if (!e) return;
    const key = latest.current.map((x) => x.id).sort().join('|');
    const refit = force || key !== fitted.current;
    fitted.current = key;
    e.set(latest.current, refit);
  };

  useEffect(() => {
    if (!el.current) return;
    let alive = true;
    const host = el.current;
    const start = (e: Engine) => {
      if (!alive) return e.destroy();
      engine.current = e;
      apply(true);
    };
    if (usingGoogle()) googleEngine(host, center).then(start, () => start(leafletEngine(host, center)));
    else start(leafletEngine(host, center));
    return () => {
      alive = false;
      engine.current?.destroy();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  return <div className="livemap" ref={el} style={{ height }} />;
}
