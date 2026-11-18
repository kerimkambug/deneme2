import { useMemo, useState } from 'react';
import { KeyRound, MessageCircle, Phone, Search, Trash2 } from 'lucide-react';
import { adminDeleteCustomer, adminSetCustomerPassword, useStore } from '../../data/store';
import { eur, telLink, waLink } from '../../lib/format';
import { ask, askText, notify } from '../../components/dialog';
import { PageHead, toast } from './ui';

export function Customers() {
  const s = useStore((x) => x);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return [...s.customers]
      .filter((c) => !ql || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(ql))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [s.customers, q]);

  const resetPw = async (id: string, name: string) => {
    const pw = await askText(`${name} için yeni şifre (en az 6 karakter). Müşteriye WhatsApp’tan iletebilirsiniz.`, Math.random().toString(36).slice(2, 10), { title: 'Şifre sıfırla', okText: 'Kaydet' });
    if (pw === null) return;
    if (pw.length < 6) return notify('Şifre en az 6 karakter olmalı.');
    try {
      await adminSetCustomerPassword(id, pw);
      toast('Şifre güncellendi');
      const c = s.customers.find((x) => x.id === id);
      if (c && (await ask('Yeni şifre müşteriye WhatsApp’tan gönderilsin mi?', { okText: 'Gönder' }))) {
        window.open(waLink(c.phone, `${s.settings.companyName}: Yeni şifreniz: ${pw}\nGiriş: ${location.origin}/hesap`), '_blank', 'noopener');
      }
    } catch (e) {
      notify((e as Error).message);
    }
  };

  return (
    <>
      <PageHead title="Müşteriler" desc="Hesap açmış müşteriler. Şifresini unutan müşteriye buradan yeni şifre verebilirsiniz." />
      <div className="toolbar">
        <span className="muted">{s.customers.length} kayıtlı müşteri</span>
        <label className="search">
          <Search size={16} />
          <input placeholder="İsim, e-posta, telefon…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="atable">
        <div className="atr ath atr-cust">
          <span>Müşteri</span><span>İletişim</span><span>Yolculuk</span><span>Harcama</span><span />
        </div>
        {list.length === 0 && <p className="empty">Henüz hesap açan müşteri yok. Müşteriler rezervasyon sırasında veya “Hesabım” sayfasından hesap açabilir.</p>}
        {list.map((c) => {
          const bs = s.bookings.filter((b) => b.customerId === c.id);
          const spent = bs.filter((b) => b.status === 'completed').reduce((a, b) => a + (b.price || 0), 0);
          return (
            <div key={c.id} className="atr atr-cust">
              <span className="c-cust"><b>{c.name}</b><small>Üye: {new Date(c.createdAt).toLocaleDateString('tr-TR')}</small></span>
              <span className="c-cust"><span>{c.email}</span><small>{c.phone}</small></span>
              <span>{bs.length}</span>
              <span>{eur(spent)}</span>
              <span className="row-gap">
                <a className="aicon" href={telLink(c.phone)} aria-label="Ara"><Phone size={16} /></a>
                <a className="aicon" href={waLink(c.phone)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><MessageCircle size={16} /></a>
                <button className="aicon" onClick={() => resetPw(c.id, c.name)} aria-label="Şifre sıfırla" title="Şifre sıfırla"><KeyRound size={16} /></button>
                <button
                  className="aicon"
                  aria-label="Sil"
                  onClick={async () => (await ask(`${c.name} hesabı silinsin mi? Rezervasyonları silinmez.`, { danger: true, okText: 'Sil' })) && adminDeleteCustomer(c.id).catch((e) => notify(e.message))}
                ><Trash2 size={16} /></button>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
