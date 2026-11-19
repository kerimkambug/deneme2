# Yapılacaklar (TODO)

Bu liste, sistemde **şu an eklenemeyen** işleri içerir. Her maddede neden beklediği ve kimden ne gerektiği yazılıdır.

> Durum işaretleri: ☐ yapılacak · ⏳ karar/bilgi bekleniyor · 💳 ücretli hizmet gerekiyor

---

## A. Canlıya geçmeden önce (öncelikli)

- ☐ 🗄️ **Gece yedeğini site dışına göndermek** (e-posta / Google Drive): şu an gece yedekleri aynı veritabanında saklanıyor; veritabanı kaybına karşı koruma için elle indirmek gerekiyor.
- ☐ 💳 **Render ücretli plana geçiş**: ücretsiz servis 15 dk sonra uyur (ilk açılış 30-50 sn), ücretsiz veritabanı **30 gün sonra silinir**. Starter servis + Basic PostgreSQL (≈ 14 $/ay). Ücretli veritabanında günlük otomatik yedek de gelir.
- ☐ 💳 **Alan adı** (`firmaadi.com`): satın alınıp Render'a bağlanmalı (Render → Settings → Custom Domain). Ardından Google Maps anahtarı kısıtlamasına yeni adres eklenmeli.
- ☐ ⏳ **Gerçek içerik** (müşteriden): logo, araç fotoğrafları, firma unvanı/adres/telefon, D2 belge no, gerçek fiyat listesi; örnek yorumlar ve "12.500+ misafir" gibi örnek rakamlar silinmeli/değiştirilmeli.
- ☐ ⏳ **KVKK metninin hukuki kontrolü**: Panel → Site İçeriği → Yasal metinler bölümündeki taslak bir avukata/KVKK danışmanına kontrol ettirilmeli. Gerekiyorsa **VERBİS** kaydı yapılmalı.
- ☐ **Google Maps API anahtarı** girilmeli (Panel → Ayarlar). Adımlar README'de.
- ☐ **Google yorum bağlantısı** girilmeli (Panel → Ayarlar), Google İşletme Profili açılmalı.

## B. Dış hizmet / hesap gerektirenler

- ☐ 💳 **E-posta gönderimi** (Resend, Brevo, Postmark vb. + alan adı DNS ayarı):
  - Rezervasyon onay e-postası, şoför atanınca bilgilendirme
  - **Şifremi unuttum** ile e-postadan şifre sıfırlama (şu an patron panelden sıfırlıyor)
  - Patrona günlük iş özeti e-postası
