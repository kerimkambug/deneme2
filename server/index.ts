import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createSeed } from '../src/data/seed';
import { quote } from '../src/lib/pricing';
import { haversineKm, resolveZone } from '../src/lib/geo';
import type { AppState, Booking, BookingStatus, Driver, Expense, ExpenseType, LiveLoc, Settlement } from '../src/types';
import { CONFIG_KEYS, createStore, type Config, type CustomerRec } from './db';
import { istanbulDate, istanbulHour, validateBackup, type BackupInfo, type FullBackup } from './backup';
import { addSub, initPush, notify, removeSub, vapidPublicKey } from './push';
import { CHAT_MAX, chatOpen, quickText, type Chat, type ChatMsg } from '../src/lib/chat';
import { checkPassword, clearFails, hashPassword, noteFail, rateLimited, sign, verify, type TokenData } from './auth';

const PORT = Number(process.env.PORT) || 8080;
const DIST = path.resolve(process.env.DIST_DIR || 'dist');
const store = createStore();

/* ======================= Bellek içi durum ======================= */
let config: Config;
const bookings = new Map<string, Booking>();
const live: Record<string, LiveLoc> = {};
const customers = new Map<string, CustomerRec>();
let ledger: { expenses: Expense[]; settlements: Settlement[] } = { expenses: [], settlements: [] };
const publicCustomer = ({ passHash: _p, ...c }: CustomerRec) => c;
const ACTIVE: BookingStatus[] = ['on_way', 'arrived', 'onboard'];

const state = (): AppState => ({ version: 3, ...config, bookings: [...bookings.values()], live, customers: [...customers.values()].map(publicCustomer), ...ledger });

/** Tek seferlik veri güncellemeleri (her biri yalnızca bir kez çalışır) */
async function runMigrations() {
  const done = await store.getMigrations();
  if (!done.includes('2026-11-de-pl')) {
    // Değiştirilmemiş örnek içeriklere Almanca/Lehçe çevirileri ekle
    const dict = new Map<string, { de: string; pl: string }>();
    const collect = (o: unknown) => {
      if (!o || typeof o !== 'object') return;
      const x = o as Record<string, unknown>;
      if (typeof x.en === 'string' && typeof x.tr === 'string' && typeof x.de === 'string' && x.de) dict.set(x.en, { de: x.de, pl: String(x.pl ?? '') });
      Object.values(x).forEach(collect);
    };
    const fill = (o: unknown) => {
      if (!o || typeof o !== 'object') return;
      const x = o as Record<string, unknown>;
      if (typeof x.en === 'string' && typeof x.tr === 'string') {
        const t = dict.get(x.en);
        if (t && !x.de) x.de = t.de;
        if (t && !x.pl) x.pl = t.pl;
      }
      Object.values(x).forEach(fill);
    };
    collect(createSeed());
    fill(config);
    await store.setConfig(config);
    await store.addMigration('2026-11-de-pl');
    console.log('[migration] Almanca/Lehçe çeviriler eklendi');
  }
  if (!done.includes('2026-11-clear-demo') && process.env.SEED_DEMO === '1') {
    // Demo kurulumunda örnek veriler kalır
    await store.addMigration('2026-11-clear-demo');
  } else if (!done.includes('2026-11-clear-demo')) {
    // Hazır örnek rezervasyonları ve örnek şoförleri kaldır (gerçek kayıtlara dokunmaz)
    const demoDrivers = new Set(['d1', 'd2', 'd3']);
    let nb = 0;
    for (const b of [...bookings.values()]) {
      if (b.id.startsWith('demo-')) {
        bookings.delete(b.id);
        await store.deleteBooking(b.id);
        nb++;
      } else if (b.driverId && demoDrivers.has(b.driverId)) {
        const nextStatus = ['assigned', 'on_way', 'arrived', 'onboard'].includes(b.status) ? 'confirmed' : b.status;
        const next = { ...b, driverId: undefined, status: nextStatus };
        bookings.set(b.id, next);
        await store.upsertBooking(next);
      }
    }
    const before = config.drivers.length;
    config.drivers = config.drivers.filter((d) => !(demoDrivers.has(d.id) && d.pin === '1234'));
    for (const id of demoDrivers) delete live[id];
    await store.setConfig(config);
    await store.addMigration('2026-11-clear-demo');
    console.log(`[migration] örnek veriler temizlendi: ${nb} rezervasyon, ${before - config.drivers.length} şoför`);
  }
}

async function boot() {
  await store.init();
  const saved = await store.getConfig();
  if (saved) {
    const { bookings: _sb, live: _sl, customers: _sc, version: _sv, expenses: _se, settlements: _ss, ...seedCfg } = createSeed();
    // Yapılandırmaya yalnızca ayar anahtarları girsin (eski kayıtlarda karışmış rezervasyon vb. atılır)
    const clean = Object.fromEntries(Object.entries(saved).filter(([k]) => (CONFIG_KEYS as readonly string[]).includes(k))) as Partial<Config>;
    config = { ...seedCfg, ...clean, fleet: clean.fleet ?? [], settings: { ...seedCfg.settings, ...clean.settings } } as Config;
    for (const b of await store.listBookings()) bookings.set(b.id, b);
    for (const c of await store.listCustomers()) customers.set(c.id, c);
  } else {
    const seed = createSeed();
    const { bookings: demo, live: _l, version: _v, customers: _c, expenses: _e, settlements: _s, ...rest } = seed;
    config = rest;
    // Örnek şoförler yalnızca demo kurulumunda eklenir; gerçek kurulumda panelden oluşturulur
    if (process.env.SEED_DEMO !== '1') config.drivers = [];
    await store.setConfig(config);
    if (process.env.SEED_DEMO === '1') {
      for (const b of demo) {
        bookings.set(b.id, b);
        await store.upsertBooking(b);
      }
    }
    console.log('[boot] başlangıç verileri yüklendi');
  }
  await runMigrations();
  await initPush(store);
  ledger = (await store.getKv<typeof ledger>('ledger')) ?? { expenses: [], settlements: [] };
  void purgeOldChats();
  setTimeout(() => void nightlyBackup(), 60e3);
  if (!(await store.getAdminHash())) {
    await store.setAdminHash(hashPassword(process.env.ADMIN_PASSWORD || 'admin123'));
    if (!process.env.ADMIN_PASSWORD) console.warn('[boot] ADMIN_PASSWORD yok, panel şifresi: admin123');
  }
  config.settings.adminPassword = '';
  if (!config.settings.googleMapsKey && process.env.GOOGLE_MAPS_KEY) config.settings.googleMapsKey = process.env.GOOGLE_MAPS_KEY;
}

