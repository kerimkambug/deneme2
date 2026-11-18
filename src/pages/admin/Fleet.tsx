import { Plus, Trash2 } from 'lucide-react';
import { uid, update, useStore } from '../../data/store';
import { ask } from '../../components/dialog';
import type { FleetUnit } from '../../types';
import { Field } from './ui';

const DOCS: [keyof FleetUnit, string][] = [
  ['inspection', 'Muayene'],
  ['insurance', 'Trafik sigortası'],
  ['casco', 'Kasko'],
];

/** Bitiş tarihine kalan gün (geçmişse negatif) */
export function daysLeft(date: string) {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const end = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((end - today) / 864e5);
}

/** 30 gün içinde biten veya geçmiş evraklar */
export function expiringDocs(fleet: FleetUnit[], within = 30) {
  const out: { plate: string; doc: string; days: number }[] = [];
  for (const u of fleet) {
    for (const [k, label] of DOCS) {
      const dl = daysLeft(String(u[k] ?? ''));
      if (dl != null && dl <= within) out.push({ plate: u.plate, doc: label, days: dl });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

function DocBadge({ date }: { date: string }) {
  const dl = daysLeft(date);
  if (dl == null) return <span className="doc doc-none">Girilmedi</span>;
  if (dl < 0) return <span className="doc doc-bad">{-dl} gün geçti</span>;
  if (dl <= 30) return <span className="doc doc-warn">{dl} gün kaldı</span>;
  return <span className="doc doc-ok">{dl} gün</span>;
}

export function Fleet() {
  const s = useStore((x) => x);
  const set = (id: string, patch: Partial<FleetUnit>) =>
    update((x) => {
      Object.assign(x.fleet.find((u) => u.id === id)!, patch);
    });
  return (
    <>
      <div className="phead-act">
        <button
          className="abtn abtn-primary"
          onClick={() => update((x) => { x.fleet.push({ id: uid('f_'), plate: '', model: '', vehicleId: x.vehicles[0]?.id, year: '', inspection: '', insurance: '', casco: '', notes: '' }); })}
        >
          <Plus size={16} /> Araç (plaka) ekle
        </button>
      </div>
      {s.fleet.length === 0 && <p className="apanel empty">Henüz plaka eklenmedi. Her aracın muayene, sigorta ve kasko bitiş tarihini girin; süre dolmadan 30 gün önce özet ekranında uyarı görürsünüz.</p>}
      <div className="fleet-list">
        {s.fleet.map((u) => (
          <div key={u.id} className="apanel">
            <div className="aform">
              <Field label="Plaka"><input value={u.plate} onChange={(e) => set(u.id, { plate: e.target.value.toUpperCase() })} placeholder="07 ABC 123" /></Field>
              <Field label="Marka / model"><input value={u.model} onChange={(e) => set(u.id, { model: e.target.value })} placeholder="Mercedes Vito Tourer" /></Field>
              <Field label="Araç tipi">
                <select value={u.vehicleId ?? ''} onChange={(e) => set(u.id, { vehicleId: e.target.value || undefined })}>
                  <option value="">—</option>
                  {s.vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </Field>
              <Field label="Model yılı"><input inputMode="numeric" value={u.year} onChange={(e) => set(u.id, { year: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></Field>
              {DOCS.map(([k, label]) => (
                <Field key={k} label={`${label} bitiş`}>
                  <div className="inline">
                    <input type="date" value={String(u[k] ?? '')} onChange={(e) => set(u.id, { [k]: e.target.value } as Partial<FleetUnit>)} />
                    <DocBadge date={String(u[k] ?? '')} />
                  </div>
                </Field>
              ))}
              <Field label="Notlar" wide><input value={u.notes} onChange={(e) => set(u.id, { notes: e.target.value })} placeholder="Bakım, lastik, servis notları…" /></Field>
            </div>
            <div className="row-gap" style={{ justifyContent: 'flex-end' }}>
              <button className="abtn abtn-ghost" onClick={async () => (await ask(`${u.plate || 'Bu araç'} silinsin mi?`, { danger: true, okText: 'Sil' })) && update((x) => { x.fleet = x.fleet.filter((y) => y.id !== u.id); })}>
                <Trash2 size={15} /> Sil
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