- ☐ 💳 **WhatsApp Business API / SMS** ile otomatik mesaj: şu an mesajlar tek tıkla hazırlanıp elle gönderiliyor. Otomatik gönderim için Meta Business doğrulaması ve bir sağlayıcı (ör. Twilio, 360dialog, Netgsm) gerekir.
- ☐ 💳 **Otomatik uçuş takibi**: AeroDataBox / AviationStack / FlightAware API anahtarı ile iniş saatini çekip gecikmede iş saatini otomatik kaydırma ve şoförü bilgilendirme. (Şu an uçuş numarasına tıklayınca Flightradar24'te canlı durum açılıyor.)
- ☐ 💳 **Online ödeme / kapora**: iyzico veya PayTR üye işyeri başvurusu (vergi levhası, banka bilgisi) gerekir. Panelde "Online ödeme" seçeneği hazır, entegrasyon başvuru onayından sonra yapılır.
- ☐ 💳 **e-Fatura / e-Arşiv**: Paraşüt, Logo İşbaşı vb. ile otomatik fatura kesimi (mali müşavirle birlikte).
- ☐ **Görsel depolama**: yüklenen fotoğraflar şu an veritabanında. Çok görsel eklenince Cloudflare R2 / S3 gibi bir depolama servisine taşınmalı (site hızı için).
- ☐ **Ziyaretçi istatistikleri**: Google Analytics / Meta Pixel (çerez onayı bu durumda "kabul / reddet" seçenekli olacak şekilde genişletilmeli).

## C. İş kararı bekleyenler

- ☐ ⏳ **Acente / otel (B2B) paneli**: acentenin kendi girişi, rezervasyon girmesi, cari hesap ve komisyon raporu. Karar gerekenler: komisyon modeli (yüzde mi net fiyat mı), ödeme vadesi, faturalama şekli.
- ☐ ⏳ **U-ETDS tam entegrasyonu**: Bakanlık sistemine her sefer için tüm yolcuların ad-soyad, TC/pasaport no ve uyruk bilgisiyle bildirim gerekir. Rezervasyon formuna yolcu listesi alanı eklenmeli ve firmanın U-ETDS web servis yetkisi alınmalı. (Şu an Raporlar'dan sefer listesi CSV olarak indirilebiliyor.)
- ☐ ⏳ **Panel kullanıcı rolleri**: patron dışında ofis çalışanı/operasyon hesapları (ör. fiyatları göremeyen, sadece sevk yapan kullanıcı).
- ☐ ⏳ **İptal / değişiklik kuralları**: müşterinin kendi hesabından iptal veya saat değişikliği yapabilmesi; kaç saat öncesine kadar, ücret kesintisi var mı?
- ☐ ⏳ **Çoklu şehir / şube**: Antalya dışı (İstanbul, Bodrum vb.) hizmet verilecekse bölge ve fiyat yapısı şehir bazlı ayrılmalı.

## D. İleride (büyüme)

- ☐ **Yolcuya anlık bildirim**: şoför mesaj yazınca yolcunun telefonuna bildirim (şu an yolcu takip sayfası açıkken sesli uyarı alıyor). Hesaplı müşteriler için Web Push eklenebilir.
- ☐ 💳 **Mesajlarda otomatik çeviri**: serbest yazılan mesajların karşı tarafın diline otomatik çevrilmesi (Google Translate / DeepL API anahtarı gerekir). Şu an "Çevir" bağlantısı var.
- ☐ **Mesajda fotoğraf/konum gönderme** (ör. "araç burada" fotoğrafı).

- ☐ **Mağaza uygulaması (şoför)**: telefon kilitliyken de konum gönderebilmek için Android/iOS uygulaması. Şu anki web uygulamasında şoför ekranı açık kalmalı.
- ☐ **SEO**: sayfaların sunucuda hazır üretilmesi (ön-render), `sitemap.xml`, yapısal veri (LocalBusiness), her güzergâh için ayrı açılış sayfası ("Antalya Havalimanı – Belek transfer").
- ☐ **Sadakat programı**: tekrar gelen müşteriye otomatik indirim kodu.
- ☐ **Yapay zekâ destekli WhatsApp asistanı**: gelen mesajlara fiyat ve müsaitlik yanıtı.

---

## ✔ Bu sürümde eklenenler
- Patron ve şoför için **anlık bildirimler** (telefona ana ekran bildirimi) + panel açıkken sesli uyarı
- **KVKK aydınlatma metni / gizlilik** sayfası (panelden düzenlenir) ve çerez bildirimi
- **Yolculuk sonrası değerlendirme**, Google yorum yönlendirmesi, panelden tek tıkla sitede yayınlama, şoför puan ortalaması
- **Sezon fiyatları** ve **indirim kodları** (son tarih, kullanım sınırı, bağlantıyla paylaşım)
- **Araç evrak takibi** (muayene, sigorta, kasko) ve 30 gün kala uyarı
- **Şoför masrafları ve kasa** (tahsilat − masraf − teslim = bakiye)
- **Raporlar** (ciro, şoför/güzergâh/araç/dil dağılımı) ve **CSV dışa aktarım** (sefer listesi, tüm rezervasyonlar)
- Uçuş numarasından **canlı uçuş durumu** bağlantısı
- **Almanca ve Lehçe** dil desteği
- **Şoför–yolcu mesajlaşması** (şoför atanınca açılır, transfer bitince kapanır; hazır mesajlar karşı tarafın dilinde)