/* ======================= Görünümler (kim neyi görür) ======================= */
const publicDriver = (d: Driver) => ({ id: d.id, name: d.name, phone: d.phone, plate: d.plate, vehicleId: d.vehicleId, languages: d.languages, active: d.active, pin: '' });

function publicConfig(): Config {
  return { ...config, settings: { ...config.settings, adminPassword: '' }, drivers: [], fleet: [] };
}

function trackView(b: Booking) {
  const { adminNote: _a, cashCollected: _c, ...rest } = b;
  const d = config.drivers.find((x) => x.id === b.driverId);
  const showDriver = d && ['assigned', 'on_way', 'arrived', 'onboard'].includes(b.status);
  const loc = showDriver && ACTIVE.includes(b.status) ? live[d.id] : undefined;
  return { booking: rest as Booking, driver: showDriver ? publicDriver(d) : null, live: loc ?? null };
}

/* ======================= WebSocket yayını ======================= */
interface Client {
  ws: WebSocket;
  role: 'public' | 'admin' | 'driver' | 'customer';
  driverId?: string;
  customerId?: string;
  track?: string;
}
const clients = new Set<Client>();
const send = (c: Client, msg: unknown) => c.ws.readyState === WebSocket.OPEN && c.ws.send(JSON.stringify(msg));

function broadcastConfig() {
  for (const c of clients) {
    if (c.role === 'admin') send(c, { t: 'config', data: { ...config, settings: { ...config.settings, adminPassword: '' } } });
    else if (c.role === 'driver') {
      const me = config.drivers.find((d) => d.id === c.driverId);
      send(c, { t: 'config', data: { ...publicConfig(), drivers: me ? [publicDriver(me)] : [] } });
    } else send(c, { t: 'config', data: publicConfig() });
  }
}

function broadcastBooking(b: Booking, prevDriverId?: string, deleted = false) {
  for (const c of clients) {
    if (c.role === 'admin') send(c, deleted ? { t: 'booking-del', id: b.id } : { t: 'booking', data: b });
    else if (c.role === 'driver') {
      if (!deleted && b.driverId === c.driverId) send(c, { t: 'booking', data: b });
      else if (prevDriverId === c.driverId || (deleted && b.driverId === c.driverId)) send(c, { t: 'booking-del', id: b.id });
    } else if (c.role === 'customer') {
      if (b.customerId === c.customerId) send(c, deleted ? { t: 'booking-del', id: b.id } : { t: 'cview', data: trackView(b) });
    } else if (c.track && c.track === b.code) {
      if (deleted) send(c, { t: 'track', data: null });
      else send(c, { t: 'track', data: trackView(b) });
    }
  }
}

function broadcastLive(driverId: string) {
  const loc = live[driverId] ?? null;
  for (const c of clients) {
    if (c.role === 'admin') send(c, { t: 'live', driverId, data: loc });
    else if (c.role === 'customer') {
      const mine = [...bookings.values()].some((x) => x.customerId === c.customerId && x.driverId === driverId && ACTIVE.includes(x.status));
      if (mine) send(c, { t: 'live', driverId, data: loc });
    } else if (c.track) {
      const b = [...bookings.values()].find((x) => x.code === c.track);
      if (b && b.driverId === driverId && ACTIVE.includes(b.status)) send(c, { t: 'live', driverId, data: loc });
    }
  }
}

/* ======================= Yardımcılar ======================= */
async function saveBooking(b: Booking, prevDriverId?: string) {
  bookings.set(b.id, b);
  await store.upsertBooking(b);
  // İş bitince şoförün canlı konumunu kapat
  if (b.driverId && !ACTIVE.includes(b.status) && live[b.driverId]?.bookingId === b.id) {
    delete live[b.driverId];
    broadcastLive(b.driverId);
  }
  broadcastBooking(b, prevDriverId);
  const c = chats.get(b.id);
  if (c) {
    const payload = { t: 'chat', bookingId: b.id, code: b.code, open: chatOpen(b.status, b.driverId), chat: c };
    for (const cl of clients) if (cl.role === 'admin' || (cl.role === 'driver' && cl.driverId === b.driverId) || cl.track === b.code) send(cl, payload);
  }
}

const auth = (role: TokenData['role']) => (req: Request, res: Response, next: NextFunction) => {
  const t = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
  if (!t || t.role !== role) return res.status(401).json({ error: 'Oturum geçersiz, lütfen tekrar giriş yapın.' });
  (req as Request & { user: TokenData }).user = t;
  next();
};
const user = (req: Request) => (req as Request & { user: TokenData }).user;
const ip = (req: Request) => (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Sunucu hatası' });
  });

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, min = 0, max = 1e6) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const validPoint = (p: unknown) => {
  const x = p as { lat?: unknown; lng?: unknown; label?: unknown } | undefined;
  if (!x || typeof x.lat !== 'number' || typeof x.lng !== 'number' || Math.abs(x.lat) > 90 || Math.abs(x.lng) > 180) return undefined;
  const pt = { label: str(x.label, 160), sub: str((x as { sub?: unknown }).sub, 200) || undefined, lat: x.lat, lng: x.lng, kind: str((x as { kind?: unknown }).kind, 10) as never };
  return { ...pt, zoneId: resolveZone(state(), pt)?.id };
};

/** Bildirim metni için kısa özet */
function tripLine(b: Booking) {
  const name = (p?: { label: string }, id?: string) => p?.label || config.locations.find((l) => l.id === id)?.name || '';
  const route = b.type === 'hourly' ? `${name(b.fromPoint, b.fromId)} · ${b.hours} saat` : `${name(b.fromPoint, b.fromId)} → ${name(b.toPoint, b.toId)}`;
  return `${b.date.split('-').reverse().slice(0, 2).join('.')} ${b.time} · ${route}`;
}

