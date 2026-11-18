export const LANGS = ['tr', 'en', 'ru'] as const;
export type Lang = (typeof LANGS)[number];
export type L10n = Record<Lang, string>;

export const CURRENCIES = ['EUR', 'TRY', 'USD', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export type VehicleArt = 'sedan' | 'van' | 'sprinter' | 'bus';

export interface Vehicle {
  id: string;
  name: string;
  category: L10n;
  description: L10n;
  /** Satır satır özellikler (her dil için) */
  features: L10n;
  pax: number;
  luggage: number;
  images: string[];
  art: VehicleArt;
  /** Saatlik kiralama ücreti (EUR) */
  hourlyRate: number;
  /** Tabloda olmayan güzergâhlar için km ücreti (EUR, 0 = teklif iste) */
  perKm: number;
  /** Km bazlı fiyatta en düşük ücret (EUR) */
  minFare: number;
  active: boolean;
}

export type LocationKind = 'airport' | 'region';

export interface Location {
  id: string;
  name: string;
  kind: LocationKind;
  code?: string;
  /** Bölge merkezi */
  lat?: number;
  lng?: number;
  /** Bu yarıçap (km) içindeki konumlar bu bölgeye sayılır */
  radiusKm?: number;
}

/** Müşterinin seçtiği gerçek konum */
export interface Point {
  label: string;
  sub?: string;
  lat: number;
  lng: number;
  /** Düştüğü bölge (fiyat için) */
  zoneId?: string;
  kind?: 'airport' | 'region' | 'place' | 'gps';
  /** Google yer kimliği (koordinat seçimde çözülür) */
  placeId?: string;
}

export interface RoutePrice {
  id: string;
  from: string;
  to: string;
  durationMin: number;
  distanceKm: number;
  /** vehicleId -> EUR fiyat (tek yön) */
  prices: Record<string, number>;
  popular: boolean;
}

export interface Extra {
  id: string;
  name: L10n;
  price: number;
  maxQty: number;
  active: boolean;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  pin: string;
  plate: string;
  vehicleId?: string;
  languages: string;
  active: boolean;
}

export type BookingStatus =
  | 'new'
  | 'confirmed'
  | 'assigned'
  | 'on_way'
  | 'arrived'
  | 'onboard'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/** Müşteri hesabı (şifre özeti yalnızca sunucuda tutulur) */
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  /** Yalnızca demo (tarayıcı) modunda */
  password?: string;
}

export type PaymentMethod = 'cash' | 'card_vehicle' | 'online';

export interface Booking {
  id: string;
  code: string;
  createdAt: string;
  type: 'transfer' | 'hourly';
  fromId: string;
  toId?: string;
  fromDetail: string;
  toDetail: string;
  fromPoint?: Point;
  toPoint?: Point;
  distanceKm?: number;
  date: string;
  time: string;
  roundTrip: boolean;
  returnDate?: string;
  returnTime?: string;
  hours?: number;
  flightNo: string;
  returnFlightNo?: string;
  adults: number;
  children: number;
  luggage: number;
  vehicleId: string;
  extras: Record<string, number>;
  customer: { name: string; phone: string; email: string };
  /** Hesaplı müşterinin kimliği */
  customerId?: string;
  nameSign: string;
  notes: string;
  /** EUR toplam; 0 = fiyat teklifi bekleniyor */
  price: number;
  displayCurrency: Currency;
  lang: Lang;
  payment: PaymentMethod;
  status: BookingStatus;
  driverId?: string;
  cashCollected?: number;
  adminNote?: string;
  history: { status: BookingStatus; at: string; by?: string }[];
}

export interface Service {
  id: string;
  icon: string;
  title: L10n;
  desc: L10n;
}

export interface Testimonial {
  id: string;
  name: string;
  country: string;
  text: string;
  rating: number;
}

export interface Faq {
  id: string;
  q: L10n;
  a: L10n;
}

export interface Stat {
  id: string;
  value: number;
  suffix: string;
  decimals: boolean;
  label: L10n;
}

export interface Settings {
  companyName: string;
  shortName: string;
  tagline: L10n;
  logo: string;
  accent: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  licenseNo: string;
  instagram: string;
  heroTitle: L10n;
  heroAccent: L10n;
  heroSubtitle: L10n;
  heroImage: string;
  aboutTitle: L10n;
  aboutText: L10n;
  aboutImage: string;
  stats: Stat[];
  services: Service[];
  testimonials: Testimonial[];
  faqs: Faq[];
  rates: Record<Currency, number>;
  roundTripDiscount: number;
  nightSurcharge: number;
  nightStart: string;
  nightEnd: string;
  freeWaitMin: number;
  minLeadHours: number;
  payments: Record<PaymentMethod, boolean>;
  /** Kuş uçuşu → yol mesafesi çarpanı */
  roadFactor: number;
  /** Harita başlangıç merkezi ve arama alanı (minLon,minLat,maxLon,maxLat) */
  mapLat: number;
  mapLng: number;
  searchBbox: string;
  /** Google Maps tarayıcı anahtarı (boşsa OpenStreetMap kullanılır) */
  googleMapsKey: string;
  adminPassword: string;
}

/** Şoförün anlık konumu (yalnızca iş sırasında, izinle) */
export interface LiveLoc {
  lat: number;
  lng: number;
  acc?: number;
  heading?: number;
  speed?: number;
  at: string;
  bookingId?: string;
}

export interface AppState {
  version: number;
  settings: Settings;
  vehicles: Vehicle[];
  locations: Location[];
  routes: RoutePrice[];
  extras: Extra[];
  drivers: Driver[];
  bookings: Booking[];
  /** driverId -> anlık konum */
  live: Record<string, LiveLoc>;
  /** Panelde müşteri listesi; müşteri oturumunda yalnızca kendisi */
  customers: Customer[];
}
