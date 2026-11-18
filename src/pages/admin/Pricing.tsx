import { ask, notify } from '../../components/dialog';
import { useMemo, useState } from 'react';
import { MapPin, Plus, Star, Trash2, Percent } from 'lucide-react';
import { uid, update, useStore } from '../../data/store';
import type { LocationKind, Point } from '../../types';
import { LocationField } from '../../components/LocationField';
import { mapLink } from '../../lib/geo';
import { Field, L10nInput, PageHead, Toggle, toast } from './ui';

export function Pricing() {
  const s = useStore((x) => x);
  const [tab, setTab] = useState<'prices' | 'places' | 'extras' | 'rules'>('prices');
  const [filter, setFilter] = useState('');
  const [nf, setNf] = useState({ from: '', to: '' });
  const [nl, setNl] = useState({ name: '', kind: 'region' as LocationKind, code: '', point: null as Point | null, radius: 5 });
  const [pct, setPct] = useState(10);
  const vehicles = s.vehicles;
  const name = (id: string) => s.locations.find((l) => l.id === id)?.name ?? id;

  const routes = useMemo(
    () => s.routes.filter((r) => !filter || r.from === filter || r.to === filter),
    [s.routes, filter],
  );

  const setPrice = (rid: string, vid: string, val: string) =>
    update((x) => {
      const r = x.routes.find((y) => y.id === rid);
      if (r) r.prices[vid] = Math.max(0, Number(val) || 0);
    });
  const setRoute = (rid: string, patch: Record<string, unknown>) =>
    update((x) => {
      const r = x.routes.find((y) => y.id === rid);
      if (r) Object.assign(r, patch);
    });

  const addRoute = () => {
    if (!nf.from || !nf.to || nf.from === nf.to) return notify('İki farklı nokta seçin.');
    if (s.routes.some((r) => (r.from === nf.from && r.to === nf.to) || (r.from === nf.to && r.to === nf.from))) return notify('Bu güzergâh zaten var.');
    update((x) => { x.routes.unshift({ id: uid('r_'), from: nf.from, to: nf.to, durationMin: 60, distanceKm: 50, prices: {}, popular: false }); });
    setNf({ from: '', to: '' });
    toast('Güzergâh eklendi, fiyatları girin');
  };

  const bulk = async (sign: 1 | -1) => {
    if (!(await ask(`${filter ? name(filter) + ' içeren ' : 'Tüm '}güzergâh fiyatları %${pct} ${sign > 0 ? 'artırılsın' : 'düşürülsün'} mı?`))) return;
    update((x) => {
      x.routes.forEach((r) => {
        if (filter && r.from !== filter && r.to !== filter) return;
        Object.keys(r.prices).forEach((k) => { r.prices[k] = Math.round((r.prices[k] * (1 + (sign * pct) / 100)) / 5) * 5; });
      });
    });
    toast('Fiyatlar güncellendi');
  };

  const LocSel = ({ v, on }: { v: string; on: (x: string) => void }) => (
    <select value={v} onChange={(e) => on(e.target.value)}>
      <option value="">Seçin…</option>
      {s.locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.code ? ` (${l.code})` : ''}</option>)}
    </select>
  );

  return (
    <>
      <PageHead title="Bölgeler & Fiyatlar" desc="Fiyatlar araç başı, tek yön ve EUR cinsindendir. Site, müşterinin seçtiği para birimine kendisi çevirir." />
      <div className="tabs tabs-lg">
        {([['prices', 'Fiyat tablosu'], ['places', 'Havalimanı & bölgeler'], ['extras', 'Ekstralar'], ['rules', 'Kurallar']] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'prices' && (
        <>
          <div className="toolbar">
            <div className="inline">
              <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtre">
                <option value="">Tüm güzergâhlar</option>
                {s.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="inline bulk">
              <Percent size={15} />
              <input type="number" value={pct} min={1} max={100} onChange={(e) => setPct(+e.target.value)} aria-label="Yüzde" />
              <button className="abtn abtn-sm" onClick={() => bulk(1)}>Zam yap</button>
              <button className="abtn abtn-sm abtn-ghost" onClick={() => bulk(-1)}>İndirim</button>
            </div>
          </div>
          <div className="apanel newroute">
            <b>Yeni güzergâh</b>
            <LocSel v={nf.from} on={(x) => setNf({ ...nf, from: x })} />
            <span>↔</span>
            <LocSel v={nf.to} on={(x) => setNf({ ...nf, to: x })} />
            <button className="abtn abtn-primary abtn-sm" onClick={addRoute}><Plus size={14} /> Ekle</button>
          </div>
          <div className="ptable-wrap">
            <table className="ptable">
              <thead>
                <tr>
                  <th>Güzergâh</th>
                  <th title="Ana sayfada göster"><Star size={14} /></th>
                  <th>km</th>
                  <th>dk</th>
                  {vehicles.map((v) => <th key={v.id}>{v.name.replace('Mercedes ', '')}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r.id}>
                    <td className="ptable-route">{name(r.from)} <span>↔</span> {name(r.to)}</td>
                    <td><input type="checkbox" checked={r.popular} onChange={(e) => setRoute(r.id, { popular: e.target.checked })} aria-label="Popüler" /></td>
                    <td><input type="number" className="sm" value={r.distanceKm} onChange={(e) => setRoute(r.id, { distanceKm: +e.target.value })} /></td>
                    <td><input type="number" className="sm" value={r.durationMin} onChange={(e) => setRoute(r.id, { durationMin: +e.target.value })} /></td>
                    {vehicles.map((v) => (
                      <td key={v.id}>
                        <div className="eur-in">
                          <input type="number" min={0} value={r.prices[v.id] || ''} placeholder="—" onChange={(e) => setPrice(r.id, v.id, e.target.value)} />
                          <span>€</span>
                        </div>
                      </td>
                    ))}
                    <td><button className="aicon" aria-label="Sil" onClick={async () => (await ask('Güzergâh silinsin mi?', { danger: true, okText: 'Sil' })) && update((x) => { x.routes = x.routes.filter((y) => y.id !== r.id); })}><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Boş bırakılan fiyatlarda müşteri “fiyat teklifi” talebi gönderir. ★ işaretli güzergâhlar ana sayfadaki fiyat listesinde görünür.</p>
        </>
      )}

      {tab === 'places' && (
        <>
          <div className="apanel newroute">
            <b>Yeni nokta</b>
            <div className="newloc-search">
              <LocationField label="Konum (arayın veya haritadan seçin)" value={nl.point} onChange={(p) => setNl({ ...nl, point: p, name: nl.name || (p?.label ?? '') })} />
            </div>
            <input placeholder="Ad (ör. Çolaklı)" value={nl.name} onChange={(e) => setNl({ ...nl, name: e.target.value })} />
            <input className="sm" type="number" min={1} title="Yarıçap (km)" value={nl.radius} onChange={(e) => setNl({ ...nl, radius: +e.target.value })} />
            <small>km</small>
            <select value={nl.kind} onChange={(e) => setNl({ ...nl, kind: e.target.value as LocationKind })}>
              <option value="region">Bölge / ilçe</option>
              <option value="airport">Havalimanı / liman</option>
            </select>
            {nl.kind === 'airport' && <input className="sm" placeholder="Kod" value={nl.code} onChange={(e) => setNl({ ...nl, code: e.target.value.toUpperCase() })} />}
            <button
              className="abtn abtn-primary abtn-sm"
              onClick={() => {
                if (!nl.name.trim() || !nl.point) return notify('Ad ve konum seçin.');
                update((x) => { x.locations.push({ id: uid('l_'), name: nl.name.trim(), kind: nl.kind, code: nl.code || undefined, lat: nl.point!.lat, lng: nl.point!.lng, radiusKm: nl.kind === 'airport' ? 3 : nl.radius }); });
                setNl({ name: '', kind: 'region', code: '', point: null, radius: 5 });
                toast('Eklendi');
              }}
            ><Plus size={14} /> Ekle</button>
          </div>
          <div className="loclist">
            {s.locations.map((l) => {
              const n = s.routes.filter((r) => r.from === l.id || r.to === l.id).length;
              return (
                <div key={l.id} className="locrow">
                  <span className={`pill ${l.kind === 'airport' ? 'pill-gold' : ''}`}>{l.kind === 'airport' ? 'Havalimanı' : 'Bölge'}</span>
                  <input value={l.name} onChange={(e) => update((x) => { x.locations.find((y) => y.id === l.id)!.name = e.target.value; })} />
                  {l.kind === 'airport' && <input className="sm" value={l.code ?? ''} onChange={(e) => update((x) => { x.locations.find((y) => y.id === l.id)!.code = e.target.value.toUpperCase(); })} />}
                  <label className="rad" title="Bu yarıçap içindeki adresler bu bölgeye sayılır">
                    <input type="number" min={1} value={l.radiusKm ?? ''} onChange={(e) => update((x) => { x.locations.find((y) => y.id === l.id)!.radiusKm = +e.target.value; })} /> km
                  </label>
                  {l.lat != null && l.lng != null ? (
                    <a className="maplink" href={mapLink({ lat: l.lat, lng: l.lng })} target="_blank" rel="noopener noreferrer"><MapPin size={13} /> {l.lat.toFixed(3)}, {l.lng.toFixed(3)}</a>
                  ) : <em className="tx-warn">Konum yok</em>}
                  <small>{n} güzergâh</small>
                  <button className="aicon" aria-label="Sil" onClick={async () => (await ask(`${l.name} ve ${n} güzergâhı silinsin mi?`, { danger: true, okText: 'Sil' })) && update((x) => { x.locations = x.locations.filter((y) => y.id !== l.id); x.routes = x.routes.filter((r) => r.from !== l.id && r.to !== l.id); })}><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'extras' && (
        <>
          <div className="phead-act"><button className="abtn abtn-primary" onClick={() => update((x) => { x.extras.push({ id: uid('e_'), name: { tr: 'Yeni ekstra', en: 'New extra', ru: 'Новая услуга' }, price: 0, maxQty: 1, active: true }); })}><Plus size={16} /> Ekstra ekle</button></div>
          <div className="extras-admin">
            {s.extras.map((e) => (
              <div key={e.id} className="apanel aform">
                <L10nInput label="Ad" value={e.name} onChange={(v) => update((x) => { x.extras.find((y) => y.id === e.id)!.name = v; })} />
                <Field label="Fiyat (EUR, 0 = ücretsiz)"><input type="number" min={0} value={e.price} onChange={(ev) => update((x) => { x.extras.find((y) => y.id === e.id)!.price = +ev.target.value; })} /></Field>
                <Field label="En fazla adet"><input type="number" min={1} value={e.maxQty} onChange={(ev) => update((x) => { x.extras.find((y) => y.id === e.id)!.maxQty = +ev.target.value; })} /></Field>
                <Field label="Durum"><Toggle checked={e.active} onChange={(v) => update((x) => { x.extras.find((y) => y.id === e.id)!.active = v; })} label={e.active ? 'Aktif' : 'Pasif'} /></Field>
                <Field label=" "><button className="abtn abtn-ghost" onClick={async () => (await ask('Silinsin mi?')) && update((x) => { x.extras = x.extras.filter((y) => y.id !== e.id); })}><Trash2 size={15} /> Sil</button></Field>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'rules' && (
        <div className="apanel aform">
          <Field label="Gidiş-dönüş indirimi (%)"><input type="number" min={0} max={50} value={s.settings.roundTripDiscount} onChange={(e) => update((x) => { x.settings.roundTripDiscount = +e.target.value; })} /></Field>
          <Field label="Gece ücreti (%)" hint="0 = uygulanmaz"><input type="number" min={0} max={100} value={s.settings.nightSurcharge} onChange={(e) => update((x) => { x.settings.nightSurcharge = +e.target.value; })} /></Field>
          <Field label="Gece başlangıç"><input type="time" value={s.settings.nightStart} onChange={(e) => update((x) => { x.settings.nightStart = e.target.value; })} /></Field>
          <Field label="Gece bitiş"><input type="time" value={s.settings.nightEnd} onChange={(e) => update((x) => { x.settings.nightEnd = e.target.value; })} /></Field>
          <Field label="Ücretsiz bekleme (dk)"><input type="number" min={0} value={s.settings.freeWaitMin} onChange={(e) => update((x) => { x.settings.freeWaitMin = +e.target.value; })} /></Field>
          <Field label="En erken rezervasyon (saat önce)"><input type="number" min={0} value={s.settings.minLeadHours} onChange={(e) => update((x) => { x.settings.minLeadHours = +e.target.value; })} /></Field>
          <Field label="Yol mesafesi çarpanı" hint="Kuş uçuşu mesafe × bu değer = tahmini yol km (1.3 önerilir)"><input type="number" step="0.05" min={1} value={s.settings.roadFactor} onChange={(e) => update((x) => { x.settings.roadFactor = +e.target.value; })} /></Field>
          <h4 className="wide">Döviz kurları (1 EUR =)</h4>
          {(['TRY', 'USD', 'GBP'] as const).map((c) => (
            <Field key={c} label={c}><input type="number" step="0.01" min={0} value={s.settings.rates[c]} onChange={(e) => update((x) => { x.settings.rates[c] = +e.target.value; })} /></Field>
          ))}
          <h4 className="wide">Ödeme yöntemleri</h4>
          <Field label="Araçta nakit"><Toggle checked={s.settings.payments.cash} onChange={(v) => update((x) => { x.settings.payments.cash = v; })} /></Field>
          <Field label="Araçta kredi kartı"><Toggle checked={s.settings.payments.card_vehicle} onChange={(v) => update((x) => { x.settings.payments.card_vehicle = v; })} /></Field>
          <Field label="Online ödeme" hint="Sanal POS (iyzico / PayTR) entegrasyonu ile aktif edilir"><Toggle checked={s.settings.payments.online} onChange={(v) => update((x) => { x.settings.payments.online = v; })} /></Field>
        </div>
      )}
    </>
  );
}
