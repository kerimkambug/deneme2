import { useState } from 'react';
import { Fuel, Loader2, ParkingCircle, Plus, Receipt, Route, Sparkles, Trash2 } from 'lucide-react';
import { addExpense, deleteExpense, useStore } from '../../data/store';
import { notify } from '../../components/dialog';
import type { ExpenseType } from '../../types';

export const EXPENSE_LABEL: Record<ExpenseType, string> = { fuel: 'Yakıt', parking: 'Otopark', toll: 'HGS / köprü', wash: 'Yıkama', other: 'Diğer' };
const ICON: Record<ExpenseType, typeof Fuel> = { fuel: Fuel, parking: ParkingCircle, toll: Route, wash: Sparkles, other: Receipt };
const tl = (v: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);

/** Şoför ekranında masraf girişi ve bu ayki masraflar */
export function DriverExpenses({ driverId }: { driverId: string }) {
  const all = useStore((s) => s.expenses);
  const mine = all.filter((e) => e.driverId === driverId);
  const month = new Date().toISOString().slice(0, 7);
  const monthList = mine.filter((e) => e.date.startsWith(month));
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ExpenseType>('fuel');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const v = Number(amount.replace(',', '.'));
    if (!v) return notify('Tutar girin.');
    setBusy(true);
    try {
      await addExpense({ driverId, type, amount: v, note: note.trim(), date: new Date().toISOString().slice(0, 10) });
      setAmount('');
      setNote('');
      setOpen(false);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dexp">
      <div className="dexp-h">
        <div>
          <b>Masraflarım</b>
          <small>Bu ay: {tl(monthList.reduce((a, e) => a + e.amount, 0))}</small>
        </div>
        <button className="dexp-add" onClick={() => setOpen((o) => !o)}><Plus size={18} /> Masraf</button>
      </div>
      {open && (
        <div className="dexp-form">
          <div className="dexp-types">
            {(Object.keys(EXPENSE_LABEL) as ExpenseType[]).map((k) => {
              const I = ICON[k];
              return (
                <button key={k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>
                  <I size={18} /> {EXPENSE_LABEL[k]}
                </button>
              );
            })}
          </div>
          <div className="dlg-in">
            <input inputMode="decimal" placeholder="Tutar" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <span>₺</span>
          </div>
          <input className="dexp-note" placeholder="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="drv-big" disabled={busy} onClick={save}>{busy && <Loader2 size={18} className="spin" />} Kaydet</button>
        </div>
      )}
      {monthList.length > 0 && (
        <ul className="ledger">
          {monthList.slice(0, 8).map((e) => {
            const I = ICON[e.type];
            const recent = Date.now() - Date.parse(e.at) < 864e5;
            return (
              <li key={e.id}>
                <span>{e.date.split('-').reverse().slice(0, 2).join('.')}</span>
                <span><I size={14} /> {EXPENSE_LABEL[e.type]}{e.note && <small> · {e.note}</small>}</span>
                <b>{tl(e.amount)}</b>
                {recent ? <button className="aicon" aria-label="Sil" onClick={() => deleteExpense(e.id, 'driver').catch((x) => notify(x.message))}><Trash2 size={14} /></button> : <span />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
