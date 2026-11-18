import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addBaseLayer } from './mapTiles';

export interface LiveMarker {
  id: string;
  lat: number;
  lng: number;
  kind: 'car' | 'pickup' | 'drop';
  label?: string;
  heading?: number;
}

const icon = (m: LiveMarker) =>
  L.divIcon({
    className: `lm lm-${m.kind}`,
    html:
      m.kind === 'car'
        ? `<span class="lm-carin" style="--h:${m.heading ?? 0}deg"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 5 21l7-4 7 4z"/></svg></span>${m.label ? `<em>${m.label.replace(/</g, '')}</em>` : ''}`
        : `<span class="lm-dot"></span>${m.label ? `<em>${m.label.replace(/</g, '')}</em>` : ''}`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

/** Canlı konumları gösteren hafif harita. İşaretçiler yumuşakça yer değiştirir. */
export function LiveMap({ markers, height = 280, center }: { markers: LiveMarker[]; height?: number; center: { lat: number; lng: number } }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef(new Map<string, L.Marker>());
  const fitted = useRef('');

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([center.lat, center.lng], 11);
    addBaseLayer(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 60);
    return () => {
      m.remove();
      map.current = null;
      layers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const mk of markers) {
      seen.add(mk.id);
      const ex = layers.current.get(mk.id);
      if (ex) {
        ex.setLatLng([mk.lat, mk.lng]);
        ex.setIcon(icon(mk));
      } else {
        layers.current.set(mk.id, L.marker([mk.lat, mk.lng], { icon: icon(mk), keyboard: false }).addTo(m));
      }
    }
    for (const [id, l] of layers.current) {
      if (!seen.has(id)) {
        m.removeLayer(l);
        layers.current.delete(id);
      }
    }
    // İşaretçi kümesi değişince görünümü sığdır
    const key = markers.map((x) => x.id).sort().join('|');
    // Bir işaretçi görünür alanın dışına çıktıysa yeniden sığdır
    const inner = m.getBounds().pad(-0.1);
    const outside = markers.some((x) => !inner.contains([x.lat, x.lng]));
    if (markers.length && (key !== fitted.current || outside)) {
      fitted.current = key;
      if (markers.length === 1) m.setView([markers[0].lat, markers[0].lng], 14);
      else m.fitBounds(L.latLngBounds(markers.map((x) => [x.lat, x.lng] as [number, number])), { padding: [50, 50], maxZoom: 15 });
    }
  }, [markers]);

  return <div className="livemap" ref={el} style={{ height }} />;
}
