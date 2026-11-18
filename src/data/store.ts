import { useEffect, useSyncExternalStore } from 'react';
import type { AppState, Booking, BookingStatus, Customer, Driver, Expense, LiveLoc } from '../types';
import { createSeed, STATE_VERSION } from './seed';
import { registerKeyGetter } from '../lib/gmaps';

/**
 * Veri katmanı. İki modda çalışır:
 *  - Demo (varsayılan): veriler tarayıcıda (localStorage), sekmeler arası canlı.
 *  - Sunucu (VITE_REMOTE=1): veriler Render sunucusunda; WebSocket ile anlık.
 * Ekranlar her iki modda da aynı fonksiyonları kullanır.
 */
export const REMOTE = import.meta.env.VITE_REMOTE === '1';
const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const KEY = 'vip-transfer:state:v1';
const CONFIG_KEYS = ['settings', 'vehicles', 'locations', 'routes', 'extras', 'drivers', 'fleet'] as const;

type Scope = { kind: 'public' } | { kind: 'admin' } | { kind: 'driver' } | { kind: 'customer' } | { kind: 'track'; code: string };
export type Status = 'ready' | 'loading' | 'error';

/* ---------------- başlangıç durumu ---------------- */
function loadLocal(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === STATE_VERSION) {
        const seed = createSeed();
        return { ...seed, ...parsed, live: parsed.live ?? {}, customers: parsed.customers ?? [], fleet: parsed.fleet ?? [], expenses: parsed.expenses ?? [], settlements: parsed.settlements ?? [], settings: { ...seed.settings, ...parsed.settings } };
      }
    }
  } catch {
    /* bozuk veri -> varsayılan */
  }
  return createSeed();
}

function initialRemote(): AppState {
  const seed = createSeed();
  const injected = (window as unknown as { __CONFIG__?: Partial<AppState> }).__CONFIG__;
  return { ...seed, ...(injected ?? {}), settings: { ...seed.settings, ...(injected?.settings ?? {}) }, bookings: [], live: {}, customers: [], expenses: [], settlements: [], drivers: injected?.drivers ?? [] };
}

let state: AppState = REMOTE ? initialRemote() : loadLocal();

/* ---------------- müşteri hesabı ---------------- */
let account: Customer | null = null;
const LOCAL_ACC = 'vip:account';
const ACC_CACHE = 'vip:account:cache';
try {
  if (!REMOTE) {
    const id = localStorage.getItem(LOCAL_ACC);
    account = state.customers.find((c) => c.id === id) ?? null;
  } else if (localStorage.getItem('vip:token:customer')) {
    account = JSON.parse(localStorage.getItem(ACC_CACHE) || 'null');
  }
} catch {
  /* yok say */
}

/** Sunucu modunda hesap bilgisini önbelleğe al (sayfa yenilenince hemen hazır olsun) */
function setRemoteAccount(c: Customer | null) {
  account = c;
  try {
    if (c) localStorage.setItem(ACC_CACHE, JSON.stringify(c));
    else localStorage.removeItem(ACC_CACHE);
  } catch {
    /* yok say */
  }
}
let status: Status = 'ready';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persistLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

if (!REMOTE && typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = loadLocal();
      emit();
    }
  });
}

registerKeyGetter(() => state.settings.googleMapsKey);

export function getState() {
  return state;
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
  );
}

export function useAccount() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => account,
  );
}

export function useStatus() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
  );
}

/* ---------------- oturumlar ---------------- */
const TOKENS = { admin: 'vip:token:admin', driver: 'vip:token:driver', customer: 'vip:token:customer' } as const;
const getToken = (r: keyof typeof TOKENS) => {
  try {
    return localStorage.getItem(TOKENS[r]);
  } catch {
    return null;
  }
};
const setToken = (r: keyof typeof TOKENS, v: string | null) => {
  try {
    if (v) localStorage.setItem(TOKENS[r], v);
    else localStorage.removeItem(TOKENS[r]);
  } catch {
    /* yok say */
  }
};

