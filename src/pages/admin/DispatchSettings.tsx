import { update, useStore } from '../../data/store';
import type { Settings } from '../../types';
import { Toggle } from './ui';

const MODES: { k: Settings['dispatchMode']; t: string; d: string }[] = [
  { k: 'manual', t: 'Sadece patron atar', d: 'Şoförler yalnızca kendilerine atanan işleri görür. Havuz kapalı.' },
  { k: 'hybrid', t: 'Havuz + kalanı patron atar', d: 'Onaylı işler havuza düşer, şoförler alır. Alış saatine belirlenen süre kala alınmamış iş havuzdan çıkar, size bildirim gelir, siz atarsınız.' },
  { k: 'pool', t: 'Tam havuz', d: 'Onaylı işler havuza düşer ve alış saatine kadar orada kalır. Süre yaklaşınca alınmamış işler için yine size bildirim gelir.' },
];

/** İş dağıtım modu: patron ataması / havuz / karma */
export function DispatchSettings() {
  const s = useStore((x) => x.settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update((x) => { x.settings[k] = v; });
  const mode = s.dispatchMode || 'manual';
  return (
    <div className="apanel">
      <h4>İş dağıtımı</h4>
      <p className="muted small">İşlerin şoförlere nasıl gideceğini seçin. Her modda siz istediğiniz işi doğrudan bir şoföre atayabilirsiniz.</p>
      <div className="mode-cards" role="radiogroup" aria-label="İş dağıtım modu">
        {MODES.map((m) => (
          <button key={m.k} role="radio" aria-checked={mode === m.k} className={`mode-card ${mode === m.k ? 'on' : ''}`} onClick={() => set('dispatchMode', m.k)}>
            <b>{m.t}</b>
            <small>{m.d}</small>
          </button>
        ))}
      </div>
      {mode !== 'manual' && (
        <div className="aform" style={{ marginTop: 14 }}>
          <label className="afld">
            <span>{mode === 'hybrid' ? 'Alış saatine kaç saat kala havuzdan çıksın (saat)' : 'Alış saatine kaç saat kala uyarı gelsin (saat)'}</span>
            <input type="number" min={0} max={72} step={0.5} value={s.poolCutoffHours} onChange={(e) => set('poolCutoffHours', Math.max(0, Math.min(72, Number(e.target.value) || 0)))} />
          </label>
          <div className="afld">
            <span>Onay</span>
            <Toggle checked={!!s.poolSkipConfirm} onChange={(v) => set('poolSkipConfirm', v)} label="Onayımı beklemeden havuza düşsün" />
          </div>
        </div>
      )}
      {mode !== 'manual' && (
          <p className="muted small" style={{ marginTop: 12 }}>
            Havuzda şoförler tarih, güzergâh, araç, kişi/bagaj sayısı ve ücreti görür. Müşterinin adı ve telefonu iş alınınca açılır. Şoföre bir araç tipi tanımlıysa yalnızca o tipteki işleri görür. Fiyatı belli olmayan (teklif bekleyen) işler havuza düşmez. Bir işi havuza açmak istemezseniz rezervasyon detayından “Havuzdan çıkar” deyin.
          </p>
      )}
    </div>
  );
}
