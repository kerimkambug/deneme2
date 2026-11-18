import type { AppState, Booking, BookingStatus, L10n, RoutePrice } from '../types';

const l = (tr: string, en: string, ru: string, de = '', pl = ''): L10n => ({ tr, en, ru, de, pl });

export const STATE_VERSION = 3;

/** Örnek fiyatlar (EUR, tek yön, Vito baz). Gerçek fiyatlar panelden girilir. */
const AYT_ROUTES: [string, number, number, number][] = [
  // bölge id, Vito fiyatı, süre (dk), km
  ['lara', 30, 20, 14],
  ['merkez', 30, 25, 15],
  ['konyaalti', 35, 35, 25],
  ['belek', 40, 35, 35],
  ['kadriye', 45, 40, 40],
  ['side', 55, 60, 65],
  ['manavgat', 55, 60, 70],
  ['okurcalar', 70, 85, 100],
  ['alanya', 85, 110, 125],
  ['mahmutlar', 90, 125, 140],
  ['beldibi', 45, 45, 45],
  ['kemer', 55, 60, 55],
  ['tekirova', 60, 70, 70],
  ['kas', 150, 210, 190],
];

const GZP_ROUTES: [string, number, number, number][] = [
  ['alanya', 40, 40, 40],
  ['mahmutlar', 35, 30, 30],
  ['okurcalar', 60, 70, 70],
  ['side', 85, 105, 110],
  ['manavgat', 80, 95, 100],
];

const FACTORS: Record<string, number> = { sedan: 1.1, vito: 1, vclass: 1.35, sprinter: 1.7 };

const mkRoute = (from: string, [to, base, dur, km]: [string, number, number, number], popular: boolean): RoutePrice => ({
  id: `${from}-${to}`,
  from,
  to,
  durationMin: dur,
  distanceKm: km,
  popular,
  prices: Object.fromEntries(Object.entries(FACTORS).map(([v, f]) => [v, Math.round((base * f) / 5) * 5])),
});

const today = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function demoBooking(
  n: number,
  p: Partial<Booking> & Pick<Booking, 'fromId' | 'toId' | 'date' | 'time' | 'vehicleId' | 'price' | 'status'>,
  name: string,
): Booking {
  const createdAt = new Date(Date.now() - n * 3600_000 * 7).toISOString();
  const flow: BookingStatus[] = ['new', 'confirmed', 'assigned', 'on_way', 'arrived', 'onboard', 'completed'];
  const idx = flow.indexOf(p.status);
  const history = (idx >= 0 ? flow.slice(0, idx + 1) : ['new', p.status]).map((s, i) => ({
    status: s as BookingStatus,
    at: new Date(Date.parse(createdAt) + i * 600_000).toISOString(),
  }));
  return {
    id: `demo-${n}`,
    code: `VT${(4821 + n * 137).toString().slice(-4)}${'ABCDEFGH'[n % 8]}`,
    createdAt,
    type: 'transfer',
    fromDetail: '',
    toDetail: '',
    roundTrip: false,
    flightNo: '',
    adults: 2,
    children: 0,
    luggage: 2,
    extras: {},
    customer: { name, phone: '+44 7700 900' + String(100 + n), email: '' },
    nameSign: name,
    notes: '',
    displayCurrency: 'EUR',
    lang: 'en',
    payment: 'cash',
    history,
    ...p,
  };
}