/* ---------------- API ---------------- */
class ApiError extends Error {
  status: number;
  constructor(msg: string, status: number) {
    super(msg);
    this.status = status;
  }
}

async function api<T = unknown>(method: string, url: string, body?: unknown, token?: string | null): Promise<T> {
  const r = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError((data as { error?: string }).error || 'Bağlantı hatası', r.status);
  return data as T;
}

function reportError(msg: string) {
  window.dispatchEvent(new CustomEvent('vip:error', { detail: msg }));
}

/* ---------------- kapsam (hangi veriler yüklü) ---------------- */
let scope: Scope = { kind: 'public' };
let ws: WebSocket | null = null;
let wsRetry = 0;
let wsTimer: number | undefined;

const scopeKey = (s: Scope) => (s.kind === 'track' ? `track:${s.code}` : s.kind);

function scopeToken(s: Scope) {
  return s.kind === 'admin' ? getToken('admin') : s.kind === 'driver' ? getToken('driver') : s.kind === 'customer' ? getToken('customer') : null;
}

function setStatus(s: Status) {
  if (status !== s) {
    status = s;
    emit();
  }
}

type TrackView = { booking: Booking; driver: Driver | null; live: LiveLoc | null };
type CustomerView = { customer: Customer; views: TrackView[] };

function applyCustomer(v: CustomerView) {
  setRemoteAccount(v.customer);
  const drivers = new Map<string, Driver>();
  const live: Record<string, LiveLoc> = {};
  for (const x of v.views) {
    if (x.driver) drivers.set(x.driver.id, x.driver);
    if (x.driver && x.live) live[x.driver.id] = x.live;
  }
  state = { ...state, bookings: v.views.map((x) => x.booking), drivers: [...drivers.values()], live, customers: [v.customer] };
}

function upsertView(x: TrackView) {
  const list = [...state.bookings];
  const i = list.findIndex((b) => b.id === x.booking.id);
  if (i >= 0) list[i] = x.booking;
  else list.unshift(x.booking);
  const drivers = x.driver ? [...state.drivers.filter((d) => d.id !== x.driver!.id), x.driver] : state.drivers;
  const live = { ...state.live };
  if (x.driver && x.live) live[x.driver.id] = x.live;
  state = { ...state, bookings: list, drivers, live };
}

function applyTrack(view: { booking: Booking; driver: Driver | null; live: LiveLoc | null } | null) {
  if (!view) {
    state = { ...state, bookings: [], live: {} };
  } else {
    state = {
      ...state,
      bookings: [view.booking],
      drivers: view.driver ? [view.driver] : [],
      live: view.driver && view.live ? { [view.driver.id]: view.live } : {},
    };
  }
}

async function loadScope(s: Scope) {
  setStatus('loading');
  try {
    if (s.kind === 'admin') {
      state = await api<AppState>('GET', '/api/admin/state', undefined, getToken('admin'));
    } else if (s.kind === 'driver') {
      state = await api<AppState>('GET', '/api/driver/state', undefined, getToken('driver'));
    } else if (s.kind === 'customer') {
      const cfg = await api<Partial<AppState>>('GET', '/api/public');
      state = { ...state, ...cfg };
      applyCustomer(await api<CustomerView>('GET', '/api/customer/me', undefined, getToken('customer')));
    } else if (s.kind === 'track') {
      const cfg = await api<Partial<AppState>>('GET', '/api/public');
      state = { ...state, ...cfg };
      try {
        applyTrack(await api('GET', `/api/track/${encodeURIComponent(s.code)}`));
      } catch {
        applyTrack(null);
      }
    } else {
      const cfg = await api<Partial<AppState>>('GET', '/api/public');
      state = { ...state, ...cfg, bookings: [], live: {} };
    }
    status = 'ready';
    emit();
    connectWs(s);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      if (s.kind === 'admin') setToken('admin', null);
      if (s.kind === 'driver') setToken('driver', null);
      if (s.kind === 'customer') {
        setToken('customer', null);
        setRemoteAccount(null);
      }
    }
    status = 'error';
    emit();
  }
}

