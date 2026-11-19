
/** Google Maps JavaScript API yükleyici. Anahtar panelden (Ayarlar) girilir. */
let promise: Promise<typeof google.maps> | null = null;
let loadedKey = '';
let authFailed = false;
/** Kota dolması vb. geçici hatalarda Google bu zamana kadar kullanılmaz */
let downUntil = 0;

let keyGetter: () => string = () => '';
/** Veri katmanı anahtarı buradan sağlar (sunucu kodu bu modülü güvenle içe aktarabilsin diye) */
export function registerKeyGetter(fn: () => string) {
  keyGetter = fn;
}

export function gmapsKey(): string {
  return authFailed || Date.now() < downUntil ? '' : (keyGetter() || '').trim();
}

/** Google hata verdi (ör. günlük kota doldu): bir süre ücretsiz servise geç */
export function markGoogleDown(ms = 30 * 60e3) {
  if (Date.now() < downUntil) return;
  downUntil = Date.now() + ms;
  console.warn('[maps] Google yanıt vermedi; geçici olarak OpenStreetMap kullanılacak');
  window.dispatchEvent(new CustomEvent('vip:maps-fallback'));
}

export function usingGoogle() {
  return !!gmapsKey();
}

export function loadGoogle(lang = 'tr'): Promise<typeof google.maps> {
  const key = gmapsKey();
  if (!key) return Promise.reject(new Error('Google Maps anahtarı yok'));
  if (promise && loadedKey === key) return promise;
  loadedKey = key;
  promise = new Promise((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    const cb = `__gmaps_cb_${Date.now()}`;
    w[cb] = () => resolve(google.maps);
    // Anahtar hatalı / yetkisizse Google bu fonksiyonu çağırır
    w.gm_authFailure = () => {
      authFailed = true;
      console.warn('[maps] Google Maps anahtarı reddedildi; OpenStreetMap kullanılacak');
      window.dispatchEvent(new CustomEvent('vip:maps-fallback'));
    };
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=places,marker,geocoding&language=${lang}&region=TR&loading=async&callback=${cb}`;
    s.onerror = () => {
      promise = null;
      reject(new Error('Google Maps yüklenemedi'));
    };
    document.head.appendChild(s);
  });
  return promise;
}

export const GOOGLE_MAP_ID = 'DEMO_MAP_ID';
