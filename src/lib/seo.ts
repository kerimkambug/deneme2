/**
 * SEO ve yapay zekâ uyumu: hem sunucu (ön-işleme, sitemap, llms.txt) hem tarayıcı tarafından kullanılır.
 * Burada tarayıcıya özgü hiçbir şey kullanılmaz.
 */
import { LANGS, type AppState, type Lang, type RoutePrice } from '../types';

type Cfg = Pick<AppState, 'settings' | 'vehicles' | 'locations' | 'routes' | 'extras'>;

const TR_MAP: Record<string, string> = { ı: 'i', ğ: 'g', ü: 'u', ş: 's', ö: 'o', ç: 'c', İ: 'i', â: 'a', î: 'i', û: 'u' };

export function slugify(t: string) {
  return t
    .replace(/[ıİğüşöçâîû]/g, (c) => TR_MAP[c] ?? c)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const locName = (c: Cfg, id: string) => c.locations.find((l) => l.id === id)?.name ?? id;

export const routeSlug = (c: Cfg, r: RoutePrice) => `${slugify(locName(c, r.from))}-${slugify(locName(c, r.to))}-transfer`;

export const routeBySlug = (c: Cfg, slug: string) => c.routes.find((r) => routeSlug(c, r) === slug);

/** Fiyatı olan (aktif araçlı) güzergâhlar */
export function publicRoutes(c: Cfg) {
  return c.routes.filter((r) => routeOffers(c, r).length > 0);
}

export function routeOffers(c: Cfg, r: RoutePrice) {
  return c.vehicles
    .filter((v) => v.active && r.prices[v.id] > 0)
    .map((v) => ({ vehicle: v, price: r.prices[v.id] }))
    .sort((a, b) => a.price - b.price);
}

const T = {
  routeTitle: { tr: '{a} – {b} Transfer', en: '{a} to {b} Transfer', ru: 'Трансфер {a} – {b}', de: 'Transfer {a} – {b}', pl: 'Transfer {a} – {b}' },
  routeDesc: {
    tr: '{a} – {b} arası özel VIP transfer. Yaklaşık {km} km, {min} dakika. Sabit fiyat {p} €’dan başlar. Uçuş takibi, isim tabelasıyla karşılama, online rezervasyon.',
    en: 'Private VIP transfer from {a} to {b}. About {km} km, {min} minutes. Fixed prices from €{p}. Flight tracking, meet & greet with name sign, book online.',
    ru: 'Индивидуальный VIP-трансфер {a} – {b}. Около {km} км, {min} минут. Фиксированная цена от {p} €. Отслеживание рейса, встреча с табличкой, онлайн-бронирование.',
    de: 'Privater VIP-Transfer {a} – {b}. Ca. {km} km, {min} Minuten. Festpreise ab {p} €. Flugverfolgung, Abholung mit Namensschild, online buchen.',
    pl: 'Prywatny transfer VIP {a} – {b}. Ok. {km} km, {min} minut. Stałe ceny od {p} €. Śledzenie lotu, powitanie z tabliczką, rezerwacja online.',
  },
  howQ: { tr: '{a} – {b} arası nasıl gidilir?', en: 'How do I get from {a} to {b}?', ru: 'Как добраться из {a} в {b}?', de: 'Wie komme ich von {a} nach {b}?', pl: 'Jak dojechać z {a} do {b}?' },
  howA: {
    tr: '{a} ile {b} arası yaklaşık {km} km’dir; özel transferle yolculuk ortalama {min} dakika sürer. {c}, bu güzergâhta kapıdan kapıya özel araçla sabit fiyatlı transfer yapar. Uçuşunuz takip edilir, şoför sizi isim tabelasıyla karşılar ve iniş saatinden itibaren {w} dakika ücretsiz bekler. Rezervasyon internetten birkaç dakikada yapılır.',
    en: '{a} and {b} are about {km} km apart; a private transfer takes around {min} minutes. {c} operates door-to-door private transfers on this route at a fixed price. Your flight is tracked, the driver meets you with a name sign and waits {w} minutes free of charge after landing. You can book online in a few minutes.',
    ru: 'Расстояние между {a} и {b} около {km} км, индивидуальный трансфер занимает примерно {min} минут. {c} выполняет трансферы «от двери до двери» по фиксированной цене. Мы отслеживаем ваш рейс, водитель встречает с табличкой и бесплатно ждёт {w} минут после посадки. Забронировать можно онлайн за несколько минут.',
    de: '{a} und {b} liegen etwa {km} km auseinander; ein privater Transfer dauert rund {min} Minuten. {c} bietet auf dieser Strecke Tür-zu-Tür-Transfers zum Festpreis. Ihr Flug wird verfolgt, der Fahrer empfängt Sie mit Namensschild und wartet nach der Landung {w} Minuten kostenlos. Die Buchung dauert online nur wenige Minuten.',
    pl: '{a} i {b} dzieli ok. {km} km; prywatny transfer trwa około {min} minut. {c} realizuje na tej trasie transfery od drzwi do drzwi w stałej cenie. Śledzimy Twój lot, kierowca wita z tabliczką i czeka bezpłatnie {w} minut po lądowaniu. Rezerwacja online zajmuje kilka minut.',
  },
  durQ: { tr: 'Yolculuk ne kadar sürer?', en: 'How long does the transfer take?', ru: 'Сколько длится поездка?', de: 'Wie lange dauert der Transfer?', pl: 'Ile trwa przejazd?' },
  durA: { tr: 'Trafiğe bağlı olarak yaklaşık {min} dakika ({km} km).', en: 'About {min} minutes ({km} km), depending on traffic.', ru: 'Около {min} минут ({km} км) в зависимости от трафика.', de: 'Je nach Verkehr ca. {min} Minuten ({km} km).', pl: 'Około {min} minut ({km} km), zależnie od ruchu.' },
  priceQ: { tr: 'Transfer ücreti ne kadar?', en: 'How much does the transfer cost?', ru: 'Сколько стоит трансфер?', de: 'Was kostet der Transfer?', pl: 'Ile kosztuje transfer?' },
  priceA: { tr: 'Araç başına sabit fiyat (kişi başı değil): {list}.', en: 'Fixed price per vehicle (not per person): {list}.', ru: 'Фиксированная цена за автомобиль (не за человека): {list}.', de: 'Festpreis pro Fahrzeug (nicht pro Person): {list}.', pl: 'Stała cena za pojazd (nie za osobę): {list}.' },
  persons: { tr: 'kişi', en: 'passengers', ru: 'чел.', de: 'Personen', pl: 'osób' },
  routesH: { tr: 'Transfer güzergâhları ve fiyatlar', en: 'Transfer routes and prices', ru: 'Маршруты и цены', de: 'Transferstrecken und Preise', pl: 'Trasy i ceny' },
  vehiclesH: { tr: 'Araçlar', en: 'Vehicles', ru: 'Автомобили', de: 'Fahrzeuge', pl: 'Pojazdy' },
  faqH: { tr: 'Sık sorulan sorular', en: 'FAQ', ru: 'Частые вопросы', de: 'Häufige Fragen', pl: 'Częste pytania' },
  contactH: { tr: 'İletişim', en: 'Contact', ru: 'Контакты', de: 'Kontakt', pl: 'Kontakt' },
  book: { tr: 'Online rezervasyon', en: 'Book online', ru: 'Забронировать онлайн', de: 'Online buchen', pl: 'Zarezerwuj online' },
  from: { tr: '{p} €’dan', en: 'from €{p}', ru: 'от {p} €', de: 'ab {p} €', pl: 'od {p} €' },
  bookTitle: { tr: 'Rezervasyon', en: 'Booking', ru: 'Бронирование', de: 'Buchung', pl: 'Rezerwacja' },
  privacyTitle: { tr: 'Gizlilik ve KVKK', en: 'Privacy policy', ru: 'Политика конфиденциальности', de: 'Datenschutz', pl: 'Polityka prywatności' },
  home: { tr: 'Ana sayfa', en: 'Home', ru: 'Главная', de: 'Startseite', pl: 'Strona główna' },
} satisfies Record<string, Record<Lang, string>>;

export const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
export const tx = (k: keyof typeof T, lang: Lang, v: Record<string, string | number> = {}) => fill(T[k][lang], v);

/** Güzergâh sayfası metinleri (sunucu ve tarayıcı aynı metni üretir) */
export function routeTexts(c: Cfg, r: RoutePrice, lang: Lang) {
  const a = locName(c, r.from);
  const b = locName(c, r.to);
  const offers = routeOffers(c, r);
  const v = { a, b, km: r.distanceKm, min: r.durationMin, p: offers[0]?.price ?? '', c: c.settings.companyName, w: c.settings.freeWaitMin };
  const list = offers.map((o) => `${o.vehicle.name} (${o.vehicle.pax} ${T.persons[lang]}) ${o.price} €`).join(', ');
  return {
    a,
    b,
    offers,
    title: `${tx('routeTitle', lang, v)} | ${c.settings.companyName}`,
    h1: tx('routeTitle', lang, v),
    description: tx('routeDesc', lang, v),
    faq: [
      { q: tx('howQ', lang, v), a: tx('howA', lang, v) },
      { q: tx('durQ', lang, v), a: tx('durA', lang, v) },
      ...(list ? [{ q: tx('priceQ', lang, v), a: tx('priceA', lang, { list }) }] : []),
    ],
  };
}

export function homeTexts(c: Cfg, lang: Lang) {
  const s = c.settings;
  const title = `${s.companyName} | ${s.tagline[lang] || s.tagline.tr}`;
  const description = (s.heroSubtitle[lang] || s.heroSubtitle.tr || '').slice(0, 300);
  return { title, description, h1: `${s.heroTitle[lang] || s.heroTitle.tr} ${s.heroAccent[lang] || s.heroAccent.tr}`.trim() };
}

export const langUrl = (base: string, path: string, lang: Lang) => `${base}${path}${lang === 'tr' ? '' : `${path.includes('?') ? '&' : '?'}lang=${lang}`}`;

/* ---------------- JSON-LD (yapılandırılmış veri) ---------------- */

export function businessLd(c: Cfg, base: string, lang: Lang) {
  const s = c.settings;
  const ig = s.instagram ? `https://instagram.com/${s.instagram.replace('@', '')}` : undefined;
  const img = /^https?:\/\//.test(s.heroImage) ? s.heroImage : `${base}/icon-512.png`;
  return {
    '@context': 'https://schema.org',
    '@type': ['TravelAgency', 'LocalBusiness'],
    '@id': `${base}/#business`,
    name: s.companyName,
    ...(s.legalName ? { legalName: s.legalName } : {}),
    description: s.aboutText[lang] || s.aboutText.tr,
    url: `${base}/`,
    logo: /^https?:\/\//.test(s.logo) ? s.logo : `${base}/icon-512.png`,
    image: img,
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.email ? { email: s.email } : {}),
    ...(s.address ? { address: { '@type': 'PostalAddress', streetAddress: s.address, addressCountry: 'TR' } } : {}),
    geo: { '@type': 'GeoCoordinates', latitude: s.mapLat, longitude: s.mapLng },
    areaServed: c.locations.map((l) => ({ '@type': l.kind === 'airport' ? 'Airport' : 'Place', name: l.name })),
    openingHoursSpecification: { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '00:00', closes: '23:59' },
    priceRange: '€€',
    currenciesAccepted: 'EUR, TRY, USD, GBP',
    knowsLanguage: [...LANGS],
    ...(ig ? { sameAs: [ig] } : {}),
    ...(s.licenseNo ? { identifier: s.licenseNo } : {}),
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
  };
}

