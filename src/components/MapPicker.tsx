import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Loader2, X } from 'lucide-react';
import { getState } from '../data/store';
import { useT } from '../lib/prefs';
import { reverseGeocode } from '../lib/geo';
import type { Point } from '../types';
import { addBaseLayer } from './mapTiles';

const pinIcon = L.divIcon({
  className: 'map-pin',
  html: '<span></span>',
  iconSize: [34, 44],
  iconAnchor: [17, 42],
});

/** Haritadan konum seçme penceresi (OpenStreetMap altlık, API anahtarı gerekmez) */
export function MapPicker({ initial, onPick, onClose }: { initial: Point | null; onPick: (p: Point) => void; onClose: () => void }) {
  const { t } = useT();
  const el = useRef<HTMLDivElement>(null);
  const [pt, setPt] = useState<Point | null>(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!el.current) return;
    const s = getState().settings;
    const start = initial ?? { lat: s.mapLat, lng: s.mapLng };
    const map = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], initial ? 15 : 10);
    addBaseLayer(map);
    const marker = L.marker([start.lat, start.lng], { draggable: true, icon: pinIcon, opacity: initial ? 1 : 0 }).addTo(map);

    let seq = 0;
    const place = async (lat: number, lng: number) => {
      marker.setLatLng([lat, lng]).setOpacity(1);
      const my = ++seq;
      setBusy(true);
      const p = await reverseGeocode(lat, lng);
      if (my === seq) {
        setPt(p);
        setBusy(false);
      }
    };
    map.on('click', (e: L.LeafletMouseEvent) => place(e.latlng.lat, e.latlng.lng));
    marker.on('dragend', () => {
      const ll = marker.getLatLng();
      place(ll.lat, ll.lng);
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