/* ======================= Uygulama ======================= */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// --- Herkese açık
app.get('/api/public', (_req, res) => res.json(publicConfig()));

app.get('/api/drivers', (_req, res) => res.json(config.drivers.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name }))));

app.post('/api/bookings', wrap(async (req, res) => {
  const b = req.body as Partial<Booking>;
  const type = b.type === 'hourly' ? 'hourly' : 'transfer';
  const fromPoint = validPoint(b.fromPoint);
  const toPoint = type === 'transfer' ? validPoint(b.toPoint) : undefined;
  const vehicle = config.vehicles.find((v) => v.id === b.vehicleId && v.active);
  const name = str(b.customer?.name, 80).trim();
  const phone = str(b.customer?.phone, 40).trim();
  if (!fromPoint || (type === 'transfer' && !toPoint) || !vehicle || !name || phone.replace(/\D/g, '').length < 7 || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) || !/^\d{2}:\d{2}$/.test(String(b.time))) {
    return res.status(400).json({ error: 'Eksik veya hatalı bilgi.' });
  }
  const adults = num(b.adults, 1, 60);
  const children = num(b.children, 0, 30);
  if (vehicle.pax < adults + children) return res.status(400).json({ error: 'Araç kapasitesi yetersiz.' });
  const extras: Record<string, number> = {};
  for (const e of config.extras.filter((x) => x.active)) {
    const n = num(b.extras?.[e.id], 0, e.maxQty);
    if (n) extras[e.id] = n;
  }
  const roundTrip = type === 'transfer' && !!b.roundTrip;
  const q = quote(state(), {
    type, fromId: fromPoint.zoneId, toId: toPoint?.zoneId, fromPoint, toPoint, vehicleId: vehicle.id, roundTrip,
    time: b.time, returnTime: b.returnTime, hours: num(b.hours, 1, 24), extras,
    date: String(b.date), returnDate: roundTrip ? str(b.returnDate, 10) : undefined, promo: str(b.promoCode, 30),
  });
  if (b.promoCode && !q.promoCode) return res.status(400).json({ error: 'İndirim kodu geçersiz veya süresi dolmuş.' });
  if (q.promoCode) {
    const pc = config.settings.promoCodes.find((p) => p.code.toUpperCase() === q.promoCode.toUpperCase());
    const used = [...bookings.values()].filter((x) => x.promoCode?.toUpperCase() === q.promoCode.toUpperCase() && x.status !== 'cancelled').length;
    if (pc && pc.maxUses > 0 && used >= pc.maxUses) return res.status(400).json({ error: 'İndirim kodu kullanım sınırına ulaştı.' });
  }
  let code = str(b.code, 12).toUpperCase();
  if (!/^VT[A-Z0-9]{5}$/.test(code) || [...bookings.values()].some((x) => x.code === code)) {
    code = 'VT' + Math.random().toString(36).slice(2, 7).toUpperCase();
  }
  const now = new Date().toISOString();
  const booking: Booking = {
    id: 'b_' + Math.random().toString(36).slice(2, 11),
    code,
    createdAt: now,
    type,
    fromId: fromPoint.zoneId ?? '',
    toId: toPoint ? toPoint.zoneId ?? '' : undefined,
    fromPoint,
    toPoint,
    distanceKm: q.km ?? undefined,
    fromDetail: str(b.fromDetail, 200),
    toDetail: str(b.toDetail, 200),
    date: String(b.date),
    time: String(b.time),
    roundTrip,
    returnDate: roundTrip ? str(b.returnDate, 10) : undefined,
    returnTime: roundTrip ? str(b.returnTime, 5) : undefined,
    hours: type === 'hourly' ? num(b.hours, 1, 24) : undefined,
    flightNo: str(b.flightNo, 20).toUpperCase(),
    returnFlightNo: str(b.returnFlightNo, 20).toUpperCase() || undefined,
    adults,
    children,
    luggage: num(b.luggage, 0, 60),
    vehicleId: vehicle.id,
    extras,
    customer: { name, phone, email: str(b.customer?.email, 120) },
    nameSign: str(b.nameSign, 80) || name,
    notes: str(b.notes, 1000),
    price: q.total,
    promoCode: q.promoCode || undefined,
    displayCurrency: (['EUR', 'TRY', 'USD', 'GBP'].includes(String(b.displayCurrency)) ? b.displayCurrency : 'EUR') as Booking['displayCurrency'],
    lang: (['tr', 'en', 'ru', 'de', 'pl'].includes(String(b.lang)) ? b.lang : 'en') as Booking['lang'],
    payment: config.settings.payments[b.payment as keyof typeof config.settings.payments] ? (b.payment as Booking['payment']) : 'cash',
    status: 'new',
    history: [{ status: 'new', at: now }],
  };
  const ct = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
  if (ct?.role === 'customer' && ct.id && customers.has(ct.id)) booking.customerId = ct.id;
  await saveBooking(booking);
  void notify({ role: 'admin' }, {
    title: `Yeni rezervasyon · ${booking.code}`,
    body: `${booking.customer.name} · ${tripLine(booking)}${booking.price ? ` · ${booking.price}€` : ' · fiyat teklifi'}`,
    url: '/panel/rezervasyonlar',
    tag: booking.code,
  });
  res.json(trackView(booking));
}));

app.post('/api/track/:code/review', wrap(async (req, res) => {
  const b = [...bookings.values()].find((x) => x.code === String(req.params.code).toUpperCase());
  if (!b) return res.status(404).json({ error: 'Bulunamadı' });
  if (b.status !== 'completed') return res.status(400).json({ error: 'Transfer tamamlandıktan sonra değerlendirebilirsiniz.' });
  if (b.review) return res.status(409).json({ error: 'Bu yolculuk zaten değerlendirildi.' });
  const rating = Math.round(num(req.body?.rating, 1, 5));
  const next: Booking = { ...b, review: { rating, text: str(req.body?.text, 1000).trim(), at: new Date().toISOString() } };
  await saveBooking(next);
  void notify({ role: 'admin' }, { title: `${'★'.repeat(rating)} Yeni değerlendirme`, body: `${b.customer.name}: ${next.review!.text.slice(0, 120) || '(yorum yok)'}`, url: '/panel/icerik', tag: 'rv-' + b.code });
  res.json(trackView(next));
}));