function connectWs(s: Scope) {
  ws?.close();
  window.clearTimeout(wsTimer);
  const base = (API || location.origin).replace(/^http/, 'ws');
  const q = new URLSearchParams();
  const tok = scopeToken(s);
  if (tok) q.set('token', tok);
  if (s.kind === 'track') q.set('track', s.code);
  const sock = new WebSocket(`${base}/ws?${q}`);
  ws = sock;
  sock.onopen = () => {
    wsRetry = 0;
  };
  sock.onmessage = (ev) => {
    if (scopeKey(scope) !== scopeKey(s)) return;
    const m = JSON.parse(ev.data);
    if (m.t === 'config') state = { ...state, ...m.data };
    else if (m.t === 'booking') {
      const i = state.bookings.findIndex((b) => b.id === m.data.id);
      const list = [...state.bookings];
      if (i >= 0) list[i] = m.data;
      else {
        list.unshift(m.data);
        // Panel/şoför ekranı açıkken sesli uyarı için
        window.dispatchEvent(new CustomEvent(s.kind === 'driver' ? 'vip:new-job' : 'vip:new-booking', { detail: m.data }));
      }
      state = { ...state, bookings: list };
    } else if (m.t === 'booking-del') state = { ...state, bookings: state.bookings.filter((b) => b.id !== m.id) };
    else if (m.t === 'live') {
      const live = { ...state.live };
      if (m.data) live[m.driverId] = m.data;
      else delete live[m.driverId];
      state = { ...state, live };
    } else if (m.t === 'track') applyTrack(m.data);
    else if (m.t === 'cview') upsertView(m.data);
    else if (m.t === 'customers') state = { ...state, customers: m.data };
    else if (m.t === 'ledger') state = { ...state, expenses: m.data.expenses, settlements: m.data.settlements };
    emit();
  };
  sock.onclose = () => {
    if (ws !== sock || scopeKey(scope) !== scopeKey(s)) return;
    // Yeniden bağlan ve kaçırılan değişiklikleri al
    wsTimer = window.setTimeout(() => loadScope(s), Math.min(15000, 1000 * 2 ** wsRetry++));
  };
}