export function routeLd(c: Cfg, r: RoutePrice, base: string, lang: Lang) {
  const t = routeTexts(c, r, lang);
  const url = langUrl(base, `/transfer/${routeSlug(c, r)}`, lang);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'TaxiService',
      name: t.h1,
      description: t.description,
      url,
      provider: { '@id': `${base}/#business` },
      areaServed: [t.a, t.b],
      offers: t.offers.map((o) => ({
        '@type': 'Offer',
        name: `${o.vehicle.name} · ${t.a} → ${t.b}`,
        price: o.price,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: `${base}/rezervasyon?from=${r.from}&to=${r.to}`,
        eligibleQuantity: { '@type': 'QuantitativeValue', maxValue: o.vehicle.pax, unitText: 'passengers' },
      })),
    },
    faqLd(t.faq),
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: tx('home', lang), item: langUrl(base, '/', lang) },
        { '@type': 'ListItem', position: 2, name: t.h1, item: url },
      ],
    },
  ];
}

/* ---------------- llms.txt (yapay zekâ asistanları için özet) ---------------- */

export function llmsTxt(c: Cfg, base: string) {
  const s = c.settings;
  const L: string[] = [];
  L.push(`# ${s.companyName}`, '');
  L.push(`> ${s.aboutText.en || s.aboutText.tr}`, '');
  L.push(`${s.companyName} is a private VIP airport and hotel transfer company in Turkey (service area: ${c.locations.map((l) => l.name).join(', ')}). Prices are fixed per vehicle, not per person. Flights are tracked, the driver meets passengers with a name sign and waits ${s.freeWaitMin} minutes free after landing. Bookings are made online at ${base}/rezervasyon and confirmed by the office. Languages: Turkish, English, Russian, German, Polish.`, '');
  L.push('## Contact', '');
  if (s.phone) L.push(`- Phone: ${s.phone}`);
  if (s.whatsapp) L.push(`- WhatsApp: https://wa.me/${s.whatsapp}`);
  if (s.email) L.push(`- Email: ${s.email}`);
  if (s.address) L.push(`- Address: ${s.address}`);
  if (s.licenseNo) L.push(`- License: ${s.licenseNo}`);
  L.push(`- Website: ${base}/`, `- Online booking: ${base}/rezervasyon`, `- Booking tracking: ${base}/takip`, '');
  L.push('## Transfer routes and fixed prices (EUR, one way, per vehicle)', '');
  for (const r of publicRoutes(c)) {
    const t = routeTexts(c, r, 'en');
    L.push(`- [${t.a} → ${t.b}](${base}/transfer/${routeSlug(c, r)}): ~${r.distanceKm} km, ~${r.durationMin} min. ${t.offers.map((o) => `${o.vehicle.name} (up to ${o.vehicle.pax} passengers) €${o.price}`).join('; ')}`);
  }
  L.push('', 'Routes not listed above are priced by distance in the booking form.', '');
  L.push('## Vehicles', '');
  for (const v of c.vehicles.filter((x) => x.active)) {
    L.push(`- ${v.name} (${v.category.en || v.category.tr}): up to ${v.pax} passengers, ${v.luggage} suitcases${v.hourlyRate ? `, hourly hire €${v.hourlyRate}/h` : ''}.`);
  }
  const extras = c.extras.filter((e) => e.active);
  if (extras.length) {
    L.push('', '## Extras', '');
    for (const e of extras) L.push(`- ${e.name.en || e.name.tr}: ${e.price ? `€${e.price}` : 'free'}`);
  }
  const pay = Object.entries(s.payments).filter(([, on]) => on).map(([k]) => ({ cash: 'cash to the driver', card_vehicle: 'card in the vehicle', online: 'online payment' })[k] ?? k);
  L.push('', '## Booking and payment', '', `- Payment: ${pay.join(', ')}.`, `- Book at least ${s.minLeadHours} hours in advance; for urgent rides call or WhatsApp.`, ...(s.nightSurcharge ? [`- Night surcharge ${s.nightSurcharge}% between ${s.nightStart} and ${s.nightEnd}.`] : []), ...(s.roundTripDiscount ? [`- Round-trip discount ${s.roundTripDiscount}%.`] : []), '');
  if (s.faqs.length) {
    L.push('## FAQ', '');
    for (const f of s.faqs) L.push(`### ${f.q.en || f.q.tr}`, '', f.a.en || f.a.tr, '');
  }
  return L.join('\n');
}