app.get('/api/track/:code', (req, res) => {
  const b = [...bookings.values()].find((x) => x.code === String(req.params.code).toUpperCase());
  if (!b) return res.status(404).json({ error: 'Bulunamadı' });
  res.json(trackView(b));
});

// --- Müşteri hesabı
const normEmail = (e: unknown) => str(e, 120).trim().toLowerCase();
const normPhone = (p: unknown) => str(p, 40).replace(/\D/g, '');
const findCustomer = (login: string) => {
  const e = login.trim().toLowerCase();
  const ph = normPhone(login);
  return [...customers.values()].find((c) => c.email === e || (ph.length >= 7 && normPhone(c.phone).endsWith(ph.slice(-10))));
};

function customerView(c: CustomerRec) {
  const mine = [...bookings.values()].filter((b) => b.customerId === c.id);
  return { customer: publicCustomer(c), views: mine.map(trackView) };
}

app.post('/api/customer/register', wrap(async (req, res) => {
  const key = 'cr:' + ip(req);
  if (rateLimited(key)) return res.status(429).json({ error: 'Çok fazla deneme. 10 dakika sonra tekrar deneyin.' });
  const name = str(req.body?.name, 80).trim();
  const email = normEmail(req.body?.email);
  const phone = str(req.body?.phone, 40).trim();
  const password = str(req.body?.password, 200);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || normPhone(phone).length < 7) return res.status(400).json({ error: 'Ad, geçerli e-posta ve telefon gerekli.', code: 'invalid' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.', code: 'weak' });
  if (findCustomer(email) || findCustomer(phone)) {
    noteFail(key);
    return res.status(409).json({ error: 'Bu e-posta veya telefonla kayıtlı bir hesap var. Lütfen giriş yapın.', code: 'exists' });
  }
  const c: CustomerRec = { id: 'c_' + Math.random().toString(36).slice(2, 11), name, email, phone, createdAt: new Date().toISOString(), passHash: hashPassword(password) };
  customers.set(c.id, c);
  await store.upsertCustomer(c);
  broadcastAdminCustomers();
  res.json({ token: sign({ role: 'customer', id: c.id }, 180), ...customerView(c) });
}));

app.post('/api/customer/login', wrap(async (req, res) => {
  const key = 'cl:' + ip(req);
  if (rateLimited(key)) return res.status(429).json({ error: 'Çok fazla deneme. 10 dakika sonra tekrar deneyin.' });
  const c = findCustomer(str(req.body?.login, 120));
  if (!c || !checkPassword(str(req.body?.password, 200), c.passHash)) {
    noteFail(key);
    return res.status(401).json({ error: 'E-posta/telefon veya şifre hatalı.' });
  }
  clearFails(key);
  res.json({ token: sign({ role: 'customer', id: c.id }, 180), ...customerView(c) });
}));

app.get('/api/customer/me', auth('customer'), (req, res) => {
  const c = customers.get(user(req).id!);
  if (!c) return res.status(401).json({ error: 'Hesap bulunamadı' });
  res.json(customerView(c));
});

app.patch('/api/customer/me', auth('customer'), wrap(async (req, res) => {
  const c = customers.get(user(req).id!);
  if (!c) return res.status(401).json({ error: 'Hesap bulunamadı' });
  if (req.body?.name) c.name = str(req.body.name, 80).trim() || c.name;
  if (req.body?.phone && normPhone(req.body.phone).length >= 7) c.phone = str(req.body.phone, 40).trim();
  if (req.body?.password) {
    if (!checkPassword(str(req.body?.oldPassword, 200), c.passHash)) return res.status(400).json({ error: 'Mevcut şifre hatalı.' });
    if (String(req.body.password).length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
    c.passHash = hashPassword(String(req.body.password));
  }
  await store.upsertCustomer(c);
  broadcastAdminCustomers();
  res.json(customerView(c));
}));

app.post('/api/customer/claim', auth('customer'), wrap(async (req, res) => {
  const c = customers.get(user(req).id!);
  const b = [...bookings.values()].find((x) => x.code === str(req.body?.code, 12).toUpperCase().trim());
  if (!c || !b) return res.status(404).json({ error: 'Bu koda ait rezervasyon bulunamadı.' });
  if (b.customerId && b.customerId !== c.id) return res.status(409).json({ error: 'Bu rezervasyon başka bir hesaba bağlı.' });
  if (!b.customerId) await saveBooking({ ...b, customerId: c.id });
  res.json(customerView(c));
}));

function broadcastAdminCustomers() {
  const list = [...customers.values()].map(publicCustomer);
  for (const c of clients) if (c.role === 'admin') send(c, { t: 'customers', data: list });
}

app.post('/api/admin/customers/:id/password', auth('admin'), wrap(async (req, res) => {
  const c = customers.get(req.params.id);
  const pw = str(req.body?.password, 200);
  if (!c) return res.status(404).json({ error: 'Bulunamadı' });
  if (pw.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  c.passHash = hashPassword(pw);
  await store.upsertCustomer(c);
  res.json({ ok: true });
}));

app.delete('/api/admin/customers/:id', auth('admin'), wrap(async (req, res) => {
  const c = customers.get(req.params.id);
  if (c) {
    customers.delete(c.id);
    await store.deleteCustomer(c.id);
    for (const b of bookings.values()) if (b.customerId === c.id) await saveBooking({ ...b, customerId: undefined });
    broadcastAdminCustomers();
  }
  res.json({ ok: true });
}));

// --- Yönetici
app.post('/api/admin/login', wrap(async (req, res) => {
  const key = 'a:' + ip(req);
  if (rateLimited(key)) return res.status(429).json({ error: 'Çok fazla deneme. 10 dakika sonra tekrar deneyin.' });
  const h = await store.getAdminHash();
  if (!h || !checkPassword(str(req.body?.password, 200), h)) {
    noteFail(key);
    return res.status(401).json({ error: 'Şifre hatalı.' });
  }
  clearFails(key);
  res.json({ token: sign({ role: 'admin' }) });
}));

app.get('/api/admin/state', auth('admin'), (_req, res) => res.json(state()));

app.put('/api/admin/config', auth('admin'), wrap(async (req, res) => {
  const body = req.body as Partial<Config>;
  for (const k of CONFIG_KEYS) {
    if (body[k] !== undefined) (config as Record<string, unknown>)[k] = body[k];
  }
  const pw = config.settings.adminPassword;
  if (pw) {
    if (pw.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
    await store.setAdminHash(hashPassword(pw));
    config.settings.adminPassword = '';
  }
  await store.setConfig(config);
  broadcastConfig();
  res.json({ ok: true });
}));

app.post('/api/admin/bookings', auth('admin'), wrap(async (req, res) => {
  const b = req.body as Booking;
  if (!b?.id || !b.code) return res.status(400).json({ error: 'Geçersiz kayıt' });
  await saveBooking(b);
  res.json({ ok: true });
}));

app.patch('/api/admin/bookings/:id', auth('admin'), wrap(async (req, res) => {
  const prev = bookings.get(req.params.id);
  if (!prev) return res.status(404).json({ error: 'Bulunamadı' });
  const next = { ...prev, ...req.body, id: prev.id, code: prev.code, createdAt: prev.createdAt } as Booking;
  await saveBooking(next, prev.driverId !== next.driverId ? prev.driverId : undefined);
  if (next.driverId && next.driverId !== prev.driverId) {
    void notify({ role: 'driver', driverId: next.driverId }, { title: 'Yeni iş atandı', body: `${next.customer.name} · ${tripLine(next)}`, url: '/surucu', tag: next.code });
  }
  if (prev.driverId && prev.driverId !== next.driverId) {
    void notify({ role: 'driver', driverId: prev.driverId }, { title: 'İş sizden alındı', body: `${prev.code} · ${tripLine(prev)}`, url: '/surucu', tag: prev.code });
  }
  if (next.status === 'cancelled' && prev.status !== 'cancelled' && next.driverId) {
    void notify({ role: 'driver', driverId: next.driverId }, { title: 'İş iptal edildi', body: `${next.code} · ${tripLine(next)}`, url: '/surucu', tag: next.code });
  }
  res.json({ ok: true });
}));

app.delete('/api/admin/bookings/:id', auth('admin'), wrap(async (req, res) => {
  const b = bookings.get(req.params.id);
  if (b) {
    bookings.delete(b.id);
    await store.deleteBooking(b.id);
    broadcastBooking(b, undefined, true);
  }
  res.json({ ok: true });
}));

// --- Şoför–yolcu mesajlaşması
const chats = new Map<string, Chat>();
const chatKey = (id: string) => `chat:${id}`;
async function getChat(id: string): Promise<Chat> {
  let c = chats.get(id);
  if (!c) {
    c = (await store.getKv<Chat>(chatKey(id))) ?? { messages: [], read: {} };
    chats.set(id, c);
  }
  return c;
}
async function saveChat(b: Booking, c: Chat) {
  chats.set(b.id, c);
  await store.setKv(chatKey(b.id), c);
  const payload = { t: 'chat', bookingId: b.id, code: b.code, open: chatOpen(b.status, b.driverId), chat: c };
  for (const cl of clients) {
    if (cl.role === 'admin' || (cl.role === 'driver' && cl.driverId === b.driverId) || (cl.track && cl.track === b.code) || (cl.role === 'customer' && b.customerId && cl.customerId === b.customerId)) {
      send(cl, payload);
    }
  }
}
const byCode = (code: string) => [...bookings.values()].find((x) => x.code === String(code).toUpperCase());

async function postMessage(b: Booking, from: ChatMsg['from'], body: { text?: unknown; qr?: unknown }) {
  if (!chatOpen(b.status, b.driverId)) return { error: 'Sohbet kapalı. Şoför atandıktan sonra açılır, transfer bitince kapanır.', code: 403 };
  const c = await getChat(b.id);
  const recent = c.messages.filter((m) => m.from === from && Date.now() - Date.parse(m.at) < 5 * 60e3).length;
  if (recent >= 30) return { error: 'Çok fazla mesaj gönderildi, lütfen biraz bekleyin.', code: 429 };
  const qr = typeof body.qr === 'string' && quickText(body.qr, 'tr') ? body.qr : undefined;
  const lang = from === 'customer' ? b.lang : 'tr';
  const text = qr ? quickText(qr, lang)! : str(body.text, CHAT_MAX).trim();
  if (!text) return { error: 'Mesaj boş.', code: 400 };
  const msg: ChatMsg = { id: 'm_' + Math.random().toString(36).slice(2, 10), from, text, qr, at: new Date().toISOString() };
  c.messages.push(msg);
  c.read[from] = msg.at;
  await saveChat(b, c);
  if (from === 'customer' && b.driverId) {
    void notify({ role: 'driver', driverId: b.driverId }, { title: `💬 ${b.customer.name}`, body: quickText(qr ?? '', 'tr') ?? text, url: '/surucu', tag: 'chat-' + b.code });
  }
  return { chat: c };
}

// Yolcu (rezervasyon kodu ile)
app.get('/api/chat/:code', wrap(async (req, res) => {
  const b = byCode(String(req.params.code));
  if (!b) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ open: chatOpen(b.status, b.driverId), chat: await getChat(b.id) });
}));
app.post('/api/chat/:code', wrap(async (req, res) => {
  const b = byCode(String(req.params.code));
  if (!b) return res.status(404).json({ error: 'Bulunamadı' });
  const r = await postMessage(b, 'customer', req.body ?? {});
  if (r.error) return res.status(r.code!).json({ error: r.error });
  res.json(r);
}));
app.post('/api/chat/:code/read', wrap(async (req, res) => {
  const b = byCode(String(req.params.code));
  if (!b) return res.status(404).json({ error: 'Bulunamadı' });
  const c = await getChat(b.id);
  c.read.customer = new Date().toISOString();
  await saveChat(b, c);
  res.json({ ok: true });
}));

// Şoför (yalnızca kendisine atanmış iş)
const driverBooking = (req: Request) => {
  const b = bookings.get(req.params.id);
  return b && b.driverId === user(req).id ? b : undefined;
};
app.get('/api/driver/chat/:id', auth('driver'), wrap(async (req, res) => {
  const b = driverBooking(req);
  if (!b) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ open: chatOpen(b.status, b.driverId), chat: await getChat(b.id) });
}));
app.post('/api/driver/chat/:id', auth('driver'), wrap(async (req, res) => {
  const b = driverBooking(req);
  if (!b) return res.status(404).json({ error: 'Bulunamadı' });
  const r = await postMessage(b, 'driver', req.body ?? {});
  if (r.error) return res.status(r.code!).json({ error: r.error });
  res.json(r);
}));
app.post('/api/driver/chat/:id/read', auth('driver'), wrap(async (req, res) => {
  const b = driverBooking(req);
  if (!b) return res.status(404).json({ error: 'Bulunamadı' });
  const c = await getChat(b.id);
  c.read.driver = new Date().toISOString();
  await saveChat(b, c);
  res.json({ ok: true });
}));

