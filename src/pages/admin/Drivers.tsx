import { ask, notify } from '../../components/dialog';
import { useState } from 'react';
import { KeyRound, MessageCircle, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { uid, update, useStore } from '../../data/store';
import { appUrl, eur, telLink, todayIso, waLink } from '../../lib/format';
import type { Driver } from '../../types';
import { Field, Modal, PageHead, Toggle, toast } from './ui';

const empty = (): Driver => ({ id: uid('d_'), name: '', phone: '', pin: String(Math.floor(1000 + Math.random() * 9000)), plate: '', languages: 'TR', active: true });

export function Drivers() {
  const s = useStore((x) => x);
  const [edit, setEdit] = useState<Driver | null>(null);
  const month = todayIso().slice(0, 7);

  const sendLogin = (d: Driver) => {
    const msg = `Merhaba ${d.name.split(' ')[0]}, ${s.settings.companyName} şoför ekranı giriş bilgileriniz:\n\nAdres: ${appUrl('/surucu')}\nAdınız: ${d.name}\nPIN: ${d.pin}\n\nAdresi telefonunuzda açıp "Ana ekrana ekle" derseniz uygulama gibi kullanabilirsiniz.`;
    window.open(waLink(d.phone, msg), '_blank', 'noopener');
  };

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim() || !/^\d{4,6}$/.test(edit.pin)) return notify('Ad ve 4–6 haneli PIN zorunlu.');
    const isNew = !s.drivers.some((d) => d.id === edit.id);
    const saved = { ...edit, name: edit.name.trim() };
    update((x) => {
      const i = x.drivers.findIndex((d) => d.id === edit.id);
      if (i >= 0) x.drivers[i] = edit;
      else x.drivers.push(edit);
    });
    toast('Şoför kaydedildi');
    setEdit(null);
    if (isNew && saved.phone.replace(/\D/g, '').length >= 7 && (await ask(`${saved.name} için giriş bilgileri (adres ve PIN) WhatsApp’tan gönderilsin mi?`, { okText: 'Gönder' }))) {
      sendLogin(saved);
    }
  };

  return (
    <>
      <PageHead title="Şoförler" desc="Şoförler kendi telefonlarından /surucu adresine PIN ile girer ve sadece kendi işlerini görür." actions={<button className="abtn abtn-primary" onClick={() => setEdit(empty())}><Plus size={16} /> Şoför ekle</button>} />
      {s.drivers.length === 0 && (
        <div className="apanel empty-state">
          <b>Henüz şoför eklenmedi.</b>
          <p className="muted">Şoför ekleyin, kendisine verdiğiniz PIN ile telefonundan şoför ekranına girsin. Eklerken giriş bilgilerini WhatsApp’tan tek tuşla gönderebilirsiniz.</p>
          <button className="abtn abtn-primary" onClick={() => setEdit(empty())}><Plus size={16} /> İlk şoförü ekle</button>
        </div>
      )}
      <div className="dgrid">
        {s.drivers.map((d) => {
          const mine = s.bookings.filter((b) => b.driverId === d.id);
          const done = mine.filter((b) => b.status === 'completed' && b.date.startsWith(month));
          const cash = done.reduce((a, b) => a + (b.cashCollected ?? 0), 0);
          const today = mine.filter((b) => b.date === todayIso() && !['cancelled', 'no_show'].includes(b.status)).length;
          const v = s.vehicles.find((x) => x.id === d.vehicleId);
          return (
            <article key={d.id} className={`ditem ${d.active ? '' : 'off'}`}>
              <div className="ditem-h">
                <span className="driver-av">{d.name.slice(0, 1)}</span>
                <div>
                  <h3>{d.name}</h3>
                  <small>{d.plate} · {v?.name ?? 'Araç yok'}</small>
                </div>
                {!d.active && <em className="pill">Pasif</em>}
              </div>
              <div className="ditem-stats">
                <span><b>{today}</b> bugün</span>
                <span><b>{done.length}</b> bu ay</span>
                <span><b>{eur(cash)}</b> tahsilat</span>
              </div>
              <small className="muted">Diller: {d.languages} · PIN: ••••</small>
              <div className="row-gap">
                <a className="aicon" href={telLink(d.phone)} aria-label="Ara"><Phone size={16} /></a>
                <a className="aicon" href={waLink(d.phone)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><MessageCircle size={16} /></a>
                <button className="aicon" onClick={() => sendLogin(d)} aria-label="Giriş bilgilerini gönder" title="Giriş bilgilerini WhatsApp’tan gönder"><KeyRound size={16} /></button>
                <span className="grow" />
                <button className="aicon" aria-label="Sil" onClick={async () => (await ask(`${d.name} silinsin mi?`, { danger: true, okText: 'Sil' })) && update((x) => { x.drivers = x.drivers.filter((y) => y.id !== d.id); x.bookings.forEach((b) => { if (b.driverId === d.id && b.status !== 'completed') b.driverId = undefined; }); })}><Trash2 size={16} /></button>
                <button className="abtn abtn-sm" onClick={() => setEdit({ ...d })}><Pencil size={14} /> Düzenle</button>
              </div>
            </article>
          );
        })}
      </div>
      {edit && (
        <Modal title={edit.name || 'Yeni şoför'} onClose={() => setEdit(null)} footer={<><span className="grow" /><button className="abtn abtn-ghost" onClick={() => setEdit(null)}>Vazgeç</button><button className="abtn abtn-primary" onClick={save}>Kaydet</button></>}>
          <div className="aform">
            <Field label="Ad Soyad"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Telefon (WhatsApp)"><input type="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Plaka"><input value={edit.plate} onChange={(e) => setEdit({ ...edit, plate: e.target.value.toUpperCase() })} /></Field>
            <Field label="Varsayılan araç">
              <select value={edit.vehicleId ?? ''} onChange={(e) => setEdit({ ...edit, vehicleId: e.target.value || undefined })}>
                <option value="">—</option>
                {s.vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            <Field label="Konuştuğu diller"><input value={edit.languages} onChange={(e) => setEdit({ ...edit, languages: e.target.value })} placeholder="TR, EN, RU" /></Field>
            <Field label="Giriş PIN’i" hint="Şoför ekranına giriş için 4–6 hane"><input inputMode="numeric" value={edit.pin} onChange={(e) => setEdit({ ...edit, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} /></Field>
            <Field label="Durum"><Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label={edit.active ? 'Aktif' : 'Pasif'} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
