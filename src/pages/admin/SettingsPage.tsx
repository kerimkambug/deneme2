import { ask, notify } from '../../components/dialog';
import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw } from 'lucide-react';
import { REMOTE, exportJson, importJson, resetDemo, storageUsageKb, update, useStore } from '../../data/store';
import type { Settings } from '../../types';
import { Field, ImageInput, L10nInput, PageHead, toast } from './ui';

export function SettingsPage() {
  const s = useStore((x) => x.settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update((x) => { x.settings[k] = v; });
  const file = useRef<HTMLInputElement>(null);
  const [pw, setPw] = useState('');

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vip-transfer-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <PageHead title="Ayarlar" desc="Firma bilgileri, marka ve yedekleme." />
      <div className="apanel aform">
        <h4 className="wide">Firma & iletişim</h4>
        <Field label="Firma adı"><input value={s.companyName} onChange={(e) => set('companyName', e.target.value)} /></Field>
        <Field label="Kısa ad (logoda)"><input value={s.shortName} onChange={(e) => set('shortName', e.target.value)} /></Field>
        <Field label="Telefon"><input value={s.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="WhatsApp numarası" hint="Ülke koduyla, ör. 905551112233"><input value={s.whatsapp} onChange={(e) => set('whatsapp', e.target.value.replace(/[^\d]/g, ''))} /></Field>
        <Field label="E-posta"><input value={s.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Instagram"><input value={s.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@kullaniciadi" /></Field>
        <Field label="Adres" wide><input value={s.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Belge / lisans bilgisi" hint="ör. D2 Yetki Belgesi No, TÜRSAB No" wide><input value={s.licenseNo} onChange={(e) => set('licenseNo', e.target.value)} /></Field>

        <h4 className="wide">Marka</h4>
        <L10nInput label="Logo altı yazı" value={s.tagline} onChange={(v) => set('tagline', v)} />
        <ImageInput label="Logo" value={s.logo} onChange={(v) => set('logo', v)} hint="Kare veya yatay, şeffaf PNG / SVG önerilir" />
        <Field label="Vurgu rengi">
          <div className="inline">
            <input type="color" value={s.accent} onChange={(e) => set('accent', e.target.value)} />
            <input value={s.accent} onChange={(e) => set('accent', e.target.value)} />
            {['#c8a96a', '#b8c4d6', '#d4a373', '#9fb8a5', '#c9a0a0'].map((c) => (
              <button key={c} className="swatch" style={{ background: c }} onClick={() => set('accent', c)} aria-label={c} />
            ))}
          </div>
        </Field>

        <h4 className="wide">Harita & adres arama</h4>
        <Field
          label="Google Maps API anahtarı"
          wide
          hint="Girildiğinde adres/otel arama, harita ve canlı takip Google ile çalışır. Boş bırakılırsa ücretsiz OpenStreetMap kullanılır. Google Cloud'da Maps JavaScript API, Places API (New) ve Geocoding API açık olmalı; anahtarı sitenizin adresiyle sınırlayın."
        >
          <div className="inline">
            <input value={s.googleMapsKey} onChange={(e) => set('googleMapsKey', e.target.value.trim())} placeholder="AIza…" autoComplete="off" spellCheck={false} />
            {s.googleMapsKey && <span className="pill">Google aktif</span>}
          </div>
        </Field>

        <Field label="Google yorum bağlantısı" wide hint="Google İşletme Profili → “Yorum iste” bağlantısı. 4-5 yıldız veren müşteriler buraya yönlendirilir.">
          <input value={s.googleReviewUrl} onChange={(e) => set('googleReviewUrl', e.target.value.trim())} placeholder="https://g.page/r/..." />
        </Field>

        <h4 className="wide">Güvenlik</h4>
        <Field label="Yeni panel şifresi">
          <div className="inline">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button className="abtn" onClick={() => { if (pw.length < 6) return notify('En az 6 karakter.'); set('adminPassword', pw); setPw(''); toast('Şifre değişti'); }}>Değiştir</button>
          </div>
        </Field>
      </div>

      <div className="apanel">
        <h4>Yedekleme</h4>
        <p className="muted small">{REMOTE ? 'Veriler sunucuda saklanır. Yedek dosyasıyla tüm ayarları ve rezervasyonları indirip saklayabilirsiniz.' : `Bu demo sürüm verileri tarayıcıda saklar (${storageUsageKb()} KB kullanılıyor). Yedek dosyasıyla tüm ayarlarınızı başka bir cihaza taşıyabilirsiniz.`}</p>
        <div className="row-gap">
          <button className="abtn" onClick={download}><Download size={16} /> Yedek indir</button>
          <button className="abtn" onClick={() => file.current?.click()}><Upload size={16} /> Yedekten yükle</button>
          {!REMOTE && (<button className="abtn abtn-danger" onClick={async () => (await ask('Tüm veriler silinip demo verileri yüklensin mi?', { danger: true, okText: 'Sıfırla' })) && (resetDemo(), toast('Demo verileri yüklendi'))}><RotateCcw size={16} /> Demoya sıfırla</button>)}
          <input
            ref={file}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                importJson(await f.text());
                toast('Yedek yüklendi');
              } catch (x) {
                notify((x as Error).message);
              }
            }}
          />
        </div>
      </div>
    </>
  );
}