// Patron (yalnızca okuma)
app.get('/api/admin/chat/:id', auth('admin'), wrap(async (req, res) => {
  const b = bookings.get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ open: chatOpen(b.status, b.driverId), chat: await getChat(b.id) });
}));

// Transferi 30 günden önce biten sohbetleri sil (kişisel veri saklama süresi)
async function purgeOldChats() {
  const limit = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  for (const b of bookings.values()) {
    if (b.date < limit && !chatOpen(b.status, b.driverId)) {
      const c = chats.get(b.id) ?? (await store.getKv<Chat>(chatKey(b.id)));
      if (c && c.messages.length) {
        chats.delete(b.id);
        await store.setKv(chatKey(b.id), { messages: [], read: {} });
      }
    }
  }
}
setInterval(() => void purgeOldChats().catch(() => undefined), 6 * 3600e3);

// --- Tam yedekleme
const KV_KEYS = ['vapid', 'push-subs', 'ledger'] as const;
const KEEP_AUTO = 7;

async function buildBackup(reason: string): Promise<FullBackup> {
  const kv: Record<string, unknown> = {};
  for (const k of KV_KEYS) {
    const v = await store.getKv(k);
    if (v != null) kv[k] = v;
  }
  const chatMap: Record<string, Chat> = {};
  for (const b of bookings.values()) {
    const c = chats.get(b.id) ?? (await store.getKv<Chat>(chatKey(b.id)));
    if (c && c.messages.length) chatMap[b.id] = c;
  }
  return {
    format: 'vip-transfer-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    reason,
    config: { ...config, settings: { ...config.settings, adminPassword: '' } },
    bookings: [...bookings.values()],
    customers: [...customers.values()],
    adminHash: await store.getAdminHash(),
    migrations: await store.getMigrations(),
    kv,
    chats: chatMap,
  };
}

