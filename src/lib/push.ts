import { REMOTE, authedPost } from '../data/store';

/** Bu cihazda anlık bildirim (Web Push) kullanılabilir mi? */
export function pushSupported() {
  return REMOTE && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function registerSw() {
  if (!('serviceWorker' in navigator) || !REMOTE) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && REMOTE && !isStandalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** İzin ister, abone olur ve aboneliği sunucuya kaydeder. */
export async function enablePush(role: 'admin' | 'driver'): Promise<PushState> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerSw());
  if (!reg) return 'unsupported';
  await navigator.serviceWorker.ready;
  const { key } = await fetch('/api/push/key').then((r) => r.json());
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await authedPost(role, role === 'admin' ? '/api/admin/push' : '/api/driver/push', sub.toJSON());
  return 'on';
}

/** Panel/şoför ekranı açıkken kısa uyarı sesi (ek dosya gerektirmez). */
export function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const tone = (f: number, t: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    };
    tone(880, 0);
    tone(1175, 0.18);
  } catch {
    /* ses desteklenmiyor */
  }
}
