import { ask, notify } from '../../components/dialog';
import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { uid, update, useStore } from '../../data/store';
import { SERVICE_ICONS } from '../../components/icons';
import type { Settings } from '../../types';
import { Field, ImageInput, L10nInput, PageHead, Toggle } from './ui';

const blank = () => ({ tr: '', en: '', ru: '', de: '', pl: '' });

function useSettings() {
  const s = useStore((x) => x.settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    const ok = update((x) => { x.settings[k] = v; });
    if (!ok) notify('Kaydedilemedi: depolama alanı doldu. Daha küçük görsel kullanın.');
  };
  return { s, set };
}

function ListEditor<T extends { id: string }>({ items, onChange, render, make, addLabel }: { items: T[]; onChange: (v: T[]) => void; render: (it: T, set: (p: Partial<T>) => void) => React.ReactNode; make: () => T; addLabel: string }) {
  const move = (i: number, d: number) => { const n = [...items]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); };
  return (
    <div className="listed">
      {items.map((it, i) => (
        <div key={it.id} className="listed-item">
          <div className="listed-ctl">
            <button className="aicon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Yukarı"><ArrowUp size={15} /></button>
            <button className="aicon" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Aşağı"><ArrowDown size={15} /></button>
            <button className="aicon" onClick={async () => (await ask('Silinsin mi?')) && onChange(items.filter((x) => x.id !== it.id))} aria-label="Sil"><Trash2 size={15} /></button>
          </div>
          <div className="aform">{render(it, (p) => onChange(items.map((x) => (x.id === it.id ? { ...x, ...p } : x))))}</div>
        </div>
      ))}
      <button className="abtn" onClick={() => onChange([...items, make()])}><Plus size={16} /> {addLabel}</button>
    </div>
  );
}

