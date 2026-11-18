import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, Trash2, X, ArrowUp, ArrowDown } from 'lucide-react';
import { LANGS, type BookingStatus, type L10n } from '../../types';
import { STATUS_LABEL } from '../../lib/i18n';
import { compressImage } from '../../lib/image';

export const LANG_FLAG: Record<string, string> = { tr: 'TR', en: 'EN', ru: 'RU', de: 'DE', pl: 'PL' };

export function StatusBadge({ s }: { s: BookingStatus }) {
  return <span className={`badge st-${s}`}>{STATUS_LABEL[s].tr}</span>;
}

export function Field({ label, children, hint, wide }: { label: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return (
    <label className={`afld ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

/** Üç dilli metin girişi */
export function L10nInput({ label, value, onChange, multiline, rows = 3, hint }: { label: string; value: L10n; onChange: (v: L10n) => void; multiline?: boolean; rows?: number; hint?: string }) {
  const [tab, setTab] = useState<(typeof LANGS)[number]>('tr');
  return (
    <div className="afld wide l10n">
      <div className="l10n-head">
        <span>{label}</span>
        <div className="l10n-tabs">
          {LANGS.map((l) => (
            <button type="button" key={l} className={`${tab === l ? 'on' : ''} ${!value[l]?.trim() ? 'empty' : ''}`} onClick={() => setTab(l)}>
              {LANG_FLAG[l]}
            </button>
          ))}
        </div>
      </div>
      {multiline ? (
        <textarea rows={rows} value={value[tab] ?? ''} onChange={(e) => onChange({ ...value, [tab]: e.target.value })} />
      ) : (
        <input value={value[tab] ?? ''} onChange={(e) => onChange({ ...value, [tab]: e.target.value })} />
      )}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function ImageInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="afld wide">
      <span>{label}</span>
      <div className="imgin">
        <div className="imgin-prev">{value ? <img src={value} alt="" /> : <ImagePlus size={22} />}</div>
        <div className="imgin-ctl">
          <button type="button" className="abtn" disabled={busy} onClick={() => ref.current?.click()}>
            <ImagePlus size={16} /> {busy ? 'Yükleniyor…' : 'Görsel yükle'}
          </button>
          {value && (
            <button type="button" className="abtn abtn-ghost" onClick={() => onChange('')}>
              <Trash2 size={16} /> Kaldır
            </button>
          )}
          <input
            className="imgin-url"
            placeholder="veya görsel bağlantısı (https://…)"
            value={value.startsWith('data:') ? '' : value}
            onChange={(e) => onChange(e.target.value.trim())}
          />
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            setErr('');
            try {
              onChange(await compressImage(f));
            } catch (x) {
              setErr((x as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {(err || hint) && <small className={err ? 'aerr' : ''}>{err || hint}</small>}
    </div>
  );
}

export function GalleryInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const move = (i: number, d: number) => {
    const n = [...value];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    onChange(n);
  };
  return (
    <div className="afld wide">
      <span>Görseller (ilk görsel kapak olur)</span>
      <div className="gallery">
        {value.map((src, i) => (
          <div key={i} className="gallery-item">
            <img src={src} alt="" />
            <div className="gallery-ctl">
              {i > 0 && <button type="button" onClick={() => move(i, -1)} aria-label="Öne al"><ArrowUp size={14} /></button>}
              {i < value.length - 1 && <button type="button" onClick={() => move(i, 1)} aria-label="Geri al"><ArrowDown size={14} /></button>}
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="Sil"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        <button type="button" className="gallery-add" disabled={busy} onClick={() => ref.current?.click()}>
          <ImagePlus size={22} />
          {busy ? 'Yükleniyor…' : 'Ekle'}
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (!files.length) return;
            setBusy(true);
            try {
              const out = await Promise.all(files.map((f) => compressImage(f, 1400, 0.78)));
              onChange([...value, ...out]);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      <small>Görsel yoksa sitede şık bir araç çizimi gösterilir.</small>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h">
          <h3>{title}</h3>
          <button className="aicon" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHead({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="phead">
      <div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {actions && <div className="phead-act">{actions}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" />
      {label && <span>{label}</span>}
    </label>
  );
}

let toastTimer: number | undefined;
export function toast(msg: string) {
  let el = document.getElementById('atoast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'atoast';
    el.className = 'atoast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 2200);
}
