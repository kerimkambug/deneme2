# VIP Transfer — Web Sitesi, Yönetim Paneli ve Şoför Uygulaması

Havalimanı / otel transferi yapan VIP taşımacılık firmaları için hazırlanmış, her şeyi panelden özelleştirilebilen tek parça sistem.

| Adres | Kim kullanır | Ne yapar |
|---|---|---|
| `/` | Müşteri | Anında fiyat, 4 adımda rezervasyon, filo, fiyat listesi, SSS (TR / EN / RU, EUR / TRY / USD / GBP) |
| `/hesap` | Müşteri | Hesap aç / giriş (e-posta veya telefon), yaklaşan & geçmiş yolculuklar, canlı takip, kodla rezervasyon ekleme |
| `/takip/KOD` | Müşteri | Rezervasyon durumu, şoför adı/plaka/telefon, canlı durum çizelgesi |
| `/panel` | Patron / ofis | Özet, sevk planı (sürükle-bırak), rezervasyonlar, araçlar, bölgeler & fiyatlar, şoförler, site içeriği, ayarlar |
| `/surucu` | Şoför | Günün işleri, tek tuşla durum güncelleme, tam ekran isim tabelası, navigasyon, tahsilat |

Demo (tarayıcı) sürümü girişleri: panel şifresi `admin123`, şoför PIN'i `1234`. Sunucu kurulumunda panel şifresi `ADMIN_PASSWORD` ile belirlenir; şoförler **Panel → Şoförler** bölümünden eklenir ve giriş bilgileri WhatsApp'tan iletilebilir.

## Konum sistemi
- Müşteri **Nereden / Nereye** için otel, adres veya havalimanı arar (OpenStreetMap / Photon), **“Konumumu kullan”** ile GPS konumunu alır veya **haritada iğneyle** işaretler (Leaflet + OpenStreetMap altlık). API anahtarı gerekmez.
- Seçilen nokta, panelde tanımlı bölge merkezlerine ve yarıçaplarına göre otomatik bir **bölgeye** eşlenir; o güzergâh fiyat tablosunda varsa **sabit fiyat**, yoksa aracın **km ücreti** (en düşük ücretle) uygulanır.
- Şoför ekranında “Alışa git / Varışa git” doğrudan koordinata Google Maps yol tarifi açar; şoföre giden WhatsApp mesajında da harita linkleri bulunur.
- **Google Haritalar:** Panel → Ayarlar → *Google Maps API anahtarı* girildiğinde arama (Places API New), adres çözme (Geocoding), harita seçici ve canlı takip haritası Google'a geçer; anahtar boşsa veya reddedilirse otomatik olarak OpenStreetMap'e döner. Render'da `GOOGLE_MAPS_KEY` ortam değişkeniyle de verilebilir.
  Google Cloud'da açılması gerekenler: **Maps JavaScript API, Places API (New), Geocoding API**. Anahtarı *Websites* kısıtıyla yalnızca sitenizin adresine sınırlayın.

## Panelden özelleştirilebilenler
- **Araçlar:** ad, kategori, yolcu & bavul kapasitesi, saatlik ücret, açıklama, özellikler, görsel galerisi, sıralama, gizle/göster
- **Fiyatlar:** havalimanı/bölge listesi, güzergâh × araç fiyat tablosu, toplu % zam/indirim, popüler güzergâhlar, km/süre
- **Kurallar:** gidiş-dönüş indirimi, gece ücreti, ücretsiz bekleme, en erken rezervasyon süresi, döviz kurları, ödeme yöntemleri
- **Ekstralar:** bebek koltuğu, ara durak, çiçek… (fiyat, adet)
- **İçerik:** başlıklar, hizmetler, rakamlar, yorumlar, SSS, hakkımızda — hepsi 3 dilde; logo, arka plan görselleri, vurgu rengi
- **Firma:** iletişim, WhatsApp, belge no, Instagram, panel şifresi, yedek al/yükle

