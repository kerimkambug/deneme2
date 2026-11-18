import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Loader2, X } from 'lucide-react';
import { getState } from '../data/store';
import { useT } from '../lib/prefs';
import { reverseGeocode } from '../lib/geo';
import type { Point } from '../types';
import { addBaseLayer } from './mapTiles';
import { GOOGLE_MAP_ID, loadGoogle, usingGoogle } from '../lib/gmaps';

const pinIcon = L.divIcon({
  className: 'map-pin',
  html: '<span></span>',
  iconSize: [34, 44],
  iconAnchor: [17, 42],
});

/** Haritadan konum seçme penceresi (Google Haritalar veya OpenStreetMap) */
export function MapPicker({ initial, onPick, onClose }: { initial: Point | null; onPick: (p: Point) => void; onClose: () => void }) {
  const { t } = useT();
  const el = useRef<HTMLDivElement>(null);
  const [pt, setPt] = useState<Point | null>(initial);
  const [busy, setBusy] = useState(false);

  const place = useRef<(lat: number, lng: number) => void>(() => undefined);
  const seq = useRef(0);
  place.current = async (lat: number, lng: number) => {
    const my = ++seq.current;
    setBusy(true);
    const p = await reverseGeocode(lat, lng);
    if (my === seq.current) {
      setPt(p);
      setBusy(false);
    }
  };

  // Google Haritalar (anahtar girildiyse)
  useEffect(() => {
    if (!el.current || !usingGoogle()) return;
    let alive = true;
    let cleanup = () => undefined as void;
    (async () => {
      try {
        await loadGoogle(document.documentElement.lang || 'tr');
        if (!alive || !el.current) return;
        const { Map: GMap } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;
        const s = getState().settings;
        const start = initial ?? { lat: s.mapLat, lng: s.mapLng };
        const map = new GMap(el.current, {
          center: start,
          zoom: initial ? 16 : 11,
          mapId: GOOGLE_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });
        const pin = document.createElement('div');
        pin.className = 'map-pin gpin';
        pin.innerHTML = '<span></span>';
        const marker = new AdvancedMarkerElement({ map: initial ? map : null, position: start, content: pin, gmpDraggable: true });
        const move = (lat: number, lng: number) => {
          marker.position = { lat, lng };
          marker.map = map;
          place.current(lat, lng);
        };
        const l1 = map.addListener('click', (e: google.maps.MapMouseEvent) => e.latLng && move(e.latLng.lat(), e.latLng.lng()));
        const l2 = marker.addListener('dragend', () => {
          const p = marker.position as google.maps.LatLngLiteral | null;
          if (p) place.current(Number(p.lat), Number(p.lng));
        });
        cleanup = () => {
          l1.remove();
          l2.remove();
          marker.map = null;
        };
      } catch {
        /* Google yüklenemezse aşağıdaki OpenStreetMap haritası devreye girmez; kullanıcı aramayla seçebilir */
      }
    })();
    return () => {
      alive = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // OpenStreetMap (anahtar yoksa)
  useEffect(() => {
    if (!el.current || usingGoogle()) return;
    const s = getState().settings;
    const start = initial ?? { lat: s.mapLat, lng: s.mapLng };
    const map = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], initial ? 15 : 10);
    addBaseLayer(map);
    const marker = L.marker([start.lat, start.lng], { draggable: true, icon: pinIcon, opacity: initial ? 1 : 0 }).addTo(map);

    const put = (lat: number, lng: number) => {
      marker.setLatLng([lat, lng]).setOpacity(1);
      place.current(lat, lng);
    };
    map.on('click', (e: L.LeafletMouseEvent) => put(e.latlng.lat, e.latlng.lng));
    marker.on('dragend', () => {
      const ll = marker.getLatLng();
      place.current(ll.lat, ll.lng);
    });
    setTimeout(() => map.invalidateSize(), 50);
    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className="mapdlg-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mapdlg" role="dialog" aria-modal="true" aria-label={t('locMap')}>
        <div className="mapdlg-h">
          <b>{t('locMapHint')}</b>
          <button type="button" onClick={onClose} aria-label="×"><X size={20} /></button>
        </div>
        <div className="mapdlg-map" ref={el} />
        <div className="mapdlg-f">
          <div className="mapdlg-addr">
            {busy ? <Loader2 size={16} className="spin" /> : null}
            <span>
              <b>{pt?.label ?? '—'}</b>
              {pt?.sub && <small>{pt.sub}</small>}
            </span>
          </div>
          <button type="button" className="btn btn-gold btn-sm" disabled={!pt || busy} onClick={() => pt && onPick(pt)}>
            <Check size={16} /> {t('locConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