/** Bir ekran açıldığında hangi verilere ihtiyaç duyduğunu bildirir. */
export function useScope(s: Scope | null) {
  const key = s ? scopeKey(s) : '';
  useEffect(() => {
    if (!REMOTE || !s) return;
    if (scopeKey(scope) !== key || status === 'error') {
      scope = s;
      void loadScope(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/* ---------------- değişiklikler ---------------- */
let configTimer: number | undefined;
let pendingConfig: Partial<AppState> = {};

function role(): 'admin' | 'driver' | 'public' {
  return scope.kind === 'admin' ? 'admin' : scope.kind === 'driver' ? 'driver' : 'public';
}

async function pushChanges(prev: AppState, next: AppState) {
  const r = role();
  const tok = r === 'admin' ? getToken('admin') : r === 'driver' ? getToken('driver') : null;
  try {
    if (r === 'admin') {
      const changed = CONFIG_KEYS.filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
      if (changed.length) {
        changed.forEach((k) => ((pendingConfig as Record<string, unknown>)[k] = next[k]));
        window.clearTimeout(configTimer);
        configTimer = window.setTimeout(() => {
          const body = pendingConfig;
          pendingConfig = {};
          api('PUT', '/api/admin/config', body, getToken('admin')).catch((e) => reportError(e.message));
        }, 500);
      }
    }
    const pm = new Map(prev.bookings.map((b) => [b.id, b]));
    const nm = new Map(next.bookings.map((b) => [b.id, b]));
    for (const [id, b] of nm) {
      const o = pm.get(id);
      if (!o) {
        if (r === 'admin') await api('POST', '/api/admin/bookings', b, tok);
      } else if (JSON.stringify(o) !== JSON.stringify(b)) {
        if (r === 'admin') await api('PATCH', `/api/admin/bookings/${id}`, b, tok);
        else if (r === 'driver') await api('PATCH', `/api/driver/bookings/${id}`, { status: b.status, cashCollected: b.cashCollected }, tok);
      }
    }
    if (r === 'admin') for (const id of pm.keys()) if (!nm.has(id)) await api('DELETE', `/api/admin/bookings/${id}`, undefined, tok);
  } catch (e) {
    reportError((e as Error).message);
    loadScope(scope);
  }
}

/** Durumu değiştirir. Demo modunda kaydedilemezse (kota dolu) false döner. */
export function update(fn: (draft: AppState) => AppState | void): boolean {
  const prev = state;
  const draft = structuredClone(state);
  const next = fn(draft) ?? draft;
  state = next;
  emit();
  if (REMOTE) {
    void pushChanges(prev, next);
    return true;
  }
  return persistLocal();
}

/* ---------------- girişler ---------------- */
export async function adminLogin(password: string): Promise<string | null> {
  if (!REMOTE) return password === state.settings.adminPassword ? null : 'Şifre hatalı.';
  try {
    const { token } = await api<{ token: string }>('POST', '/api/admin/login', { password });
    setToken('admin', token);
    scope = { kind: 'public' };
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export async function driverLogin(driverId: string, pin: string): Promise<string | null> {
  if (!REMOTE) {
    const d = state.drivers.find((x) => x.id === driverId && x.active);
    return d && d.pin === pin ? null : 'PIN hatalı.';
  }
  try {
    const { token } = await api<{ token: string }>('POST', '/api/driver/login', { driverId, pin });
    setToken('driver', token);
    scope = { kind: 'public' };
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Oturumlu POST (bildirim aboneliği vb.) */
export function authedPost(r: 'admin' | 'driver', url: string, body: unknown) {
  return api('POST', url, body, getToken(r));
}

export function hasToken(r: 'admin' | 'driver') {
  return !!getToken(r);
}

export function logout(r: 'admin' | 'driver') {
  setToken(r, null);
  scope = { kind: 'public' };
}

export async function driverList(): Promise<{ id: string; name: string }[]> {
  if (!REMOTE) return state.drivers.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name }));
  try {
    return await api('GET', '/api/drivers');
  } catch {
    return [];
  }
}

/** Tamamlanan yolculuğu değerlendir (rezervasyon kodu yeterli) */
export async function submitReview(code: string, rating: number, text: string) {
  if (REMOTE) {
    applyTrack(await api('POST', `/api/track/${encodeURIComponent(code)}/review`, { rating, text }));
    emit();
    return;
  }
  const b = state.bookings.find((x) => x.code === code);
  if (b) patchBooking(b.id, { review: { rating, text, at: new Date().toISOString() } });
}

/* ---------------- masraf & kasa ---------------- */
export async function addExpense(e: Omit<Expense, 'id' | 'at'>) {
  if (REMOTE) return void (await api('POST', '/api/driver/expenses', e, getToken('driver')));
  update((s) => {
    s.expenses.unshift({ ...e, id: uid('e_'), at: new Date().toISOString() });
  });
}

export async function deleteExpense(id: string, as: 'admin' | 'driver') {
  if (REMOTE) return void (await api('DELETE', `/api/${as}/expenses/${id}`, undefined, getToken(as)));
  update((s) => {
    s.expenses = s.expenses.filter((x) => x.id !== id);
  });
}

export async function addSettlement(driverId: string, amount: number, note: string) {
  if (REMOTE) return void (await api('POST', '/api/admin/settlements', { driverId, amount, note }, getToken('admin')));
  update((s) => {
    s.settlements.unshift({ id: uid('s_'), driverId, amount, note, at: new Date().toISOString() });
  });
}

export async function deleteSettlement(id: string) {
  if (REMOTE) return void (await api('DELETE', `/api/admin/settlements/${id}`, undefined, getToken('admin')));
  update((s) => {
    s.settlements = s.settlements.filter((x) => x.id !== id);
  });
}

/* ---------------- müşteri işlemleri ---------------- */
export class AccountError extends Error {
  code?: string;
  constructor(msg: string, code?: string) {
    super(msg);
    this.code = code;
  }
}

const normPhone = (p: string) => p.replace(/\D/g, '');
const findLocal = (login: string) => {
  const e = login.trim().toLowerCase();
  const ph = normPhone(login);
  return state.customers.find((c) => c.email === e || (ph.length >= 7 && normPhone(c.phone).endsWith(ph.slice(-10))));
};
const setLocalAccount = (c: Customer | null) => {
  account = c;
  try {
    if (c) localStorage.setItem(LOCAL_ACC, c.id);
    else localStorage.removeItem(LOCAL_ACC);
  } catch {
    /* yok say */
  }
  emit();
};

export async function customerRegister(d: { name: string; email: string; phone: string; password: string }): Promise<void> {
  if (REMOTE) {
    try {
      const r = await api<CustomerView & { token: string }>('POST', '/api/customer/register', d);
      setToken('customer', r.token);
      setRemoteAccount(r.customer);
      scope = { kind: 'public' };
      emit();
    } catch (e) {
      const code = (e as Error).message.includes('kayıtlı') ? 'exists' : undefined;
      throw new AccountError((e as Error).message, code);
    }
    return;
  }
  if (findLocal(d.email) || findLocal(d.phone)) throw new AccountError('Bu e-posta veya telefonla kayıtlı bir hesap var. Lütfen giriş yapın.', 'exists');
  if (d.password.length < 6) throw new AccountError('Şifre en az 6 karakter olmalı.');
  const c: Customer = { id: uid('c_'), name: d.name, email: d.email.trim().toLowerCase(), phone: d.phone, createdAt: new Date().toISOString(), password: d.password };
  update((s) => {
    s.customers.push(c);
  });
  setLocalAccount(c);
}

export async function customerLogin(login: string, password: string): Promise<void> {
  if (REMOTE) {
    const r = await api<CustomerView & { token: string }>('POST', '/api/customer/login', { login, password });
    setToken('customer', r.token);
    setRemoteAccount(r.customer);
    scope = { kind: 'public' };
    emit();
    return;
  }
  const c = findLocal(login);
  if (!c || c.password !== password) throw new AccountError('E-posta/telefon veya şifre hatalı.');
  setLocalAccount(c);
}

export function customerLogout() {
  setToken('customer', null);
  if (REMOTE) {
    setRemoteAccount(null);
    scope = { kind: 'public' };
    emit();
  } else setLocalAccount(null);
}

export function isCustomerLoggedIn() {
  return REMOTE ? !!getToken('customer') : !!account;
}

/** Hesapsız yapılmış bir rezervasyonu kodla hesaba ekler. */
export async function claimBooking(code: string): Promise<void> {
  const c = code.trim().toUpperCase();
  if (REMOTE) {
    applyCustomer(await api<CustomerView>('POST', '/api/customer/claim', { code: c }, getToken('customer')));
    emit();
    return;
  }
  const b = state.bookings.find((x) => x.code === c);
  if (!b || !account) throw new AccountError('Bu koda ait rezervasyon bulunamadı.');
  if (b.customerId && b.customerId !== account.id) throw new AccountError('Bu rezervasyon başka bir hesaba bağlı.');
  patchBooking(b.id, { customerId: account.id });
}

export async function updateProfile(p: { name?: string; phone?: string; password?: string; oldPassword?: string }) {
  if (REMOTE) {
    applyCustomer(await api<CustomerView>('PATCH', '/api/customer/me', p, getToken('customer')));
    emit();
    return;
  }
  if (!account) return;
  if (p.password && p.oldPassword !== account.password) throw new AccountError('Mevcut şifre hatalı.');
  const id = account.id;
  update((s) => {
    const c = s.customers.find((x) => x.id === id);
    if (!c) return;
    if (p.name) c.name = p.name;
    if (p.phone) c.phone = p.phone;
    if (p.password) c.password = p.password;
  });
  setLocalAccount(state.customers.find((x) => x.id === id) ?? null);
}

/** Panel: müşteri şifresini sıfırla / müşteriyi sil */
export async function adminSetCustomerPassword(id: string, password: string) {
  if (REMOTE) return void (await api('POST', `/api/admin/customers/${id}/password`, { password }, getToken('admin')));
  update((s) => {
    const c = s.customers.find((x) => x.id === id);
    if (c) c.password = password;
  });
}

export async function adminDeleteCustomer(id: string) {
  if (REMOTE) {
    await api('DELETE', `/api/admin/customers/${id}`, undefined, getToken('admin'));
    state = { ...state, customers: state.customers.filter((c) => c.id !== id) };
    emit();
    return;
  }
  update((s) => {
    s.customers = s.customers.filter((c) => c.id !== id);
    s.bookings.forEach((b) => {
      if (b.customerId === id) b.customerId = undefined;
    });
  });
}

/* ---------------- yardımcılar ---------------- */
export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9);

export function bookingCode() {
  const chars = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  let c = 'VT';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

/** Yeni rezervasyon. Sunucu modunda fiyat sunucuda yeniden hesaplanır; kesin kodu döner. */
export async function addBooking(b: Booking): Promise<string> {
  if (REMOTE) {
    const view = await api<{ booking: Booking }>('POST', '/api/bookings', b, getToken('customer'));
    return view.booking.code;
  }
  update((s) => {
    s.bookings.unshift(account ? { ...b, customerId: account.id } : b);
  });
  return b.code;
}

export function setBookingStatus(id: string, st: BookingStatus, by?: string, patch: Partial<Booking> = {}) {
  update((s) => {
    const b = s.bookings.find((x) => x.id === id);
    if (!b) return;
    Object.assign(b, patch);
    if (b.status !== st) {
      b.status = st;
      b.history.push({ status: st, at: new Date().toISOString(), by });
    }
  });
}

export function patchBooking(id: string, patch: Partial<Booking>) {
  update((s) => {
    const b = s.bookings.find((x) => x.id === id);
    if (b) Object.assign(b, patch);
  });
}

/** Şoför canlı konumu gönderir (null = paylaşımı kapat). */
export async function sendLocation(driverId: string, loc: Omit<LiveLoc, 'at'> | null) {
  if (REMOTE) {
    try {
      await api('POST', '/api/driver/location', loc ?? { off: true }, getToken('driver'));
    } catch {
      /* bir sonraki konumda tekrar denenir */
    }
    const live = { ...state.live };
    if (loc) live[driverId] = { ...loc, at: new Date().toISOString() };
    else delete live[driverId];
    state = { ...state, live };
    emit();
    return;
  }
  const live = { ...state.live };
  if (loc) live[driverId] = { ...loc, at: new Date().toISOString() };
  else delete live[driverId];
  state = { ...state, live };
  persistLocal();
  emit();
}

export function resetDemo() {
  state = createSeed();
  persistLocal();
  emit();
}

export function exportJson() {
  return JSON.stringify(state, null, 2);
}

export function importJson(text: string) {
  const parsed = JSON.parse(text) as AppState;
  if (!parsed || parsed.version !== STATE_VERSION || !Array.isArray(parsed.vehicles)) {
    throw new Error('Geçersiz yedek dosyası');
  }
  if (REMOTE) {
    update(() => ({ ...parsed, live: state.live }));
    return;
  }
  state = parsed;
  persistLocal();
  emit();
}

export function storageUsageKb() {
  try {
    return Math.round((localStorage.getItem(KEY)?.length ?? 0) / 1024);
  } catch {
    return 0;
  }
}