function ReceivedReviews() {
  const st = useStore((x) => x);
  const got = st.bookings.filter((b) => b.review).sort((a, b) => b.review!.at.localeCompare(a.review!.at));
  const avg = got.length ? got.reduce((a, b) => a + b.review!.rating, 0) / got.length : 0;
  const publish = (id: string) =>
    update((s) => {
      const b = s.bookings.find((x) => x.id === id);
      if (!b?.review) return;
      const parts = b.customer.name.trim().split(/\s+/);
      s.settings.testimonials.unshift({
        id: uid('t'),
        name: parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0],
        country: b.lang.toUpperCase(),
        rating: b.review.rating,
        text: b.review.text,
      });
      b.review.published = true;
    });
  return (
    <div className="apanel">
      <div className="apanel-h">
        <h3>Gelen değerlendirmeler</h3>
        {got.length > 0 && <span className="pill">Ortalama {avg.toFixed(1)} ★ · {got.length} yorum</span>}
      </div>
      {got.length === 0 && <p className="empty">Henüz değerlendirme yok. Transfer tamamlanınca müşteri takip sayfasından puan verebilir.</p>}
      <ul className="rv-list">
        {got.map((b) => (
          <li key={b.id}>
            <div>
              <b>{'★'.repeat(b.review!.rating)}{'☆'.repeat(5 - b.review!.rating)}</b> <span className="muted">{b.customer.name} · {b.code} · {st.drivers.find((d) => d.id === b.driverId)?.name ?? '—'}</span>
              {b.review!.text ? <p>“{b.review!.text}”</p> : <p className="muted">(yorum yazılmadı)</p>}
            </div>
            {b.review!.published ? (
              <span className="pill">Sitede</span>
            ) : (
              <button className="abtn abtn-sm" disabled={!b.review!.text} onClick={() => publish(b.id)}>Sitede yayınla</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Content() {
  const { s, set } = useSettings();
  const [tab, setTab] = useState<'hero' | 'about' | 'services' | 'reviews' | 'faq' | 'legal'>('hero');
  return (
    <>
      <PageHead title="Site İçeriği" desc="Değişiklikler anında sitede görünür. Her metni Türkçe, İngilizce ve Rusça girebilirsiniz (boş dil Türkçeye düşer)." />
      <div className="tabs tabs-lg">
        {([['hero', 'Giriş bölümü'], ['about', 'Hakkımızda & rakamlar'], ['services', 'Hizmetler'], ['reviews', 'Yorumlar'], ['faq', 'SSS'], ['legal', 'Yasal metinler']] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'legal' && (
        <div className="apanel aform">
          <p className="awarn wide">Bu metin bir taslaktır. Yayına almadan önce bir avukata veya KVKK danışmanına kontrol ettirin. {'{UNVAN}'}, {'{ADRES}'}, {'{EPOSTA}'} alanları Ayarlar’daki bilgilerle otomatik doldurulur.</p>
          <Field label="Firma unvanı (resmi)" hint="ör. Aurea Turizm Taşımacılık Ltd. Şti."><input value={s.legalName} onChange={(e) => set('legalName', e.target.value)} /></Field>
          <L10nInput label="KVKK aydınlatma metni / gizlilik politikası (## ile başlayan satırlar başlık olur)" value={s.privacyText} onChange={(v) => set('privacyText', v)} multiline rows={18} />
        </div>
      )}

      {tab === 'hero' && (
        <div className="apanel aform">
          <L10nInput label="Üst başlık / slogan" value={s.tagline} onChange={(v) => set('tagline', v)} />
          <L10nInput label="Başlık" value={s.heroTitle} onChange={(v) => set('heroTitle', v)} />
          <L10nInput label="Başlık vurgu (altın renkli kısım)" value={s.heroAccent} onChange={(v) => set('heroAccent', v)} />
          <L10nInput label="Alt metin" value={s.heroSubtitle} onChange={(v) => set('heroSubtitle', v)} multiline />
          <ImageInput label="Arka plan görseli" value={s.heroImage} onChange={(v) => set('heroImage', v)} hint="Yatay, en az 1600px genişlik önerilir. Boşsa animasyonlu tema arka planı kullanılır." />
        </div>
      )}

      {tab === 'about' && (
        <>
          <div className="apanel aform">
            <L10nInput label="Hakkımızda başlığı" value={s.aboutTitle} onChange={(v) => set('aboutTitle', v)} />
            <L10nInput label="Hakkımızda metni" value={s.aboutText} onChange={(v) => set('aboutText', v)} multiline rows={5} />
            <ImageInput label="Hakkımızda görseli" value={s.aboutImage} onChange={(v) => set('aboutImage', v)} />
          </div>
          <h3 className="sub">Ana sayfa rakamları</h3>
          <ListEditor
            items={s.stats}
            onChange={(v) => set('stats', v)}
            addLabel="Rakam ekle"
            make={() => ({ id: uid('st'), value: 100, suffix: '+', decimals: false, label: blank() })}
            render={(it, p) => (
              <>
                <Field label="Değer"><input type="number" step="0.1" value={it.value} onChange={(e) => p({ value: +e.target.value })} /></Field>
                <Field label="Ek (+, /7, ★)"><input value={it.suffix} onChange={(e) => p({ suffix: e.target.value })} /></Field>
                <Field label="Ondalıklı"><Toggle checked={it.decimals} onChange={(v) => p({ decimals: v })} /></Field>
                <L10nInput label="Etiket" value={it.label} onChange={(v) => p({ label: v })} />
              </>
            )}
          />
        </>
      )}

      {tab === 'services' && (
        <ListEditor
          items={s.services}
          onChange={(v) => set('services', v)}
          addLabel="Hizmet ekle"
          make={() => ({ id: uid('s'), icon: 'car', title: blank(), desc: blank() })}
          render={(it, p) => (
            <>
              <Field label="İkon">
                <select value={it.icon} onChange={(e) => p({ icon: e.target.value })}>
                  {Object.entries(SERVICE_ICONS).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
                </select>
              </Field>
              <L10nInput label="Başlık" value={it.title} onChange={(v) => p({ title: v })} />
              <L10nInput label="Açıklama" value={it.desc} onChange={(v) => p({ desc: v })} multiline rows={2} />
            </>
          )}
        />
      )}

      {tab === 'reviews' && (
        <>
          <ReceivedReviews />
          <h3 className="sub">Sitede gösterilen yorumlar</h3>
          <p className="awarn">Başlangıçtaki yorumlar örnektir. Yayına almadan önce silin; gelen gerçek değerlendirmeleri yukarıdan tek tıkla yayınlayabilirsiniz.</p>
          <ListEditor
            items={s.testimonials}
            onChange={(v) => set('testimonials', v)}
            addLabel="Yorum ekle"
            make={() => ({ id: uid('t'), name: '', country: 'TR', rating: 5, text: '' })}
            render={(it, p) => (
              <>
                <Field label="Ad"><input value={it.name} onChange={(e) => p({ name: e.target.value })} /></Field>
                <Field label="Ülke"><input value={it.country} onChange={(e) => p({ country: e.target.value.toUpperCase() })} /></Field>
                <Field label="Puan"><select value={it.rating} onChange={(e) => p({ rating: +e.target.value })}>{[5, 4, 3].map((n) => <option key={n}>{n}</option>)}</select></Field>
                <Field label="Yorum (yazıldığı dilde)" wide><textarea rows={3} value={it.text} onChange={(e) => p({ text: e.target.value })} /></Field>
              </>
            )}
          />
        </>
      )}

      {tab === 'faq' && (
        <ListEditor
          items={s.faqs}
          onChange={(v) => set('faqs', v)}
          addLabel="Soru ekle"
          make={() => ({ id: uid('f'), q: blank(), a: blank() })}
          render={(it, p) => (
            <>
              <L10nInput label="Soru" value={it.q} onChange={(v) => p({ q: v })} />
              <L10nInput label="Cevap" value={it.a} onChange={(v) => p({ a: v })} multiline rows={3} />
            </>
          )}
        />
      )}
    </>
  );
}