export function createSeed(): AppState {
  const st: AppState = {
    version: STATE_VERSION,
    settings: {
      companyName: 'Aurea VIP Transfer',
      shortName: 'AUREA',
      tagline: l('Antalya VIP Transfer', 'Antalya VIP Transfer', 'VIP-трансфер в Анталии', 'Antalya VIP-Transfer', 'Antalya VIP Transfer'),
      logo: '',
      accent: '#c8a96a',
      phone: '+90 555 000 00 00',
      whatsapp: '905550000000',
      email: 'info@ornekfirma.com',
      address: 'Muratpaşa, Antalya',
      licenseNo: 'D2 Yetki Belgesi No: ——',
      instagram: '',
      heroTitle: l('Havalimanından otelinize,', 'From the airport to your hotel,', 'Из аэропорта до вашего отеля —', 'Vom Flughafen zu Ihrem Hotel,', 'Z lotniska do Twojego hotelu,'),
      heroAccent: l('ayrıcalıklı bir yolculuk.', 'travel in quiet luxury.', 'с комфортом и заботой.', 'reisen in stillem Luxus.', 'podróż w spokojnym luksusie.'),
      heroSubtitle: l('Sabit fiyat, uçuş takibi ve isim tabelasıyla karşılama. Mercedes VIP araçlarımızla Antalya’nın her noktasına özel transfer.', 'Fixed prices, flight tracking and a personal meet & greet. Private Mercedes VIP transfers to every corner of the Antalya coast.', 'Фиксированные цены, отслеживание рейса и встреча с табличкой. Индивидуальные трансферы на Mercedes VIP по всему побережью Анталии.', 'Festpreise, Flugüberwachung und persönlicher Empfang. Private Mercedes-VIP-Transfers an jeden Ort der Küste von Antalya.', 'Stałe ceny, śledzenie lotu i osobiste powitanie. Prywatne transfery VIP Mercedesem w każde miejsce wybrzeża Antalii.'),
      heroImage: '',
      aboutTitle: l('Yolculuğunuz, bizim imzamız.', 'Your journey carries our signature.', 'Ваша поездка — наша репутация.', 'Ihre Reise trägt unsere Handschrift.', 'Twoja podróż to nasza wizytówka.'),
      aboutText: l('Antalya’da yıllardır misafirlerimizi havalimanından otellerine, iş toplantılarından özel davetlere güvenle taşıyoruz. Profesyonel, çok dilli şoförlerimiz ve düzenli bakımdan geçen araçlarımızla her transferi zamanında, temiz ve konforlu şekilde tamamlıyoruz.', 'For years we have carried guests safely from the airport to their hotels, business meetings and private events across Antalya. With professional multilingual chauffeurs and meticulously maintained vehicles, every transfer is on time, clean and comfortable.', 'Много лет мы надёжно доставляем гостей из аэропорта в отели, на деловые встречи и частные мероприятия по всей Анталии. Профессиональные водители со знанием языков и ухоженные автомобили — каждый трансфер вовремя, в чистоте и комфорте.', 'Seit Jahren bringen wir Gäste sicher vom Flughafen zu ihren Hotels, Geschäftsterminen und privaten Anlässen in ganz Antalya. Mit professionellen, mehrsprachigen Chauffeuren und sorgfältig gepflegten Fahrzeugen ist jeder Transfer pünktlich, sauber und komfortabel.', 'Od lat bezpiecznie przewozimy gości z lotniska do hoteli, na spotkania biznesowe i wydarzenia prywatne w całej Antalii. Dzięki profesjonalnym, wielojęzycznym kierowcom i starannie utrzymanym pojazdom każdy transfer jest punktualny, czysty i wygodny.'),
      aboutImage: '',
      stats: [
        { id: 'st1', value: 12500, suffix: '+', decimals: false, label: l('Mutlu misafir', 'Happy guests', 'Довольных гостей', 'Zufriedene Gäste', 'Zadowolonych gości') },
        { id: 'st2', value: 16, suffix: '', decimals: false, label: l('VIP araç', 'VIP vehicles', 'VIP-автомобилей', 'VIP-Fahrzeuge', 'Pojazdów VIP') },
        { id: 'st3', value: 24, suffix: '/7', decimals: false, label: l('Canlı destek', 'Live support', 'Поддержка 24/7', 'Live-Support', 'Wsparcie 24/7') },
        { id: 'st4', value: 4.9, suffix: '★', decimals: true, label: l('Ortalama puan', 'Average rating', 'Средняя оценка', 'Durchschnittsbewertung', 'Średnia ocena') },
      ],
      services: [
        { id: 's1', icon: 'plane', title: l('Havalimanı Transferi', 'Airport Transfers', 'Трансфер из аэропорта', 'Flughafentransfers', 'Transfery z lotniska'), desc: l('Antalya (AYT) ve Gazipaşa (GZP) havalimanlarından uçuş takipli, isim tabelalı karşılama.', 'Meet & greet with a name sign and live flight tracking at Antalya (AYT) and Gazipaşa (GZP).', 'Встреча с табличкой и отслеживанием рейса в аэропортах Анталии (AYT) и Газипаши (GZP).', 'Empfang mit Namensschild und Live-Flugüberwachung an den Flughäfen Antalya (AYT) und Gazipaşa (GZP).', 'Powitanie z tabliczką i śledzenie lotu na lotniskach Antalya (AYT) i Gazipaşa (GZP).') },
        { id: 's2', icon: 'hotel', title: l('Otel & Bölge Transferi', 'Hotel & Resort Transfers', 'Трансфер между отелями', 'Hotel- & Resorttransfers', 'Transfery między hotelami'), desc: l('Lara’dan Kaş’a, Belek’ten Alanya’ya; oteller ve bölgeler arası özel transfer.', 'From Lara to Kaş, Belek to Alanya — private rides between hotels and resorts.', 'От Лары до Каша, от Белека до Аланьи — индивидуальные поездки между отелями.', 'Von Lara bis Kaş, von Belek bis Alanya – private Fahrten zwischen Hotels und Resorts.', 'Od Lary po Kaş, od Beleku po Alanyę – prywatne przejazdy między hotelami.') },
        { id: 's3', icon: 'clock', title: l('Saatlik Şoförlü Araç', 'Chauffeur by the Hour', 'Почасовая аренда с водителем', 'Chauffeur auf Stundenbasis', 'Kierowca na godziny'), desc: l('Alışveriş, toplantı veya şehir turu için aracınız ve şoförünüz saatlerce emrinizde.', 'Your car and chauffeur at your disposal for shopping, meetings or a city tour.', 'Автомобиль с водителем в вашем распоряжении для шопинга, встреч или экскурсий.', 'Fahrzeug und Chauffeur zu Ihrer Verfügung für Shopping, Termine oder Stadtrundfahrt.', 'Samochód z kierowcą do Twojej dyspozycji na zakupy, spotkania lub zwiedzanie.') },
        { id: 's4', icon: 'route', title: l('Günübirlik Turlar', 'Private Day Trips', 'Индивидуальные экскурсии', 'Private Tagesausflüge', 'Prywatne wycieczki'), desc: l('Pamukkale, Kapadokya, Myra ve Kekova gibi rotalara size özel araçla gezi.', 'Private car trips to Pamukkale, Cappadocia, Myra, Kekova and more.', 'Поездки на личном автомобиле в Памуккале, Каппадокию, Миру, Кекову и другие места.', 'Private Ausflüge nach Pamukkale, Kappadokien, Myra, Kekova und mehr.', 'Prywatne wycieczki do Pamukkale, Kapadocji, Myry, Kekovy i nie tylko.') },
        { id: 's5', icon: 'briefcase', title: l('Kurumsal & Etkinlik', 'Corporate & Events', 'Корпоративные и мероприятия', 'Firmen & Events', 'Firmy i wydarzenia'), desc: l('Kongre, toplantı ve grup etkinlikleri için çoklu araç planlaması ve faturalı hizmet.', 'Multi-vehicle planning for congresses, meetings and group events, with invoicing.', 'Организация нескольких автомобилей для конгрессов, встреч и групп, с выставлением счёта.', 'Planung mehrerer Fahrzeuge für Kongresse, Meetings und Gruppenevents, mit Rechnung.', 'Organizacja wielu pojazdów na kongresy, spotkania i wydarzenia grupowe, z fakturą.') },
        { id: 's6', icon: 'heart', title: l('Düğün & Özel Gün', 'Weddings & Occasions', 'Свадьбы и торжества', 'Hochzeiten & Anlässe', 'Śluby i uroczystości'), desc: l('Gelin arabası, misafir transferi ve özel günleriniz için süslemeli VIP araçlar.', 'Bridal cars, guest shuttles and decorated VIP vehicles for your special day.', 'Свадебные автомобили, трансфер гостей и украшенные VIP-машины для особого дня.', 'Brautautos, Gästeshuttles und geschmückte VIP-Fahrzeuge für Ihren besonderen Tag.', 'Auta do ślubu, transport gości i dekorowane pojazdy VIP na Twój wyjątkowy dzień.') },
      ],
      testimonials: [
        { id: 't1', name: 'Sarah M.', country: 'GB', rating: 5, text: 'Our flight was delayed by two hours and the driver was still waiting with a smile and our names on a sign. Spotless van, cold water, smooth ride to Belek.' },
        { id: 't2', name: 'Алексей К.', country: 'RU', rating: 5, text: 'Заказали трансфер в Аланью для семьи из шести человек. Детские кресла уже были установлены, водитель помог с багажом. Всё чётко и вовремя.' },
        { id: 't3', name: 'Mehmet Y.', country: 'TR', rating: 5, text: 'İş seyahatlerimde düzenli kullanıyorum. Fiyat baştan belli, şoförler kibar ve dakik. Fatura da sorunsuz geliyor.' },
      ],
      faqs: [
        { id: 'f1', q: l('Uçuşum gecikirse ne olur?', 'What if my flight is delayed?', 'Что если мой рейс задержится?', 'Was passiert, wenn mein Flug Verspätung hat?', 'Co jeśli mój lot się opóźni?'), a: l('Uçuşunuzu anlık takip ediyoruz. Şoförünüz gerçek iniş saatinize göre sizi bekler; gecikme için ek ücret alınmaz.', 'We track your flight in real time. Your driver adjusts to the actual landing time — no extra charge for delays.', 'Мы отслеживаем рейс в реальном времени. Водитель встретит вас по фактическому времени посадки — без доплаты за задержку.', 'Wir verfolgen Ihren Flug in Echtzeit. Ihr Fahrer richtet sich nach der tatsächlichen Landezeit – ohne Aufpreis bei Verspätung.', 'Śledzimy Twój lot na bieżąco. Kierowca dostosuje się do faktycznej godziny lądowania – bez dopłaty za opóźnienie.') },
        { id: 'f2', q: l('Şoförü havalimanında nasıl bulurum?', 'How do I find my driver at the airport?', 'Как найти водителя в аэропорту?', 'Wie finde ich meinen Fahrer am Flughafen?', 'Jak znajdę kierowcę na lotnisku?'), a: l('Şoförünüz çıkış kapısında adınızın yazılı olduğu tabelayla bekler. Ayrıca rezervasyon sonrası şoför adı, plaka ve iletişim bilgisi size iletilir.', 'Your driver waits at the arrivals exit holding a sign with your name. You also receive the driver’s name, plate and phone number before the trip.', 'Водитель ждёт у выхода из зоны прилёта с табличкой с вашим именем. Перед поездкой вы получите имя водителя, номер машины и телефон.', 'Ihr Fahrer wartet am Ausgang der Ankunftshalle mit einem Schild mit Ihrem Namen. Vor der Fahrt erhalten Sie außerdem Name, Kennzeichen und Telefonnummer des Fahrers.', 'Kierowca czeka przy wyjściu z hali przylotów z tabliczką z Twoim nazwiskiem. Przed podróżą otrzymasz też jego imię, numer rejestracyjny i telefon.') },
        { id: 'f3', q: l('Fiyatlar kişi başı mı?', 'Are prices per person?', 'Цена указана за человека?', 'Gelten die Preise pro Person?', 'Czy ceny są za osobę?'), a: l('Hayır. Fiyatlar araç başınadır ve sabittir; otoyol, yakıt ve bekleme dahildir.', 'No. Prices are per vehicle and fixed — tolls, fuel and waiting time are included.', 'Нет. Цена фиксированная и указана за автомобиль — топливо, платные дороги и ожидание включены.', 'Nein. Die Preise gelten pro Fahrzeug und sind fest – Maut, Kraftstoff und Wartezeit sind inklusive.', 'Nie. Ceny są stałe i za pojazd – opłaty drogowe, paliwo i oczekiwanie są wliczone.') },
        { id: 'f4', q: l('Bebek koltuğu talep edebilir miyim?', 'Can I request a child seat?', 'Можно заказать детское кресло?', 'Kann ich einen Kindersitz anfragen?', 'Czy mogę zamówić fotelik dziecięcy?'), a: l('Evet. Rezervasyon sırasında bebek ve yükseltici koltuk ekleyebilirsiniz; araç hazır şekilde gelir.', 'Yes. Add baby seats or boosters during booking and they will be installed before pick-up.', 'Да. Добавьте детское кресло или бустер при бронировании — оно будет установлено заранее.', 'Ja. Fügen Sie Babyschalen oder Sitzerhöhungen bei der Buchung hinzu – sie werden vor der Abholung montiert.', 'Tak. Dodaj fotelik lub podstawkę podczas rezerwacji – zostaną zamontowane przed odbiorem.') },
        { id: 'f5', q: l('Ödemeyi nasıl yaparım?', 'How do I pay?', 'Как оплатить?', 'Wie bezahle ich?', 'Jak zapłacić?'), a: l('Ödemeyi araçta nakit (EUR, USD, GBP, TL) veya kartla yapabilirsiniz. Ön ödeme gerekmez.', 'Pay in the vehicle by cash (EUR, USD, GBP, TRY) or card. No prepayment required.', 'Оплата в автомобиле наличными (EUR, USD, GBP, TRY) или картой. Предоплата не требуется.', 'Bezahlung im Fahrzeug bar (EUR, USD, GBP, TRY) oder mit Karte. Keine Vorauszahlung nötig.', 'Płatność w pojeździe gotówką (EUR, USD, GBP, TRY) lub kartą. Bez przedpłaty.') },
        { id: 'f6', q: l('Rezervasyonumu iptal edebilir miyim?', 'Can I cancel my booking?', 'Можно отменить бронирование?', 'Kann ich meine Buchung stornieren?', 'Czy mogę anulować rezerwację?'), a: l('Transfer saatinden 24 saat öncesine kadar ücretsiz iptal edebilir veya değiştirebilirsiniz.', 'Free cancellation or changes up to 24 hours before your pick-up time.', 'Бесплатная отмена или изменение не позднее чем за 24 часа до подачи.', 'Kostenlose Stornierung oder Änderung bis 24 Stunden vor der Abholzeit.', 'Bezpłatne anulowanie lub zmiana do 24 godzin przed odbiorem.') },
      ],
      rates: { EUR: 1, TRY: 44, USD: 1.08, GBP: 0.85 },
      roundTripDiscount: 5,
      nightSurcharge: 0,
      nightStart: '00:00',
      nightEnd: '06:00',
      freeWaitMin: 60,
      minLeadHours: 4,
      payments: { cash: true, card_vehicle: true, online: false },
      roadFactor: 1.3,
      mapLat: 36.8969,
      mapLng: 30.7133,
      searchBbox: '29.2,35.8,32.9,37.7',
      googleMapsKey: '',
      legalName: '',
      googleReviewUrl: '',
      seasons: [{ id: 'se1', name: 'Yaz sezonu', from: '06-15', to: '09-15', percent: 0, active: false }],
      promoCodes: [],
      privacyText: l("## Veri sorumlusu\nBu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca, veri sorumlusu sıfatıyla {UNVAN} tarafından hazırlanmıştır. Adres: {ADRES} · E-posta: {EPOSTA}\n\n## İşlenen kişisel veriler\nAd soyad, telefon numarası, e-posta adresi, uçuş numarası, alış ve varış adresleri ile konum bilgisi, yolcu ve bagaj sayısı, özel talepler, ödeme yöntemi ve rezervasyon geçmişi. Hesap açarsanız şifreniz şifrelenmiş (geri çevrilemez) olarak saklanır.\n\n## İşleme amaçları\nTransfer hizmetinin planlanması ve sunulması, şoför ataması ve sizinle iletişim, rezervasyon onayı ve bilgilendirme mesajları, faturalandırma, yasal yükümlülüklerin (ör. U-ETDS bildirimi) yerine getirilmesi, hizmet kalitesinin ölçülmesi ve şikâyetlerin çözümü.\n\n## Hukuki sebepler\nBir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (KVKK m.5/2-c), veri sorumlusunun hukuki yükümlülüğü (m.5/2-ç) ve meşru menfaat (m.5/2-f). Pazarlama iletişimi yalnızca açık rızanızla yapılır.\n\n## Aktarım\nVerileriniz yalnızca hizmetin gerektirdiği ölçüde; görevli şoförümüzle, barındırma ve harita/iletişim hizmeti aldığımız tedarikçilerle (yurt dışında bulunabilir) ve kanunen yetkili kamu kurumlarıyla paylaşılır.\n\n## Canlı konum\nŞoförün konumu yalnızca şoförün izniyle ve yalnızca aktif transfer süresince size ve ofisimize gösterilir; transfer bitince paylaşım kendiliğinden sona erer.\n\n## Saklama süresi\nVeriler, ilgili mevzuatta öngörülen süreler boyunca ve hizmetin gerektirdiği süre kadar saklanır; süre sonunda silinir, yok edilir veya anonim hâle getirilir.\n\n## Haklarınız\nKVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. Başvurularınızı {EPOSTA} adresine iletebilirsiniz.\n\n## Çerezler ve yerel depolama\nSitemiz yalnızca hizmetin çalışması için gerekli olan yerel depolamayı (dil ve para birimi tercihi, oturum bilgisi) kullanır. Harita ve adres arama hizmetleri kendi çerezlerini kullanabilir.", "## Data controller\nThis notice is provided by {UNVAN} as data controller. Address: {ADRES} · Email: {EPOSTA}\n\n## Data we process\nName, phone, email, flight number, pick-up and drop-off addresses and location, number of passengers and bags, special requests, payment method and booking history. If you create an account, your password is stored in hashed (irreversible) form.\n\n## Purposes\nPlanning and providing the transfer, assigning a chauffeur and contacting you, confirmations and updates, invoicing, legal obligations, service quality and complaint handling.\n\n## Sharing\nOnly as needed to provide the service: with the assigned chauffeur, hosting, map and messaging providers (which may be located abroad) and authorised public bodies.\n\n## Live location\nThe chauffeur's location is shown to you and our office only with the chauffeur's consent and only during an active transfer.\n\n## Your rights\nYou may request access, correction or deletion of your data, or object to processing, by writing to {EPOSTA}.\n\n## Cookies and local storage\nWe only use storage that is necessary for the site to work (language, currency, sign-in). Map and address search services may set their own cookies.", "## Оператор данных\nНастоящее уведомление предоставлено {UNVAN} как оператором персональных данных. Адрес: {ADRES} · Эл. почта: {EPOSTA}\n\n## Какие данные мы обрабатываем\nИмя, телефон, эл. почта, номер рейса, адреса подачи и назначения, количество пассажиров и багажа, пожелания, способ оплаты и история бронирований. Пароль аккаунта хранится в зашифрованном виде.\n\n## Цели\nОрганизация и выполнение трансфера, назначение водителя и связь с вами, подтверждения и уведомления, выставление счетов, выполнение требований закона.\n\n## Передача\nТолько в объёме, необходимом для услуги: назначенному водителю, поставщикам хостинга, карт и сообщений (могут находиться за рубежом) и уполномоченным органам.\n\n## Геолокация\nМестоположение водителя показывается вам только с его согласия и только во время активного трансфера.\n\n## Ваши права\nВы можете запросить доступ, исправление или удаление данных, написав на {EPOSTA}.\n\n## Cookie и локальное хранилище\nМы используем только необходимое хранилище (язык, валюта, вход). Сервисы карт могут использовать собственные cookie."),
      adminPassword: 'admin123',
    },
    vehicles: [
      {
        id: 'vito', perKm: 1.1, minFare: 35, name: 'Mercedes Vito VIP', art: 'van', pax: 6, luggage: 6, hourlyRate: 35, active: true, images: [],
        category: l('VIP Minivan', 'VIP Minivan', 'VIP минивэн', 'VIP-Minivan', 'Minivan VIP'),
        description: l('Deri koltuklar, geniş iç hacim ve sessiz sürüş. Aileler ve küçük gruplar için en çok tercih edilen araç.', 'Leather seats, generous space and a quiet ride. The favourite choice for families and small groups.', 'Кожаные сиденья, просторный салон и тихий ход. Лучший выбор для семей и небольших групп.', 'Ledersitze, viel Platz und eine ruhige Fahrt. Die beliebteste Wahl für Familien und kleine Gruppen.', 'Skórzane fotele, dużo miejsca i cicha jazda. Ulubiony wybór rodzin i małych grup.'),
        features: l('Deri VIP koltuk\nKlima\nÜcretsiz Wi-Fi\nSoğuk su ikramı\nUSB şarj', 'Leather VIP seats\nAir conditioning\nFree Wi-Fi\nComplimentary water\nUSB charging', 'Кожаные VIP-сиденья\nКондиционер\nБесплатный Wi-Fi\nВода в подарок\nUSB-зарядка', 'VIP-Ledersitze\nKlimaanlage\nKostenloses WLAN\nWasser inklusive\nUSB-Ladeanschluss', 'Skórzane fotele VIP\nKlimatyzacja\nDarmowe Wi-Fi\nWoda gratis\nŁadowanie USB'),
      },
      {
        id: 'vclass', perKm: 1.5, minFare: 50, name: 'Mercedes V-Class Luxury', art: 'van', pax: 6, luggage: 5, hourlyRate: 50, active: true, images: [],
        category: l('Lüks Minivan', 'Luxury Minivan', 'Люкс минивэн', 'Luxus-Minivan', 'Luksusowy minivan'),
        description: l('Karşılıklı kaptan koltuklar, ambiyans aydınlatma ve üst düzey konfor. İş seyahatleri ve özel günler için.', 'Captain seats facing each other, ambient lighting and first-class comfort for business and special occasions.', 'Капитанские кресла друг напротив друга, атмосферная подсветка и комфорт первого класса.', 'Gegenüberliegende Kapitänssitze, Ambientebeleuchtung und erstklassiger Komfort für Geschäftsreisen und besondere Anlässe.', 'Fotele kapitańskie naprzeciw siebie, nastrojowe oświetlenie i komfort pierwszej klasy na podróże biznesowe i okazje.'),
        features: l('Kaptan koltuklar\nAmbiyans aydınlatma\nÜcretsiz Wi-Fi\nİkram\nKarartmalı camlar', 'Captain seats\nAmbient lighting\nFree Wi-Fi\nRefreshments\nPrivacy glass', 'Капитанские кресла\nАтмосферная подсветка\nБесплатный Wi-Fi\nНапитки\nТонированные стёкла', 'Kapitänssitze\nAmbientebeleuchtung\nKostenloses WLAN\nErfrischungen\nGetönte Scheiben', 'Fotele kapitańskie\nNastrojowe oświetlenie\nDarmowe Wi-Fi\nNapoje\nPrzyciemniane szyby'),
      },
      {
        id: 'sedan', perKm: 1.2, minFare: 40, name: 'Mercedes E-Class', art: 'sedan', pax: 3, luggage: 3, hourlyRate: 40, active: true, images: [],
        category: l('Business Sedan', 'Business Sedan', 'Бизнес-седан', 'Business-Limousine', 'Sedan biznesowy'),
        description: l('Tek başına veya çift seyahat eden misafirler için zarif ve dinamik iş sınıfı sedan.', 'An elegant business-class sedan for solo travellers and couples.', 'Элегантный седан бизнес-класса для одного или двух пассажиров.', 'Eine elegante Business-Limousine für Alleinreisende und Paare.', 'Elegancki sedan klasy biznes dla osób podróżujących solo i par.'),
        features: l('Deri koltuk\nKlima\nÜcretsiz Wi-Fi\nSoğuk su ikramı', 'Leather seats\nAir conditioning\nFree Wi-Fi\nComplimentary water', 'Кожаные сиденья\nКондиционер\nБесплатный Wi-Fi\nВода в подарок', 'Ledersitze\nKlimaanlage\nKostenloses WLAN\nWasser inklusive', 'Skórzane fotele\nKlimatyzacja\nDarmowe Wi-Fi\nWoda gratis'),
      },
      {
        id: 'sprinter', perKm: 1.9, minFare: 60, name: 'Mercedes Sprinter VIP', art: 'sprinter', pax: 13, luggage: 13, hourlyRate: 60, active: true, images: [],
        category: l('VIP Minibüs', 'VIP Minibus', 'VIP микроавтобус', 'VIP-Minibus', 'Minibus VIP'),
        description: l('Kalabalık aileler, golf grupları ve kurumsal ekipler için ferah, ayakta durulabilen VIP minibüs.', 'A spacious, stand-up VIP minibus for large families, golf groups and corporate teams.', 'Просторный VIP-микроавтобус для больших семей, гольф-групп и корпоративных команд.', 'Ein geräumiger VIP-Minibus mit Stehhöhe für große Familien, Golfgruppen und Firmenteams.', 'Przestronny minibus VIP dla dużych rodzin, grup golfowych i zespołów firmowych.'),
        features: l('Geniş bagaj alanı\nKlima\nÜcretsiz Wi-Fi\nTV & müzik sistemi\nGolf çantası uygun', 'Large luggage space\nAir conditioning\nFree Wi-Fi\nTV & sound system\nGolf-bag friendly', 'Большой багажник\nКондиционер\nБесплатный Wi-Fi\nТВ и аудиосистема\nМесто для гольф-сумок', 'Großer Gepäckraum\nKlimaanlage\nKostenloses WLAN\nTV & Soundsystem\nPlatz für Golfbags', 'Duży bagażnik\nKlimatyzacja\nDarmowe Wi-Fi\nTV i nagłośnienie\nMiejsce na torby golfowe'),
      },
    ],
    locations: [
      { id: 'ayt', name: 'Antalya Havalimanı', kind: 'airport', code: 'AYT', lat: 36.8987, lng: 30.8005, radiusKm: 3 },
      { id: 'gzp', name: 'Gazipaşa-Alanya Havalimanı', kind: 'airport', code: 'GZP', lat: 36.2993, lng: 32.3006, radiusKm: 3 },
      { id: 'lara', name: 'Lara / Kundu', kind: 'region', lat: 36.856, lng: 30.855, radiusKm: 7 },
      { id: 'merkez', name: 'Antalya Merkez', kind: 'region', lat: 36.8969, lng: 30.7133, radiusKm: 6 },
      { id: 'konyaalti', name: 'Konyaaltı', kind: 'region', lat: 36.864, lng: 30.63, radiusKm: 6 },
      { id: 'belek', name: 'Belek', kind: 'region', lat: 36.86, lng: 31.055, radiusKm: 7 },
      { id: 'kadriye', name: 'Kadriye', kind: 'region', lat: 36.888, lng: 30.985, radiusKm: 4 },
      { id: 'side', name: 'Side', kind: 'region', lat: 36.767, lng: 31.389, radiusKm: 5 },
      { id: 'manavgat', name: 'Manavgat', kind: 'region', lat: 36.787, lng: 31.443, radiusKm: 5 },
      { id: 'okurcalar', name: 'Okurcalar / Avsallar', kind: 'region', lat: 36.64, lng: 31.73, radiusKm: 9 },
      { id: 'alanya', name: 'Alanya', kind: 'region', lat: 36.544, lng: 32.0, radiusKm: 7 },
      { id: 'mahmutlar', name: 'Mahmutlar', kind: 'region', lat: 36.49, lng: 32.09, radiusKm: 5 },
      { id: 'beldibi', name: 'Beldibi', kind: 'region', lat: 36.715, lng: 30.565, radiusKm: 5 },
      { id: 'kemer', name: 'Kemer', kind: 'region', lat: 36.6, lng: 30.56, radiusKm: 6 },
      { id: 'tekirova', name: 'Tekirova', kind: 'region', lat: 36.505, lng: 30.53, radiusKm: 6 },
      { id: 'kas', name: 'Kaş', kind: 'region', lat: 36.2, lng: 29.64, radiusKm: 10 },
    ],
    routes: [
      ...AYT_ROUTES.map((r, i) => mkRoute('ayt', r, i < 8)),
      ...GZP_ROUTES.map((r) => mkRoute('gzp', r, false)),
    ],
    extras: [
      { id: 'babyseat', name: l('Bebek koltuğu (0–4 yaş)', 'Baby seat (0–4 yrs)', 'Детское кресло (0–4 года)', 'Babysitz (0–4 J.)', 'Fotelik (0–4 lata)'), price: 0, maxQty: 3, active: true },
      { id: 'booster', name: l('Yükseltici koltuk (4–10 yaş)', 'Booster seat (4–10 yrs)', 'Бустер (4–10 лет)', 'Sitzerhöhung (4–10 J.)', 'Podstawka (4–10 lat)'), price: 0, maxQty: 3, active: true },
      { id: 'stop', name: l('Ara durak / market molası', 'Extra stop / supermarket', 'Остановка / супермаркет', 'Zwischenstopp / Supermarkt', 'Dodatkowy postój / sklep'), price: 10, maxQty: 2, active: true },
      { id: 'flowers', name: l('Çiçek ile karşılama', 'Welcome flowers', 'Встреча с цветами', 'Blumen zur Begrüßung', 'Kwiaty na powitanie'), price: 30, maxQty: 1, active: true },
    ],
    drivers: [
      { id: 'd1', name: 'Murat Kaya', phone: '+90 555 111 11 11', pin: '1234', plate: '07 VIP 001', vehicleId: 'vito', languages: 'TR, EN', active: true },
      { id: 'd2', name: 'Emre Demir', phone: '+90 555 222 22 22', pin: '1234', plate: '07 VIP 002', vehicleId: 'vclass', languages: 'TR, EN, RU', active: true },
      { id: 'd3', name: 'Hasan Yıldız', phone: '+90 555 333 33 33', pin: '1234', plate: '07 VIP 013', vehicleId: 'sprinter', languages: 'TR, DE', active: true },
    ],
    live: {},
    customers: [],
    fleet: [],
    expenses: [],
    settlements: [],
    bookings: [
      demoBooking(1, { fromId: 'ayt', toId: 'belek', fromDetail: 'Dış Hatlar T1', toDetail: 'Regnum Carya', date: today(0), time: '10:30', flightNo: 'TK 2412', vehicleId: 'vito', price: 40, status: 'completed', driverId: 'd1', cashCollected: 40 }, 'Sarah Miller'),
      demoBooking(2, { fromId: 'ayt', toId: 'alanya', fromDetail: 'Dış Hatlar T2', toDetail: 'Alanya Kleopatra', date: today(0), time: '14:15', flightNo: 'SU 2138', vehicleId: 'vclass', price: 115, status: 'onboard', driverId: 'd2', adults: 4, children: 2, luggage: 5, extras: { babyseat: 1 }, lang: 'ru' }, 'Алексей Кузнецов'),
      demoBooking(3, { fromId: 'lara', toId: 'ayt', fromDetail: 'Titanic Beach Lara', toDetail: 'Dış Hatlar', date: today(0), time: '18:00', vehicleId: 'sprinter', price: 50, status: 'assigned', driverId: 'd3', adults: 9, luggage: 10 }, 'Klaus Weber'),
      demoBooking(4, { fromId: 'ayt', toId: 'kemer', fromDetail: 'Dış Hatlar T1', toDetail: 'Rixos Sungate', date: today(0), time: '21:40', flightNo: 'EZY 8045', vehicleId: 'vito', price: 55, status: 'confirmed' }, 'James Carter'),
      demoBooking(5, { fromId: 'ayt', toId: 'side', fromDetail: 'Dış Hatlar T2', toDetail: 'Barut Hemera', date: today(1), time: '09:20', flightNo: 'PC 1170', vehicleId: 'vito', price: 55, status: 'new', adults: 3, luggage: 3, payment: 'card_vehicle' }, 'Anna Schmidt'),
      demoBooking(6, { fromId: 'gzp', toId: 'mahmutlar', fromDetail: 'Gazipaşa', toDetail: 'Mahmutlar Sahil', date: today(1), time: '13:05', flightNo: 'SU 6249', vehicleId: 'vclass', price: 45, status: 'new', lang: 'ru' }, 'Ирина Волкова'),
    ],
  };
  // Demo rezervasyonlarına konum noktası ekle
  const pt = (id: string | undefined, detail: string) => {
    const l = st.locations.find((x) => x.id === id);
    return l && l.lat != null && l.lng != null ? { label: l.code ? `${l.name} (${l.code})` : l.name, lat: l.lat, lng: l.lng, zoneId: l.id, kind: 'place' as const } : undefined;
  };
  st.bookings = st.bookings.map((b) => ({ ...b, fromPoint: pt(b.fromId, b.fromDetail), toPoint: pt(b.toId, b.toDetail) }));
  return st;
}