const backupIndex = async () => (await store.getKv<BackupInfo[]>('backup-index')) ?? [];

/** Yedeği veritabanında saklar; eskileri siler (otomatik olanlardan son 7'si, elle alınanlardan son 10'u kalır). */
async function saveBackup(reason: string): Promise<BackupInfo> {
  const data = await buildBackup(reason);
  const json = JSON.stringify(data);
  if (json.length > 15 * 1024 * 1024) throw new Error('Yedek 15 MB’ı aşıyor; veritabanında saklanamadı. “Tam yedek indir” ile bilgisayara alın.');
  const info: BackupInfo = { id: 'bk_' + Date.now().toString(36), at: data.createdAt, reason, size: json.length, bookings: data.bookings.length, customers: data.customers.length };
  await store.setKv(`backup:${info.id}`, data);
  let idx = [info, ...(await backupIndex())];
  const auto = idx.filter((x) => x.reason === 'gece');
  const other = idx.filter((x) => x.reason !== 'gece');
  const drop = [...auto.slice(KEEP_AUTO), ...other.slice(10)];
  for (const d of drop) await store.setKv(`backup:${d.id}`, null);
  idx = idx.filter((x) => !drop.some((d) => d.id === x.id));
  await store.setKv('backup-index', idx);
  return info;
}

/** Yedeği geri yükler: her şey dosyadaki hale döner. */
async function restoreBackup(b: FullBackup) {
  // Önce şimdiki durumun yedeği
  await saveBackup('geri yükleme öncesi');
  const keepPw = config.settings.adminPassword;
  config = { ...b.config, settings: { ...b.config.settings, adminPassword: keepPw } } as Config;
  await store.setConfig(config);
  const keepIds = new Set(b.bookings.map((x) => x.id));
  for (const old of [...bookings.values()]) {
    if (!keepIds.has(old.id)) await store.deleteBooking(old.id);
    await store.setKv(chatKey(old.id), { messages: [], read: {} });
  }
  bookings.clear();
  for (const x of b.bookings) {
    bookings.set(x.id, x);
    await store.upsertBooking(x);
  }
  const keepCust = new Set(b.customers.map((x) => x.id));
  for (const old of [...customers.values()]) if (!keepCust.has(old.id)) await store.deleteCustomer(old.id);
  customers.clear();
  for (const c of b.customers) {
    customers.set(c.id, c);
    await store.upsertCustomer(c);
  }
  if (b.adminHash) await store.setAdminHash(b.adminHash);
  const done = await store.getMigrations();
  for (const m of b.migrations ?? []) if (!done.includes(m)) await store.addMigration(m);
  for (const k of KV_KEYS) if (b.kv[k] != null) await store.setKv(k, b.kv[k]);
  ledger = (b.kv.ledger as typeof ledger) ?? { expenses: [], settlements: [] };
  chats.clear();
  for (const [id, c] of Object.entries(b.chats)) {
    chats.set(id, c);
    await store.setKv(chatKey(id), c);
  }
  for (const id of Object.keys(live)) delete live[id];
  await initPush(store);
  broadcastConfig();
  // Açık panelleri ve ekranları yeniden yüklet
  for (const c of clients) send(c, { t: 'reload' });
}

