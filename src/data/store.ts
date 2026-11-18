import { useSyncExternalStore } from 'react';
import type { AppState, Booking, BookingStatus } from '../types';
import { createSeed, STATE_VERSION } from './seed';

/**
 * Veri katmanı. Demo sürümde tarayıcının localStorage'ını kullanır ve
 * sekmeler arası canlı senkronize olur. Canlıya alırken yalnızca bu dosya
 * Supabase (veya başka bir API) ile değiştirilir; arayüz aynı kalır.
 */
const KEY = 'vip-transfer:state:v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === STATE_VERSION) {
        const seed = createSeed();
        return { ...seed, ...parsed, settings: { ...seed.settings, ...parsed.settings } };
      }
    }
  } catch {
    /* bozuk veri -> varsayılan */
  }
  return createSeed();
}

let state: AppState = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      emit();
    }
  });
}

export function getState() {
  return state;
}

/** Durumu değiştirir. Kaydedilemezse (kota dolu) false döner. */
export function update(fn: (draft: AppState) => AppState | void): boolean {
  const draft = structuredClone(state);
  const next = fn(draft) ?? draft;
  state = next;
  const ok = persist();
  emit();
  return ok;
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

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9);

export function bookingCode() {
  const chars = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  let c = 'VT';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export function addBooking(b: Booking) {
  update((s) => {
    s.bookings.unshift(b);
  });
}

export function setBookingStatus(id: string, status: BookingStatus, by?: string, patch: Partial<Booking> = {}) {
  update((s) => {
    const b = s.bookings.find((x) => x.id === id);
    if (!b) return;
    Object.assign(b, patch);
    if (b.status !== status) {
      b.status = status;
      b.history.push({ status, at: new Date().toISOString(), by });
    }
  });
}

export function patchBooking(id: string, patch: Partial<Booking>) {
  update((s) => {
    const b = s.bookings.find((x) => x.id === id);
    if (b) Object.assign(b, patch);
  });
}

export function resetDemo() {
  state = createSeed();
  persist();
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
  state = parsed;
  persist();
  emit();
}

export function storageUsageKb() {
  try {
    return Math.round((localStorage.getItem(KEY)?.length ?? 0) / 1024);
  } catch {
    return 0;
  }
}