## Geliştirme
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ klasörüne üretim çıktısı
npm run build:demo # Site / Panel / Şoför geçiş çubuklu sunum sürümü (dist-demo/)
```

Cloudflare Pages / Netlify: build komutu `npm run build`, çıktı klasörü `dist`. (`public/_redirects` SPA yönlendirmesini içerir.)

## Render'a kurulum (gerçek sistem)
Sunucu modunda veriler Render'daki PostgreSQL'de durur; müşteri, patron ve şoför ekranları WebSocket ile **anlık** güncellenir.

1. render.com → **New → Blueprint** → bu GitHub deposunu seçin (`render.yaml` otomatik okunur).
2. Sorulduğunda **ADMIN_PASSWORD** (panel şifresi) girin → **Apply**.
3. Kurulum bitince `https://vip-transfer.onrender.com` gibi bir adres verilir.

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | Render veritabanından otomatik gelir |
| `SECRET` | Oturum imzalama anahtarı (otomatik üretilir) |
| `ADMIN_PASSWORD` | İlk panel şifresi (sonra panelden değiştirilebilir) |
| `SEED_DEMO` | `1` ise ilk açılışta örnek şoför ve rezervasyonlar yüklenir (gerçek kurulumda eklemeyin) |

Ücretsiz planda servis 15 dk kullanılmazsa uyur (ilk açılış ~30-50 sn) ve ücretsiz veritabanı 30 gün sonra silinir. Canlı kullanım için Starter servis + Basic veritabanı önerilir.

Yerelde sunucu modu: `npm run build:remote && ADMIN_PASSWORD=gizli123 npm start` → http://localhost:8080 (DATABASE_URL yoksa veriler `data/db.json` dosyasına yazılır).

### Müşteri hesapları
- Müşteri rezervasyonun son adımında tek tıkla hesap açar (e-posta + şifre) ya da `/hesap` sayfasından kayıt olur; giriş e-posta **veya telefon** ile yapılır.
- Hesabım sayfasında yaklaşan/geçmiş yolculuklar anlık güncellenir; şoför yola çıkınca **Canlı takip** butonu belirir.
- Hesapsız yapılan rezervasyonlar rezervasyon koduyla hesaba eklenebilir (kod gizli olduğu için başkası sahiplenemez).
- Panel → **Müşteriler**: kayıtlı müşteriler, yolculuk sayısı, harcama; şifresini unutan müşteriye yeni şifre verilip WhatsApp'tan iletilebilir.
- Şifreler sunucuda scrypt ile saklanır. (E-posta ile şifre sıfırlama, bir e-posta servisi bağlandığında eklenebilir.)

### Canlı şoför konumu
- Şoför, şoför ekranındaki **Canlı konum paylaşımı** anahtarıyla izin verir; paylaşım yalnızca **Yola çıktım → Müşteri araçta** arasında ve transfer bitene kadar sürer, iş bitince kendiliğinden kapanır.
- Müşteri takip sayfasında aracı haritada ve **tahmini varış süresini** görür; patron panelde tüm aktif araçları canlı haritada izler.
- Web uygulaması olduğu için şoför ekranı yolculuk boyunca açık kalmalıdır (ekranın kararması engellenir).

## Mimari notu (canlıya geçiş)
İki çalışma modu vardır: **demo** (`npm run build`, `build:demo`) verileri tarayıcıda tutar; **sunucu** (`npm run build:remote` + `npm start`) Render'daki Node sunucusu ve PostgreSQL ile çalışır. Ekranlar her iki modda aynıdır; fark yalnızca `src/data/store.ts` içindedir. Sunucu kodu `server/` klasöründedir; fiyat sunucuda yeniden hesaplanır, panel şifresi ve şoför PIN'leri tarayıcıya gönderilmez.

Canlıya geçişte yapılacaklar:
1. Görselleri veritabanı yerine bir depolama servisine (ör. Cloudflare R2) taşıma
3. Rezervasyon bildirimleri: e-posta + WhatsApp Business API
4. İsteğe bağlı: online ödeme (iyzico / PayTR), uçuş takip API'si, U-ETDS listesi dışa aktarımı, acente (B2B) portalı
5. SEO: sayfa ön-render (SSG), sitemap, yapısal veri (LocalBusiness)

> Başlangıçtaki firma adı, fiyatlar, rakamlar ve müşteri yorumları **örnektir**; yayına almadan önce panelden gerçekleriyle değiştirin.