app.get('/api/admin/backup', auth('admin'), wrap(async (_req, res) => {
  const data = await buildBackup('elle indirildi');
  res.setHeader('Content-Disposition', `attachment; filename="vip-transfer-yedek-${istanbulDate()}.json"`);
  res.json(data);
}));
app.post('/api/admin/restore', auth('admin'), wrap(async (req, res) => {
  const err = validateBackup(req.body);
  if (err) return res.status(400).json({ error: err });
  await restoreBackup(req.body as FullBackup);
  res.json({ ok: true });
}));
app.get('/api/admin/backups', auth('admin'), wrap(async (_req, res) => res.json(await backupIndex())));
app.post('/api/admin/backups', auth('admin'), wrap(async (_req, res) => {
  try {
    res.json(await saveBackup('elle'));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
}));
app.get('/api/admin/backups/:id', auth('admin'), wrap(async (req, res) => {
  const data = await store.getKv<FullBackup>(`backup:${req.params.id}`);
  if (!data) return res.status(404).json({ error: 'Yedek bulunamadı' });
  res.setHeader('Content-Disposition', `attachment; filename="vip-transfer-yedek-${data.createdAt.slice(0, 10)}.json"`);
  res.json(data);
}));
app.post('/api/admin/backups/:id/restore', auth('admin'), wrap(async (req, res) => {
  const data = await store.getKv<FullBackup>(`backup:${req.params.id}`);
  if (!data || validateBackup(data)) return res.status(404).json({ error: 'Yedek bulunamadı' });
  await restoreBackup(data);
  res.json({ ok: true });
}));

// Gece yedeği: her gün Türkiye saatiyle 03:00'ten sonra bir kez
async function nightlyBackup() {
  const today = istanbulDate();
  const idx = await backupIndex();
  if (istanbulHour() < 3 || idx.some((x) => x.reason === 'gece' && istanbulDate(new Date(x.at)) === today)) return;
  try {
    const info = await saveBackup('gece');
    console.log(`[yedek] gece yedeği alındı (${Math.round(info.size / 1024)} KB)`);
  } catch (e) {
    console.warn('[yedek] gece yedeği alınamadı:', (e as Error).message);
  }
}
setInterval(() => void nightlyBackup(), 30 * 60e3);

// --- Masraf ve kasa
async function saveLedger(driverId?: string) {
  await store.setKv('ledger', ledger);
  for (const c of clients) {
    if (c.role === 'admin') send(c, { t: 'ledger', data: ledger });
    else if (c.role === 'driver' && (!driverId || c.driverId === driverId)) {
      send(c, { t: 'ledger', data: { expenses: ledger.expenses.filter((e) => e.driverId === c.driverId), settlements: ledger.settlements.filter((x) => x.driverId === c.driverId) } });
    }
  }
}
const EXP_TYPES: ExpenseType[] = ['fuel', 'parking', 'toll', 'wash', 'other'];
app.post('/api/driver/expenses', auth('driver'), wrap(async (req, res) => {
  const amount = num(req.body?.amount, 0, 1e6);
  const type = EXP_TYPES.includes(req.body?.type) ? (req.body.type as ExpenseType) : 'other';
  if (!amount) return res.status(400).json({ error: 'Tutar girin.' });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date)) ? String(req.body.date) : new Date().toISOString().slice(0, 10);
  ledger.expenses.unshift({ id: 'e_' + Math.random().toString(36).slice(2, 10), driverId: user(req).id!, date, type, amount, note: str(req.body?.note, 200), at: new Date().toISOString() });
  await saveLedger(user(req).id);
  res.json({ ok: true });
}));
app.delete('/api/driver/expenses/:id', auth('driver'), wrap(async (req, res) => {
  const e = ledger.expenses.find((x) => x.id === req.params.id && x.driverId === user(req).id);
  // Şoför yalnızca son 24 saatte girdiği masrafı silebilir
  if (!e || Date.now() - Date.parse(e.at) > 864e5) return res.status(403).json({ error: 'Bu masraf artık silinemez; ofise bildirin.' });
  ledger.expenses = ledger.expenses.filter((x) => x.id !== e.id);
  await saveLedger(e.driverId);
  res.json({ ok: true });
}));
app.delete('/api/admin/expenses/:id', auth('admin'), wrap(async (req, res) => {
  const e = ledger.expenses.find((x) => x.id === req.params.id);
  ledger.expenses = ledger.expenses.filter((x) => x.id !== req.params.id);
  await saveLedger(e?.driverId);
  res.json({ ok: true });
}));
app.post('/api/admin/settlements', auth('admin'), wrap(async (req, res) => {
  const d = config.drivers.find((x) => x.id === req.body?.driverId);
  const amount = num(req.body?.amount, 0, 1e7);
  if (!d || !amount) return res.status(400).json({ error: 'Şoför ve tutar gerekli.' });
  ledger.settlements.unshift({ id: 's_' + Math.random().toString(36).slice(2, 10), driverId: d.id, amount, note: str(req.body?.note, 200), at: new Date().toISOString() });
  await saveLedger(d.id);
  res.json({ ok: true });
}));
app.delete('/api/admin/settlements/:id', auth('admin'), wrap(async (req, res) => {
  const x = ledger.settlements.find((y) => y.id === req.params.id);
  ledger.settlements = ledger.settlements.filter((y) => y.id !== req.params.id);
  await saveLedger(x?.driverId);
  res.json({ ok: true });
}));

