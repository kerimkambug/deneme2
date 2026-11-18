import { useMemo, useState } from 'react';
import { HandCoins, Trash2 } from 'lucide-react';
import { addSettlement, deleteExpense, deleteSettlement, useStore } from '../../data/store';
import { askText, ask, notify } from '../../components/dialog';
import { eur } from '../../lib/format';
import { EXPENSE_LABEL } from '../driver/expenses';
import { PageHead, toast } from './ui';

const tl = (v: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);

/** Şoför kasası: toplanan nakit − masraf − teslim alınan = bakiye */
export function Cash() {
  const s = useStore((x) => x);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [driver, setDriver] = useState('');
  const rate = s.settings.rates.TRY || 1;

  const rows = useMemo(
    () =>
      s.drivers.map((d) => {
        const done = s.bookings.filter((b) => b.driverId === d.id && b.status === 'completed');
        const cash = done.filter((b) => b.payment !== 'online').reduce((a, b) => a + (b.cashCollected ?? 0), 0);
        const exp = s.expenses.filter((e) => e.driverId === d.id).reduce((a, e) => a + e.amount, 0);
        const settled = s.settlements.filter((x) => x.driverId === d.id).reduce((a, x) => a + x.amount, 0);
        const mDone = done.filter((b) => b.date.startsWith(month));
        const mExp = s.expenses.filter((e) => e.driverId === d.id && e.date.startsWith(month)).reduce((a, e) => a + e.amount, 0);
        return {
          d,
          jobs: mDone.length,
          mCash: mDone.reduce((a, b) => a + (b.cashCollected ?? 0), 0),
          mExp,
          balance: Math.round(cash - exp / rate - settled) || 0,
        };
      }),
    [s, month, rate],
  );

  const settle = async (driverId: string, name: string, balance: number) => {
    const v = await askText(`${name} şoföründen teslim alınan tutar (EUR)`, String(Math.max(0, balance)), { title: 'Kasa teslim al', okText: 'Kaydet', inputMode: 'decimal', suffix: '€' });
    if (v === null) return;
    const amount = Number(v.replace(',', '.'));
    if (!amount) return notify('Geçerli bir tutar girin.');
    try {
      await addSettlement(driverId, amount, '');
      toast('Teslim kaydedildi');
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const expenses = s.expenses.filter((e) => e.date.startsWith(month) && (!driver || e.driverId === driver));
  const settlements = s.settlements.filter((x) => x.at.startsWith(month) && (!driver || x.driverId === driver));

  return (
    <>
      <PageHead
        title="Kasa"
        desc={`Şoförlerin topladığı nakit, masrafları ve size teslim ettikleri. Masraflar TL girilir, bakiye 1 € = ${rate} ₺ kuruyla hesaplanır.`}
        actions={<input type="month" className="month-in" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Ay" />}
      />
      <div className="atable">
        <div className="atr ath atr-cash"><span>Şoför</span><span>Bu ay iş</span><span>Bu ay tahsilat</span><span>Bu ay masraf</span><span>Güncel bakiye</span><span /></div>
        {rows.length === 0 && <p className="empty">Henüz şoför yok.</p>}
        {rows.map((r) => (
          <div key={r.d.id} className="atr atr-cash">
            <span className="c-cust"><b>{r.d.name}</b><small>{r.d.plate}</small></span>
            <span>{r.jobs}</span>
            <span>{eur(r.mCash)}</span>
            <span>{tl(r.mExp)}</span>
            <span className={r.balance > 0 ? 'bal-due' : 'bal-ok'}><b>{eur(r.balance)}</b><small>{r.balance > 0 ? 'şoförde' : 'kapalı'}</small></span>
            <span><button className="abtn abtn-sm" onClick={() => settle(r.d.id, r.d.name, r.balance)}><HandCoins size={14} /> Teslim al</button></span>
          </div>
        ))}
      </div>

      <div className="dash-grid cash-grid">
        <section className="apanel">
          <div className="apanel-h">
            <h3>Masraflar</h3>
            <select value={driver} onChange={(e) => setDriver(e.target.value)} className="month-in" aria-label="Şoför">
              <option value="">Tüm şoförler</option>
              {s.drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {expenses.length === 0 && <p className="empty">Bu ay masraf girilmemiş.</p>}
          <ul className="ledger">
            {expenses.map((e) => (
              <li key={e.id}>
                <span>{e.date.split('-').reverse().slice(0, 2).join('.')}</span>
                <span><b>{EXPENSE_LABEL[e.type]}</b> · {s.drivers.find((d) => d.id === e.driverId)?.name ?? '—'}{e.note && <small> · {e.note}</small>}</span>
                <b>{tl(e.amount)}</b>
                <button className="aicon" aria-label="Sil" onClick={async () => (await ask('Masraf silinsin mi?', { danger: true, okText: 'Sil' })) && deleteExpense(e.id, 'admin').catch((x) => notify(x.message))}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </section>
        <section className="apanel">
          <div className="apanel-h"><h3>Teslim alınanlar</h3></div>
          {settlements.length === 0 && <p className="empty">Bu ay teslim kaydı yok.</p>}
          <ul className="ledger">
            {settlements.map((x) => (
              <li key={x.id}>
                <span>{new Date(x.at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</span>
                <span>{s.drivers.find((d) => d.id === x.driverId)?.name ?? '—'}</span>
                <b>{eur(x.amount)}</b>
                <button className="aicon" aria-label="Sil" onClick={async () => (await ask('Teslim kaydı silinsin mi?', { danger: true, okText: 'Sil' })) && deleteSettlement(x.id).catch((e) => notify(e.message))}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
