import { ask, notify } from '../../components/dialog';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Luggage, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { uid, update, useStore } from '../../data/store';
import { VehicleMedia } from '../../components/VehicleMedia';
import type { Vehicle, VehicleArt } from '../../types';
import { Field, GalleryInput, L10nInput, Modal, PageHead, Toggle, toast } from './ui';

const ART: Record<VehicleArt, string> = { sedan: 'Sedan', van: 'Minivan', sprinter: 'Minibüs', bus: 'Midibüs / Otobüs' };
const empty = (): Vehicle => ({
  id: uid('v_'), name: '', art: 'van', pax: 6, luggage: 6, hourlyRate: 0, perKm: 0, minFare: 0, active: true, images: [],
  category: { tr: '', en: '', ru: '' }, description: { tr: '', en: '', ru: '' }, features: { tr: '', en: '', ru: '' },
});

function Editor({ initial, onClose }: { initial: Vehicle; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof Vehicle>(k: K, val: Vehicle[K]) => setV((p) => ({ ...p, [k]: val }));
  const isNew = !useStore((s) => s.vehicles.some((x) => x.id === initial.id));
  const save = () => {
    if (!v.name.trim()) return notify('Araç adı zorunlu.');
    const ok = update((s) => {
      const i = s.vehicles.findIndex((x) => x.id === v.id);
      if (i >= 0) s.vehicles[i] = v;
      else s.vehicles.push(v);
    });
    if (!ok) notify('Kaydedilemedi: tarayıcı depolama alanı doldu. Daha az / daha küçük görsel deneyin. (Canlı sürümde görseller sunucuda saklanır.)');
    else { toast('Araç kaydedildi'); onClose(); }
  };
  return (
    <Modal
      title={isNew ? 'Yeni araç' : v.name}
      onClose={onClose}
      wide
      footer={<><span className="grow" /><button className="abtn abtn-ghost" onClick={onClose}>Vazgeç</button><button className="abtn abtn-primary" onClick={save}>Kaydet</button></>}
    >
      <div className="aform">
        <Field label="Araç adı / modeli"><input value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Mercedes Vito VIP" /></Field>
        <Field label="Çizim tipi (görsel yoksa)">
          <select value={v.art} onChange={(e) => set('art', e.target.value as VehicleArt)}>
            {Object.entries(ART).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Yolcu kapasitesi"><input type="number" min={1} value={v.pax} onChange={(e) => set('pax', +e.target.value)} /></Field>
        <Field label="Bavul kapasitesi"><input type="number" min={0} value={v.luggage} onChange={(e) => set('luggage', +e.target.value)} /></Field>
        <Field label="Saatlik ücret (EUR)" hint="0 ise saatlik kiralamada teklif istenir"><input type="number" min={0} value={v.hourlyRate} onChange={(e) => set('hourlyRate', +e.target.value)} /></Field>
        <Field label="Km ücreti (EUR)" hint="Fiyat tablosunda olmayan konumlar için. 0 ise teklif istenir"><input type="number" min={0} step="0.1" value={v.perKm} onChange={(e) => set('perKm', +e.target.value)} /></Field>
        <Field label="En düşük ücret (EUR)" hint="Km bazlı fiyat bunun altına inmez"><input type="number" min={0} value={v.minFare} onChange={(e) => set('minFare', +e.target.value)} /></Field>
        <Field label="Durum"><Toggle checked={v.active} onChange={(x) => set('active', x)} label={v.active ? 'Sitede görünür' : 'Gizli'} /></Field>
        <L10nInput label="Kategori (ör. VIP Minivan)" value={v.category} onChange={(x) => set('category', x)} />
        <L10nInput label="Açıklama" value={v.description} onChange={(x) => set('description', x)} multiline />
        <L10nInput label="Özellikler (her satıra bir özellik)" value={v.features} onChange={(x) => set('features', x)} multiline rows={5} />
        <GalleryInput value={v.images} onChange={(x) => set('images', x)} />
      </div>
    </Modal>
  );
}

export function Vehicles() {
  const vehicles = useStore((s) => s.vehicles);
  const bookings = useStore((s) => s.bookings);
  const [edit, setEdit] = useState<Vehicle | null>(null);
  const move = (i: number, d: number) => update((s) => { const [x] = s.vehicles.splice(i, 1); s.vehicles.splice(i + d, 0, x); });
  const del = async (v: Vehicle) => {
    const used = bookings.filter((b) => b.vehicleId === v.id).length;
    if (!(await ask(used ? `${v.name} ${used} rezervasyonda kullanılıyor. Silmek yerine gizlemeniz önerilir. Yine de silinsin mi?` : `${v.name} silinsin mi?`))) return;
    update((s) => {
      s.vehicles = s.vehicles.filter((x) => x.id !== v.id);
      s.routes.forEach((r) => delete r.prices[v.id]);
    });
  };
  return (
    <>
      <PageHead title="Araçlar" desc="Araç tipleri, kapasiteler, görseller ve özellikler. Sıralama sitede de aynen görünür." actions={<button className="abtn abtn-primary" onClick={() => setEdit(empty())}><Plus size={16} /> Araç ekle</button>} />
      <div className="vgrid">
        {vehicles.map((v, i) => (
          <article key={v.id} className={`vitem ${v.active ? '' : 'off'}`}>
            <VehicleMedia v={v} />
            <div className="vitem-b">
              <small>{v.category.tr}</small>
              <h3>{v.name}</h3>
              <p><Users size={14} /> {v.pax} yolcu · <Luggage size={14} /> {v.luggage} bavul{v.hourlyRate ? ` · ${v.hourlyRate}€/saat` : ''}</p>
              {!v.active && <em className="pill">Gizli</em>}
            </div>
            <div className="vitem-a">
              <button className="aicon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Yukarı"><ArrowUp size={16} /></button>
              <button className="aicon" disabled={i === vehicles.length - 1} onClick={() => move(i, 1)} aria-label="Aşağı"><ArrowDown size={16} /></button>
              <button className="aicon" onClick={() => del(v)} aria-label="Sil"><Trash2 size={16} /></button>
              <button className="abtn abtn-sm" onClick={() => setEdit(structuredClone(v))}><Pencil size={14} /> Düzenle</button>
            </div>
          </article>
        ))}
      </div>
      {edit && <Editor initial={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