// --- Bildirim abonelikleri
app.get('/api/push/key', (_req, res) => res.json({ key: vapidPublicKey() }));
app.post('/api/admin/push', auth('admin'), wrap(async (req, res) => {
  await addSub(req.body, 'admin');
  res.json({ ok: true });
}));
app.post('/api/driver/push', auth('driver'), wrap(async (req, res) => {
  await addSub(req.body, 'driver', user(req).id);
  res.json({ ok: true });
}));
app.post('/api/push/unsubscribe', wrap(async (req, res) => {
  await removeSub(str(req.body?.endpoint, 1000));
  res.json({ ok: true });
}));
app.post('/api/admin/push/test', auth('admin'), wrap(async (_req, res) => {
  await notify({ role: 'admin' }, { title: 'Test bildirimi', body: 'Bildirimler bu cihazda çalışıyor ✓', url: '/panel' });
  res.json({ ok: true });
}));

// --- Şoför
app.post('/api/driver/login', (req, res) => {
  const key = 'd:' + ip(req);
  if (rateLimited(key)) return res.status(429).json({ error: 'Çok fazla deneme. 10 dakika sonra tekrar deneyin.' });
  const d = config.drivers.find((x) => x.id === req.body?.driverId && x.active);
  if (!d || d.pin !== String(req.body?.pin ?? '')) {
    noteFail(key);
    return res.status(401).json({ error: 'PIN hatalı.' });
  }
  clearFails(key);
  res.json({ token: sign({ role: 'driver', id: d.id }, 60) });
});

app.get('/api/driver/state', auth('driver'), (req, res) => {
  const me = config.drivers.find((d) => d.id === user(req).id && d.active);
  if (!me) return res.status(401).json({ error: 'Şoför bulunamadı' });
  res.json({
    version: 3,
    ...publicConfig(),
    drivers: [publicDriver(me)],
    bookings: [...bookings.values()].filter((b) => b.driverId === me.id),
    live: live[me.id] ? { [me.id]: live[me.id] } : {},
    customers: [],
    expenses: ledger.expenses.filter((e) => e.driverId === me.id),
    settlements: ledger.settlements.filter((x) => x.driverId === me.id),
  });
});

app.patch('/api/driver/bookings/:id', auth('driver'), wrap(async (req, res) => {
  const prev = bookings.get(req.params.id);
  if (!prev || prev.driverId !== user(req).id) return res.status(404).json({ error: 'Bulunamadı' });
  const allowed: BookingStatus[] = ['on_way', 'arrived', 'onboard', 'completed', 'no_show'];
  const status = req.body?.status as BookingStatus;
  const next: Booking = { ...prev };
  if (status && status !== prev.status) {
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Geçersiz durum' });
    next.status = status;
    next.history = [...prev.history, { status, at: new Date().toISOString(), by: 'şoför' }];
  }
  if (req.body?.cashCollected !== undefined) next.cashCollected = num(req.body.cashCollected, 0, 1e5);
  await saveBooking(next);
  const dName = config.drivers.find((d) => d.id === prev.driverId)?.name ?? 'Şoför';
  if (status === 'no_show' && prev.status !== 'no_show') {
    void notify({ role: 'admin' }, { title: `Müşteri gelmedi · ${prev.code}`, body: `${dName} · ${prev.customer.name} · ${tripLine(prev)}`, url: '/panel/rezervasyonlar', tag: prev.code });
  }
  res.json({ ok: true });
}));

app.post('/api/driver/location', auth('driver'), (req, res) => {
  const id = user(req).id!;
  if (req.body?.off) {
    delete live[id];
  } else {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Konum geçersiz' });
    const prev = live[id];
    // Çok küçük hareketleri ve aşırı sık gönderimleri yok say
    if (prev && Date.now() - Date.parse(prev.at) < 4000 && haversineKm(prev, { lat, lng }) < 0.02) return res.json({ ok: true });
    live[id] = {
      lat, lng,
      acc: num(req.body.acc, 0, 1e4) || undefined,
      heading: Number.isFinite(Number(req.body.heading)) ? Number(req.body.heading) : undefined,
      speed: Number.isFinite(Number(req.body.speed)) ? Number(req.body.speed) : undefined,
      at: new Date().toISOString(),
      bookingId: str(req.body.bookingId, 40) || undefined,
    };
  }
  broadcastLive(id);
  res.json({ ok: true });
});

// Eski konumları temizle (3 dk sinyal yoksa)
setInterval(() => {
  for (const [id, l] of Object.entries(live)) {
    if (Date.now() - Date.parse(l.at) > 3 * 60e3) {
      delete live[id];
      broadcastLive(id);
    }
  }
}, 30e3);

/* ======================= Site dosyaları ======================= */
const indexHtml = () => {
  try {
    return fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  } catch {
    return null;
  }
};
const escapeJson = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');

app.use('/assets', express.static(path.join(DIST, 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(DIST, { index: false, maxAge: '1h' }));
app.get(/^(?!\/api\/).*/, (_req, res) => {
  const html = indexHtml();
  if (!html) return res.status(500).send('Site derlenmemiş: önce "npm run build:remote" çalıştırın.');
  // Açık ayarları sayfaya göm: ilk açılışta içerik beklemeden görünür
  const s = config.settings;
  const out = html
    .replace(/<title>.*?<\/title>/, `<title>${s.companyName.replace(/</g, '')} | ${s.tagline.tr.replace(/</g, '')}</title>`)
    .replace('</head>', `<script>window.__CONFIG__=${escapeJson(publicConfig())}</script></head>`);
  res.set('Cache-Control', 'no-cache').type('html').send(out);
});

/* ======================= Başlat ======================= */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const u = new URL(req.url || '', 'http://x');
  const t = verify(u.searchParams.get('token'));
  const track = u.searchParams.get('track')?.toUpperCase() || undefined;
  const c: Client = { ws, role: t?.role ?? 'public', driverId: t?.role === 'driver' ? t.id : undefined, customerId: t?.role === 'customer' ? t.id : undefined, track };
  clients.add(c);
  ws.on('close', () => clients.delete(c));
  ws.on('error', () => clients.delete(c));
  // Render gibi platformlarda bağlantı açık kalsın
  const ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.ping(), 25e3);
  ws.on('close', () => clearInterval(ping));
});

boot()
  .then(() => server.listen(PORT, () => console.log(`[http] http://localhost:${PORT}`)))
  .catch((e) => {
    console.error('Başlatılamadı:', e);
    process.exit(1);
  });
