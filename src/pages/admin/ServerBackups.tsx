import { useEffect, useRef, useState } from 'react';
import { Download, Upload, Save, History } from 'lucide-react';
import { ask, notify } from '../../components/dialog';
import { authedGet, authedPost } from '../../data/store';
import { toast } from './ui';

interface BackupInfo {
  id: string;
  at: string;
  reason: string;
  size: number;
  bookings: number;
  customers: number;
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });

function save(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const WARN =
  'Sitedeki TÜM veriler (ayarlar, rezervasyonlar, müşteri hesapları, mesajlar, kasa) bu yedekteki hale döner. Yedekten sonra yapılan her şey silinir.\n\nGeri yüklemeden önce şimdiki durumun yedeği otomatik alınır.';

/** Sunucu modunda tam yedekleme: indir, geri yükle, otomatik yedekler */
export function ServerBackups() {
  const [list, setList] = useState<BackupInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const load = () => authedGet<BackupInfo[]>('admin', '/api/admin/backups').then(setList, () => setList([]));
  useEffect(() => {
    void load();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const downloadFull = () =>
    run(async () => {
      const data = await authedGet('admin', '/api/admin/backup');
      save(data, `vip-transfer-yedek-${new Date().toISOString().slice(0, 10)}.json`);
      toast('Yedek indirildi');
    });

  const restore = async (url: string, body: unknown, label: string) => {
    if (!(await ask(`${label}\n\n${WARN}`, { danger: true, okText: 'Geri yükle', title: 'Yedeği geri yükle' }))) return;
    await run(async () => {
      await authedPost('admin', url, body);
      toast('Yedek geri yüklendi, sayfa yenileniyor');
      setTimeout(() => location.reload(), 800);
    });
  };

  return (
    <div className="apanel">
      <h4>Yedekleme</h4>
      <p className="muted small">
        Tam yedek; ayarları, rezervasyonları, müşteri hesaplarını (şifreleriyle), şoför–yolcu mesajlarını, kasa kayıtlarını ve bildirim aboneliklerini içerir. Dosyayı güvenli bir yerde saklayın:
        müşteri bilgileri içerir.
      </p>
      <div className="row-gap">
        <button className="abtn" disabled={busy} onClick={downloadFull}><Download size={16} /> Tam yedek indir</button>
        <button className="abtn" disabled={busy} onClick={() => file.current?.click()}><Upload size={16} /> Dosyadan geri yükle</button>
        <button
          className="abtn"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await authedPost('admin', '/api/admin/backups', {});
              await load();
              toast('Yedek alındı');
            })
          }
        >
          <Save size={16} /> Şimdi yedek al
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            let data: unknown;
            try {
              data = JSON.parse(await f.text());
            } catch {
              return notify('Dosya okunamadı. Bir yedek dosyası (.json) seçin.');
            }
            const d = data as { format?: string; createdAt?: string };
            if (d.format !== 'vip-transfer-backup') return notify('Bu dosya bir tam yedek değil. Yalnızca “Tam yedek indir” ile alınan dosyalar geri yüklenebilir.');
            await restore('/api/admin/restore', data, `“${f.name}” (${d.createdAt ? when(d.createdAt) : 'tarih yok'}) geri yüklensin mi?`);
          }}
        />
      </div>

      <h4 style={{ marginTop: 22 }}><History size={16} style={{ verticalAlign: '-3px' }} /> Otomatik yedekler</h4>
      <p className="muted small">
        Her gece 03:00’ten sonra otomatik yedek alınır, son 7 gece saklanır. Bu yedekler aynı veritabanında durur; veritabanının kendisine bir şey olursa diye ayda bir “Tam yedek indir” ile bilgisayarınıza da alın.
      </p>
      {list === null ? (
        <p className="muted small">Yükleniyor…</p>
      ) : list.length === 0 ? (
        <p className="muted small">Henüz otomatik yedek yok. İlki bu gece alınacak.</p>
      ) : (
        <div className="bk-list">
          {list.map((b) => (
            <div key={b.id} className="bk-row">
              <div>
                <b>{when(b.at)}</b>
                <small>
                  {b.reason === 'gece' ? 'Gece (otomatik)' : b.reason === 'elle' ? 'Elle alındı' : b.reason} · {b.bookings} rezervasyon · {b.customers} müşteri · {kb(b.size)}
                </small>
              </div>
              <div className="row-gap">
                <button
                  className="abtn abtn-sm"
                  disabled={busy}
                  onClick={() => run(async () => save(await authedGet('admin', `/api/admin/backups/${b.id}`), `vip-transfer-yedek-${b.at.slice(0, 10)}.json`))}
                >
                  <Download size={14} /> İndir
                </button>
                <button className="abtn abtn-sm abtn-danger" disabled={busy} onClick={() => restore(`/api/admin/backups/${b.id}/restore`, {}, `${when(b.at)} tarihli yedek geri yüklensin mi?`)}>
                  Geri yükle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
