import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Crosshair, Loader2, MapPin, Map as MapIcon, Plane, X } from 'lucide-react';
import { getState, useStore } from '../data/store';
import { useT } from '../lib/prefs';
import { currentPosition, remoteAvailable, resolveZone, reverseGeocode, searchLocal, searchRemote } from '../lib/geo';
import type { Point } from '../types';
import { MapPicker } from './MapPicker';

interface Props {
  value: Point | null;
  onChange: (p: Point | null) => void;
  label: React.ReactNode;
  variant?: 'dark' | 'light';
  className?: string;
}

/** Bölgeyi bulup noktaya ekler */
export function withZone(p: Point): Point {
  if (p.zoneId) return p;
  const z = resolveZone(getState(), p);
  return { ...p, zoneId: z?.id };
}

export function LocationField({ value, onChange, label, variant = 'light', className = '' }: Props) {
  const { t } = useT();
  const st = useStore((s) => s);
  const id = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<Point[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState('');
  const [online, setOnline] = useState<boolean | null>(null);
  const [map, setMap] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    remoteAvailable().then((ok) => alive && setOnline(ok));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const out = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, []);

  useEffect(() => {
    if (open && window.innerWidth < 700 && box.current) {
      const r = box.current.getBoundingClientRect();
      if (r.top > 90 || r.bottom + 320 > window.innerHeight) {
        window.scrollBy({ top: r.top - 80, behavior: 'smooth' });
      }
    }
  }, [open]);

  const local = useMemo(() => searchLocal(st, q).slice(0, q ? 6 : 20), [st, q]);

  useEffect(() => {
    setHi(0);
    if (!online || q.trim().length < 3) {
      setRemote([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    const ctl = new AbortController();
    const tm = setTimeout(() => {
      searchRemote(st, q.trim(), ctl.signal)
        .then((r) => setRemote(r))
        .catch(() => undefined)
        .finally(() => !ctl.signal.aborted && setBusy(false));
    }, 300);
    return () => {
      clearTimeout(tm);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, online]);

  const items = [...local, ...remote];

  const pick = (p: Point) => {
    onChange(withZone(p));
    setQ('');
    setOpen(false);
    setMsg('');
  };

  const useMine = async () => {
    setLocating(true);
    setMsg('');
    try {
      const pos = await currentPosition();
      pick(await reverseGeocode(pos.lat, pos.lng));
    } catch {
      setMsg(t('locDenied'));
    } finally {
      setLocating(false);
    }
  };

  const zone = value?.zoneId ? st.locations.find((l) => l.id === value.zoneId) : undefined;

  return (
    <div className={`locf locf-${variant} ${className}`} ref={box}>
      <label className="locf-label" htmlFor={id}>{label}</label>
      <div className={`locf-box ${open ? 'open' : ''}`}>
        {value && !open ? (
          <button type="button" className="locf-value" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0); }}>
            {value.kind === 'airport' ? <Plane size={16} /> : <MapPin size={16} />}
            <span>
              <b>{value.label}</b>
              <small>{value.sub || (zone ? zone.name : '')}</small>
            </span>
          </button>
        ) : (
          <input
            id={id}
            ref={input}
            value={q}
            placeholder={t('locSearch')}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(items.length - 1, h + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
              else if (e.key === 'Enter' && items[hi]) { e.preventDefault(); pick(items[hi]); }
              else if (e.key === 'Escape') setOpen(false);
            }}
          />
        )}
        {value && !open && (
          <button type="button" className="locf-clear" aria-label="×" onClick={() => { onChange(null); setOpen(true); setTimeout(() => input.current?.focus(), 0); }}>
            <X size={15} />
          </button>
        )}
      </div>

      {value && !open && (
        <div className="locf-meta">
          <span className={zone ? '' : 'out'}>{zone ? `${t('locZone')}: ${zone.name}` : t('locOutside')}</span>
          {online && (
            <button type="button" onClick={() => setMap(true)}>
              <MapIcon size={13} /> {t('locEditMap')}
            </button>
          )}
        </div>
      )}
      {msg && <p className="locf-msg">{msg}</p>}

      {open && (
        <div className="locf-pop" id={`${id}-list`} role="listbox">
          <div className="locf-actions">
            <button type="button" onClick={useMine} disabled={locating}>
              {locating ? <Loader2 size={16} className="spin" /> : <Crosshair size={16} />}
              {locating ? t('locLocating') : t('locMine')}
            </button>
            {online && (
              <button type="button" onClick={() => { setOpen(false); setMap(true); }}>
                <MapIcon size={16} /> {t('locMap')}
              </button>
            )}
          </div>
          <ul>
            {local.map((p, i) => (
              <li key={`l${i}`} role="option" aria-selected={hi === i} className={hi === i ? 'hi' : ''} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(p); }}>
                {p.kind === 'airport' ? <Plane size={16} /> : <MapPin size={16} />}
                <span><b>{p.label}</b>{p.kind === 'region' && <small>{t('locZone')}</small>}</span>
              </li>
            ))}
            {(remote.length > 0 || busy) && <li className="locf-sep">{t('locPlaces')}</li>}
            {remote.map((p, k) => {
              const i = local.length + k;
              return (
                <li key={`r${k}`} role="option" aria-selected={hi === i} className={hi === i ? 'hi' : ''} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(p); }}>
                  <MapPin size={16} />
                  <span><b>{p.label}</b>{p.sub && <small>{p.sub}</small>}</span>
                </li>
              );
            })}
            {busy && <li className="locf-note"><Loader2 size={14} className="spin" /> {t('locSearching')}</li>}
            {!busy && q.trim().length >= 3 && items.length === 0 && <li className="locf-note">{t('locNoResult')}</li>}
            {online === false && q.trim().length >= 3 && <li className="locf-note">{t('locOffline')}</li>}
          </ul>
        </div>
      )}

      {map && (
        <MapPicker
          initial={value}
          onClose={() => setMap(false)}
          onPick={(p) => { pick(p); setMap(false); }}
        />
      )}
    </div>
  );
}
