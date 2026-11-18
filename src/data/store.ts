import { useEffect, useSyncExternalStore } from 'react';
import type { AppState, Booking, BookingStatus, Driver, LiveLoc } from '../types';
import { createSeed, STATE_VERSION } from './seed';

/**
 * Veri katmanı. İki modda çalışır:
 *  - Demo (varsayılan): veriler tarayıcıda (localStorage), sekmeler arası canlı.
 *  - Sunucu (VITE_REMOTE=1): veriler Render sunucusunda; WebSocket ile anlık.
 * Ekranlar her iki modda da aynı fonksiyonları kullanır.
 */
export const REMOTE = import.meta.env.VITE_REMOTE === '1';
const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const KEY = 'vip-transfer:state:v1';
const CONFIG_KEYS = ['settings', 'vehicles', 'locations', 'routes', 'extras', 'drivers'] as const;

type Scope = { kind: 'public' } | { kind: 'admin' } | { kind: 'driver' } | { kind: 'track'; code: string };
export type Status = 'ready' | 'loading' | 'error';

/* ---------------- başlangıç durumu ---------------- */
function loadLocal(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === STATE_VERSION) {
        const seed = createSeed();
        return { ...seed, ...parsed, live: parsed.live ?? {}, settings: { ...seed.settings, ...parsed.settings } };
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
  return { ...seed, ...(injected ?? {}), settings: { ...seed.settings, ...(injected?.settings ?? {}) }, bookings: [], live: {}, drivers: injected?.drivers ?? [] };
}

let state: AppState = REMOTE ? initialRemote() : loadLocal();
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
const TOKENS = { admin: 'vip:token:admin', driver: 'vip:token:driver' } as const;
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
  return s.kind === 'admin' ? getToken('admin') : s.kind === 'driver' ? getToken('driver') : null;
}

function setStatus(s: Status) {
  if (status !== s) {
    status = s;
    emit();
  }
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
      else list.unshift(m.data);
      state = { ...state, bookings: list };
    } else if (m.t === 'booking-del') state = { ...state, bookings: state.bookings.filter((b) => b.id !== m.id) };
    else if (m.t === 'live') {
      const live = { ...state.live };
      if (m.data) live[m.driverId] = m.data;
      else delete live[m.driverId];
      state = { ...state, live };
    } else if (m.t === 'track') applyTrack(m.data);
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
    const view = await api<{ booking: Booking }>('POST', '/api/bookings', b);
    return view.booking.code;
  }
  update((s) => {
    s.bookings.unshift(b);
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
